/**
 * Drug API Service
 * Integrates multiple free drug databases:
 * - openFDA API: Drug labeling, NDC directory, comprehensive drug info
 * - RxTerms/Clinical Tables: NLM drug interface terminology
 * - RxNav/RxNorm: Related medications and drug classes
 */

import axios from 'axios';

// Types for API responses
export interface OpenFDADrugResult {
  openfda?: {
    brand_name?: string[];
    generic_name?: string[];
    substance_name?: string[];
    product_ndc?: string[];
    route?: string[];
    dosage_form?: string[];
    strength?: string[];
    manufacturer_name?: string[];
  };
  products?: Array<{
    brand_name?: string;
    generic_name?: string;
    active_ingredients?: Array<{
      name: string;
      strength: string;
    }>;
    dosage_form?: string;
    route?: string;
    product_ndc?: string;
  }>;
}

export interface RxTermsResult {
  medicationName: string;
  genericName: string;
  strength: string;
  strengthUnit: string;
  form: string;
  rxcui?: string; // RxNorm Concept Unique Identifier
}

export interface DrugSearchResult {
  source: 'openfda' | 'rxterms' | 'local';
  medicationName: string;
  genericName: string;
  strength: number;
  strengthUnit: string;
  ndcId: string;
  form: string;
  manufacturer?: string;
  routes?: string[];
  rxcui?: string;
  confidence: number; // 0-100 score for search relevance
}

export interface RelatedMedication {
  rxcui: string;
  name: string;
  relationship: string; // e.g., "same_class", "alternative", "contains_ingredient"
  description?: string;
}

const OPENFDA_BASE_URL = 'https://api.fda.gov';
// RxNav APIs
// Docs: https://lhncbc.nlm.nih.gov/RxNav/APIs/RxTermsAPIs.html
const RXNAV_BASE_URL = 'https://rxnav.nlm.nih.gov/REST';
const RXTERMS_API_URL = `${RXNAV_BASE_URL}/RxTerms`;
const RXNORM_API_URL = RXNAV_BASE_URL;

class DrugApiService {
  private requestCache: Map<string, { data: any; timestamp: number }> = new Map();
  private CACHE_DURATION = 1000 * 60 * 60; // 1 hour cache

  /**
   * Search for drugs across multiple APIs
   */
  async searchDrugs(query: string, limit: number = 10): Promise<DrugSearchResult[]> {
    const results: DrugSearchResult[] = [];

    try {
      // Try all sources in parallel for best coverage
      const [openFDAResults, rxTermsResults] = await Promise.allSettled([
        this.searchOpenFDA(query, limit),
        this.searchRxTerms(query, limit),
      ]);

      // Combine results from all sources
      if (openFDAResults.status === 'fulfilled') {
        results.push(...openFDAResults.value);
      }

      if (rxTermsResults.status === 'fulfilled') {
        results.push(...rxTermsResults.value);
      }

      // Deduplicate by NDC and sort by confidence
      const uniqueResults = this.deduplicateResults(results);
      return uniqueResults.sort((a, b) => b.confidence - a.confidence).slice(0, limit);
    } catch (error) {
      console.error('Error searching drugs:', error);
      return [];
    }
  }

  /**
   * Search openFDA drug database
   * Based on: https://open.fda.gov/apis/drug/ndc/how-to-use-the-endpoint/
   */
  private async searchOpenFDA(query: string, limit: number = 10): Promise<DrugSearchResult[]> {
    try {
      const cacheKey = `openfda:${query}:${limit}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // Clean query for NDC search (numbers only)
      const cleanedNDC = query.replace(/[^0-9-]/g, '');

      let searchQuery = '';

      // If query looks like an NDC (10-11 digits), search by NDC
      // NDC format: product_ndc field without openfda prefix
      if (cleanedNDC.length >= 10) {
        searchQuery = `product_ndc:${cleanedNDC}*`;
      } else {
        // Search by brand name or generic name
        // Clean the query to avoid issues with special characters
        const cleanQuery = query.replace(/[^\w\s]/g, '').trim();
        if (!cleanQuery) {
          console.warn('OpenFDA: Empty query after cleaning');
          return [];
        }

        // Use correct field names: brand_name and generic_name (not openfda.brand_name)
        // Multiple terms with OR using space separation
        // Ref: https://open.fda.gov/apis/query-parameters/
        searchQuery = `brand_name:"${cleanQuery}" generic_name:"${cleanQuery}"`;
      }

      console.log(`OpenFDA search query: ${searchQuery}`);

      const response = await axios.get(
        `${OPENFDA_BASE_URL}/drug/ndc.json`,
        {
          params: {
            search: searchQuery,
            limit: Math.min(limit, 100), // Max 100 per API docs
          },
          timeout: 10000,
          headers: {
            'User-Agent': 'DaanaRX/1.0',
          },
        }
      );

      const results = this.parseOpenFDAResults(response.data.results || []);
      this.saveToCache(cacheKey, results);
      return results;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // OpenFDA returns 404 when no results found - this is normal
        if (error.response?.status === 404) {
          console.log(`OpenFDA: No results found for query: ${query}`);
          return [];
        }

        // Log other errors
        console.error('OpenFDA API error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
          data: error.response?.data,
        });
      } else {
        console.error('OpenFDA unexpected error:', error);
      }
      return [];
    }
  }

  /**
   * Search RxTerms via RxNorm API
   *
   * RxTerms API doesn't have a search endpoint, so we:
   * 1. Search RxNorm API to find drugs and get RxCUIs
   * 2. Fetch RxTerms info for each RxCUI to get prescribable details
   *
   * Docs: https://lhncbc.nlm.nih.gov/RxNav/APIs/RxTermsAPIs.html
   */
  private async searchRxTerms(query: string, limit: number = 10): Promise<DrugSearchResult[]> {
    try {
      const cacheKey = `rxterms:${query}:${limit}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // Step 1: Search RxNorm for drugs matching the query
      // Endpoint: /drugs.json?name=<query>
      const searchResponse = await axios.get(
        `${RXNORM_API_URL}/drugs.json`,
        {
          params: {
            name: query,
          },
          timeout: 5000,
        }
      );

      const suggestions = searchResponse.data?.drugGroup?.conceptGroup || [];

      // Extract RxCUIs from search results
      const rxcuis: string[] = [];
      for (const group of suggestions) {
        const concepts = group.conceptProperties || [];
        for (const concept of concepts) {
          if (concept.rxcui) {
            rxcuis.push(concept.rxcui);
          }
        }
      }

      if (rxcuis.length === 0) {
        console.log(`RxTerms: No RxCUIs found for query: ${query}`);
        return [];
      }

      // Step 2: Fetch RxTerms info for each RxCUI (limit to first 5 for performance)
      const rxcuisToFetch = rxcuis.slice(0, Math.min(5, limit));
      const rxTermsPromises = rxcuisToFetch.map(rxcui =>
        this.getRxTermsInfo(rxcui)
      );

      const rxTermsResults = await Promise.allSettled(rxTermsPromises);

      const results: DrugSearchResult[] = [];
      for (const result of rxTermsResults) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        }
      }

      this.saveToCache(cacheKey, results);
      return results;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('RxTerms API error:', {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data,
        });
      } else {
        console.error('RxTerms unexpected error:', error);
      }
      return [];
    }
  }

  /**
   * Get RxTerms information for a specific RxCUI
   * Endpoint: /RxTerms/rxcui/{rxcui}/allinfo.json
   *
   * Returns prescribable drug information including:
   * - brandName, displayName, genericName
   * - strength, strengthUnit, doseForm, route
   * - synonym (brand name)
   */
  private async getRxTermsInfo(rxcui: string): Promise<DrugSearchResult | null> {
    try {
      const response = await axios.get(
        `${RXTERMS_API_URL}/rxcui/${rxcui}/allinfo.json`,
        {
          timeout: 5000,
        }
      );

      const data = response.data?.rxtermsProperties;
      if (!data) {
        return null;
      }

      // Parse RxTerms structured data
      return this.parseRxTermsInfo(data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // Not all RxNorm concepts have RxTerms data - this is normal
        return null;
      }
      console.error(`RxTerms info error for RxCUI ${rxcui}:`, error);
      return null;
    }
  }

  /**
   * Get drug information by NDC code
   */
  async getDrugByNDC(ndc: string): Promise<DrugSearchResult | null> {
    try {
      const cacheKey = `ndc:${ndc}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached[0] || null;

      const cleanedNDC = ndc.replace(/[^0-9]/g, '');

      if (!cleanedNDC || cleanedNDC.length < 10) {
        console.warn(`OpenFDA: Invalid NDC format: ${ndc}`);
        return null;
      }

      console.log(`OpenFDA NDC lookup: ${cleanedNDC}`);

      const response = await axios.get(
        `${OPENFDA_BASE_URL}/drug/ndc.json`,
        {
          params: {
            search: `product_ndc:${cleanedNDC}`,
            limit: 1,
          },
          timeout: 10000,
          headers: {
            'User-Agent': 'DaanaRX/1.0',
          },
        }
      );

      if (response.data.results && response.data.results.length > 0) {
        const results = this.parseOpenFDAResults([response.data.results[0]]);
        this.saveToCache(cacheKey, results);
        return results[0] || null;
      }

      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // 404 means NDC not found in OpenFDA database
        if (error.response?.status === 404) {
          console.log(`OpenFDA: NDC not found: ${ndc}`);
          return null;
        }

        console.error('OpenFDA NDC lookup error:', {
          status: error.response?.status,
          message: error.message,
          ndc: ndc,
        });
      } else {
        console.error('OpenFDA unexpected error:', error);
      }
      return null;
    }
  }

  /**
   * Find related medications using RxNav/RxNorm
   */
  async getRelatedMedications(drugName: string): Promise<RelatedMedication[]> {
    try {
      const cacheKey = `related:${drugName}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // Step 1: Get RxCUI for the drug
      const rxcui = await this.getRxCUIByName(drugName);
      if (!rxcui) return [];

      // Step 2: Get related drugs
      const related: RelatedMedication[] = [];

      // Get drugs in the same class
      const classMembers = await this.getDrugsByClass(rxcui);
      related.push(...classMembers.map(drug => ({
        ...drug,
        relationship: 'same_class' as const,
      })));

      // Get ingredient-based alternatives
      const alternatives = await this.getAlternativesByIngredient(rxcui);
      related.push(...alternatives.map(drug => ({
        ...drug,
        relationship: 'alternative' as const,
      })));

      this.saveToCache(cacheKey, related);
      return related;
    } catch (error) {
      console.error('Error fetching related medications:', error);
      return [];
    }
  }

  /**
   * Get RxNorm Concept Unique Identifier by drug name
   */
  private async getRxCUIByName(drugName: string): Promise<string | null> {
    try {
      const response = await axios.get(
        `${RXNAV_BASE_URL}/rxcui.json`,
        {
          params: {
            name: drugName,
          },
          timeout: 5000,
        }
      );

      const rxcui = response.data?.idGroup?.rxnormId?.[0];
      return rxcui || null;
    } catch (error) {
      console.error('Error getting RxCUI:', error);
      return null;
    }
  }

  /**
   * Get drugs in the same therapeutic class
   */
  private async getDrugsByClass(rxcui: string): Promise<RelatedMedication[]> {
    try {
      const response = await axios.get(
        `${RXNAV_BASE_URL}/rxclass/class/byRxcui.json`,
        {
          params: {
            rxcui,
            relaSource: 'ATC', // Anatomical Therapeutic Chemical Classification
          },
          timeout: 5000,
        }
      );

      const classId = response.data?.rxclassMinConceptList?.rxclassMinConcept?.[0]?.classId;
      if (!classId) return [];

      // Get other drugs in the same class
      const membersResponse = await axios.get(
        `${RXNAV_BASE_URL}/rxclass/classMembers.json`,
        {
          params: {
            classId,
            relaSource: 'ATC',
          },
          timeout: 5000,
        }
      );

      const members = membersResponse.data?.drugMemberGroup?.drugMember || [];
      return members
        .filter((m: any) => m.minConcept?.rxcui !== rxcui) // Exclude the original drug
        .slice(0, 5) // Limit to 5 related drugs
        .map((m: any) => ({
          rxcui: m.minConcept.rxcui,
          name: m.minConcept.name,
          relationship: 'same_class',
          description: response.data?.rxclassMinConceptList?.rxclassMinConcept?.[0]?.className,
        }));
    } catch (error) {
      console.error('Error getting drugs by class:', error);
      return [];
    }
  }

  /**
   * Get alternative drugs containing the same ingredient
   */
  private async getAlternativesByIngredient(rxcui: string): Promise<RelatedMedication[]> {
    try {
      // Get ingredients of the drug
      const response = await axios.get(
        `${RXNAV_BASE_URL}/rxcui/${rxcui}/related.json`,
        {
          params: {
            tty: 'IN', // Ingredient
          },
          timeout: 5000,
        }
      );

      const ingredients = response.data?.relatedGroup?.conceptGroup || [];
      const ingredientConcepts = ingredients
        .find((g: any) => g.tty === 'IN')
        ?.conceptProperties || [];

      if (ingredientConcepts.length === 0) return [];

      // Get drugs containing the first ingredient
      const ingredientRxcui = ingredientConcepts[0].rxcui;
      const drugsResponse = await axios.get(
        `${RXNAV_BASE_URL}/rxcui/${ingredientRxcui}/related.json`,
        {
          params: {
            tty: 'SCD+SBD', // Semantic Clinical Drug + Semantic Branded Drug
          },
          timeout: 5000,
        }
      );

      const relatedDrugs = drugsResponse.data?.relatedGroup?.conceptGroup || [];
      const allDrugs = relatedDrugs.flatMap((g: any) => g.conceptProperties || []);

      return allDrugs
        .filter((d: any) => d.rxcui !== rxcui)
        .slice(0, 5)
        .map((d: any) => ({
          rxcui: d.rxcui,
          name: d.name,
          relationship: 'alternative',
          description: `Contains ${ingredientConcepts[0].name}`,
        }));
    } catch (error) {
      console.error('Error getting alternatives by ingredient:', error);
      return [];
    }
  }

  /**
   * Parse openFDA API results
   *
   * OpenFDA NDC response structure:
   * {
   *   "results": [{
   *     "product_ndc": "0573-0164",
   *     "brand_name": "Advil",
   *     "generic_name": "Ibuprofen",
   *     "dosage_form": "TABLET",
   *     "route": ["ORAL"],
   *     "openfda": {
   *       "brand_name": ["Advil"],
   *       "generic_name": ["IBUPROFEN"],
   *       "manufacturer_name": ["Pfizer"],
   *       "product_ndc": ["0573-0164-70"],
   *       "dosage_form": ["TABLET"],
   *       "route": ["ORAL"],
   *       "substance_name": ["IBUPROFEN"],
   *       "strength": ["200 mg/1"]
   *     }
   *   }]
   * }
   *
   * Fields can be at root level OR in openfda object (or both)
   */
  private parseOpenFDAResults(results: any[]): DrugSearchResult[] {
    return results.map(result => {
      const openfda = result.openfda || {};

      // Try openfda object first (more detailed), then root level
      const brandName = openfda.brand_name?.[0] || result.brand_name || '';
      const genericName = openfda.generic_name?.[0] || result.generic_name || openfda.substance_name?.[0] || '';
      const ndc = result.product_ndc || openfda.product_ndc?.[0] || '';
      const form = this.normalizeForm(openfda.dosage_form?.[0] || result.dosage_form || 'Tablet');
      const strengthStr = openfda.strength?.[0] || result.strength || '0mg';
      const { strength, unit } = this.parseStrength(strengthStr);

      return {
        source: 'openfda',
        medicationName: brandName || genericName,
        genericName: genericName || brandName,
        strength,
        strengthUnit: unit,
        ndcId: ndc,
        form,
        manufacturer: openfda.manufacturer_name?.[0],
        routes: openfda.route || [],
        confidence: 90, // openFDA is highly reliable
      };
    });
  }

  /**
   * Parse RxTerms API structured response
   *
   * RxTerms response structure from /rxcui/{rxcui}/allinfo.json:
   * {
   *   "rxtermsProperties": {
   *     "rxcui": "198440",
   *     "displayName": "Ibuprofen 200 MG Oral Tablet [Advil]",
   *     "synonym": "Advil",                    // Brand name
   *     "fullName": "Ibuprofen 200 MG Oral Tablet",
   *     "fullGenericName": "Ibuprofen",
   *     "brandName": "Advil",
   *     "strength": "200",
   *     "strengthUnit": "MG",
   *     "doseForm": "Oral Tablet",
   *     "route": "Oral",
   *     "termType": "SBD"                      // Branded drug
   *   }
   * }
   */
  private parseRxTermsInfo(data: any): DrugSearchResult | null {
    if (!data) return null;

    const brandName = data.brandName || data.synonym || '';
    const genericName = data.fullGenericName || data.genericName || '';
    const displayName = data.displayName || '';

    // Parse strength
    let strength = 0;
    let strengthUnit = 'mg';

    if (data.strength) {
      const strengthValue = parseFloat(data.strength);
      if (!isNaN(strengthValue)) {
        strength = strengthValue;
      }
    }

    if (data.strengthUnit) {
      strengthUnit = data.strengthUnit.toLowerCase();
    }

    // Parse dose form
    const form = this.normalizeForm(data.doseForm || data.route || 'Tablet');

    // Decide on medication name (brand if available, else generic)
    const medicationName = brandName || genericName || displayName;

    // Validate the parsed data
    const validated = this.validateRxTermsData({
      medicationName,
      genericName: genericName || medicationName,
      strength,
      strengthUnit,
      form,
      originalDisplay: displayName,
    });

    // Generate placeholder NDC
    const nameHash = this.simpleHash(validated.genericName);
    const ndcId = `RXTERM-${nameHash}-${validated.strength}${validated.strengthUnit}`.substring(0, 20);

    return {
      source: 'rxterms',
      medicationName: validated.medicationName,
      genericName: validated.genericName,
      strength: validated.strength,
      strengthUnit: validated.strengthUnit,
      ndcId,
      form: validated.form,
      confidence: validated.confidence,
      routes: data.route ? [data.route] : undefined,
    };
  }

  /**
   * Validate and correct RxTerms parsed data
   */
  private validateRxTermsData(data: {
    medicationName: string;
    genericName: string;
    strength: number;
    strengthUnit: string;
    form: string;
    originalDisplay: string;
  }): {
    medicationName: string;
    genericName: string;
    strength: number;
    strengthUnit: string;
    form: string;
    confidence: number;
  } {
    let { medicationName, genericName, strength, strengthUnit, form } = data;
    let confidence = 85; // Start with default RxTerms confidence

    // VALIDATION 1: Check if form matches name descriptors
    const formInName = this.extractFormFromName(data.originalDisplay);
    if (formInName && formInName !== form) {
      console.warn(
        `RxTerms form mismatch: Name suggests "${formInName}" but parsed as "${form}". Using name-based form.`
      );
      form = formInName;
      confidence -= 10; // Reduce confidence due to mismatch
    }

    // VALIDATION 2: Check for zero or missing strength
    if (strength === 0 || isNaN(strength)) {
      console.warn(
        `RxTerms: No strength found for "${medicationName}". This may be incorrect.`
      );
      confidence -= 20; // Significant confidence reduction

      // Try to extract from original display
      const strengthMatch = data.originalDisplay.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|unit)/i);
      if (strengthMatch) {
        strength = parseFloat(strengthMatch[1]);
        strengthUnit = strengthMatch[2].toLowerCase();
        console.log(`RxTerms: Recovered strength ${strength}${strengthUnit} from display string`);
        confidence += 10; // Recover some confidence
      }
    }

    // VALIDATION 3: Check for unreasonable strengths
    if (strength > 10000 && strengthUnit === 'mg') {
      console.warn(
        `RxTerms: Unusually high strength (${strength}${strengthUnit}) for "${medicationName}". May be data error.`
      );
      confidence -= 15;
    }

    // VALIDATION 4: Check if strength unit makes sense for form
    if (form === 'Injection' && strengthUnit === 'mg' && strength < 1) {
      console.warn(
        `RxTerms: Injection with very low mg dose (${strength}${strengthUnit}). May need unit conversion.`
      );
      confidence -= 10;
    }

    // VALIDATION 5: Clean up medication name
    // Remove form descriptors from name if they're redundant
    medicationName = medicationName
      .replace(/\s*\(Injectable\)\s*/gi, '')
      .replace(/\s*\(Oral\)\s*/gi, '')
      .replace(/\s*\(Topical\)\s*/gi, '')
      .trim();

    genericName = genericName
      .replace(/\s*\(Injectable\)\s*/gi, '')
      .replace(/\s*\(Oral\)\s*/gi, '')
      .replace(/\s*\(Topical\)\s*/gi, '')
      .trim();

    // VALIDATION 6: Ensure names aren't empty
    if (!medicationName || medicationName.length < 2) {
      medicationName = data.originalDisplay.split(/\s+/)[0] || 'Unknown Medication';
      confidence -= 30;
    }

    if (!genericName || genericName.length < 2) {
      genericName = medicationName;
    }

    return {
      medicationName,
      genericName,
      strength,
      strengthUnit,
      form,
      confidence: Math.max(confidence, 40), // Never go below 40
    };
  }

  /**
   * Extract form from medication name/description
   */
  private extractFormFromName(name: string): string | null {
    const lowerName = name.toLowerCase();

    // Check for explicit form indicators in name
    const formIndicators = [
      { patterns: ['injectable', 'injection', 'inject'], form: 'Injection' },
      { patterns: ['oral tablet', 'oral tab'], form: 'Tablet' },
      { patterns: ['oral capsule', 'oral cap'], form: 'Capsule' },
      { patterns: ['oral solution', 'oral liquid', 'syrup'], form: 'Liquid' },
      { patterns: ['topical cream', 'cream'], form: 'Cream' },
      { patterns: ['topical ointment', 'ointment'], form: 'Ointment' },
      { patterns: ['patch', 'transdermal'], form: 'Patch' },
      { patterns: ['inhaler', 'inhalation'], form: 'Inhaler' },
      { patterns: ['suppository'], form: 'Suppository' },
    ];

    for (const indicator of formIndicators) {
      for (const pattern of indicator.patterns) {
        if (lowerName.includes(pattern)) {
          return indicator.form;
        }
      }
    }

    return null;
  }

  /**
   * Parse strength string into number and unit
   */
  private parseStrength(strengthStr: string): { strength: number; unit: string } {
    const match = strengthStr.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/);
    if (match) {
      return {
        strength: parseFloat(match[1]),
        unit: match[2].toLowerCase(),
      };
    }
    return { strength: 0, unit: 'mg' };
  }

  /**
   * Normalize dosage form to standard values
   */
  private normalizeForm(form: string): string {
    const normalized = form.toLowerCase();

    const formMap: { [key: string]: string } = {
      'tablet': 'Tablet',
      'capsule': 'Capsule',
      'solution': 'Liquid',
      'suspension': 'Liquid',
      'syrup': 'Liquid',
      'injection': 'Injection',
      'cream': 'Cream',
      'ointment': 'Ointment',
      'gel': 'Cream',
      'lotion': 'Cream',
      'patch': 'Patch',
      'inhaler': 'Inhaler',
      'aerosol': 'Inhaler',
      'suppository': 'Suppository',
    };

    for (const [key, value] of Object.entries(formMap)) {
      if (normalized.includes(key)) {
        return value;
      }
    }

    return 'Tablet'; // Default fallback
  }

  /**
   * Simple hash function for generating placeholder NDC codes
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 6).toUpperCase();
  }

  /**
   * Deduplicate results by NDC and name similarity
   */
  private deduplicateResults(results: DrugSearchResult[]): DrugSearchResult[] {
    const seen = new Map<string, DrugSearchResult>();

    for (const result of results) {
      // Use NDC as primary key if available
      if (result.ndcId) {
        const existing = seen.get(result.ndcId);
        if (!existing || result.confidence > existing.confidence) {
          seen.set(result.ndcId, result);
        }
        continue;
      }

      // Otherwise use combination of name and strength
      const key = `${result.medicationName.toLowerCase()}_${result.strength}_${result.strengthUnit}`;
      const existing = seen.get(key);
      if (!existing || result.confidence > existing.confidence) {
        seen.set(key, result);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): any | null {
    const cached = this.requestCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    this.requestCache.delete(key);
    return null;
  }

  private saveToCache(key: string, data: any): void {
    this.requestCache.set(key, {
      data,
      timestamp: Date.now(),
    });

    // Clean up old cache entries periodically
    if (this.requestCache.size > 100) {
      const now = Date.now();
      for (const [k, v] of this.requestCache.entries()) {
        if (now - v.timestamp > this.CACHE_DURATION) {
          this.requestCache.delete(k);
        }
      }
    }
  }
}

export const drugApiService = new DrugApiService();
