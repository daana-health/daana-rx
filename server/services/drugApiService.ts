/**
 * Drug API Service
 * Integrates multiple free drug databases:
 * - openFDA API: Drug labeling, NDC directory, comprehensive drug info
 * - RxTerms/Clinical Tables: NLM drug interface terminology
 * - RxNav/RxNorm: Related medications and drug classes
 */

import axios, { AxiosError } from 'axios';

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
const RXTERMS_BASE_URL = 'https://clinicaltables.nlm.nih.gov/api/rxterms/v3';
const RXNAV_BASE_URL = 'https://rxnav.nlm.nih.gov/REST';

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
   */
  private async searchOpenFDA(query: string, limit: number = 10): Promise<DrugSearchResult[]> {
    try {
      const cacheKey = `openfda:${query}:${limit}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // Clean query for NDC search (numbers only)
      const cleanedNDC = query.replace(/[^0-9]/g, '');
      
      let searchQuery = '';
      
      // If query looks like an NDC (10-11 digits), search by NDC
      if (cleanedNDC.length >= 10) {
        searchQuery = `openfda.product_ndc:*${cleanedNDC}*`;
      } else {
        // Otherwise search by name (brand or generic)
        const encodedQuery = encodeURIComponent(query);
        searchQuery = `(openfda.brand_name:"${encodedQuery}"+openfda.generic_name:"${encodedQuery}"+openfda.substance_name:"${encodedQuery}")`;
      }

      const response = await axios.get(
        `${OPENFDA_BASE_URL}/drug/ndc.json`,
        {
          params: {
            search: searchQuery,
            limit,
          },
          timeout: 5000,
        }
      );

      const results = this.parseOpenFDAResults(response.data.results || []);
      this.saveToCache(cacheKey, results);
      return results;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('OpenFDA API error:', error.response?.status, error.message);
      }
      return [];
    }
  }

  /**
   * Search RxTerms database (NLM)
   */
  private async searchRxTerms(query: string, limit: number = 10): Promise<DrugSearchResult[]> {
    try {
      const cacheKey = `rxterms:${query}:${limit}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      const response = await axios.get(
        `${RXTERMS_BASE_URL}/search`,
        {
          params: {
            terms: query,
            maxList: limit,
          },
          timeout: 5000,
        }
      );

      const results = this.parseRxTermsResults(response.data);
      this.saveToCache(cacheKey, results);
      return results;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('RxTerms API error:', error.response?.status, error.message);
      }
      return [];
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
      
      const response = await axios.get(
        `${OPENFDA_BASE_URL}/drug/ndc.json`,
        {
          params: {
            search: `product_ndc:"${cleanedNDC}"`,
            limit: 1,
          },
          timeout: 5000,
        }
      );

      if (response.data.results && response.data.results.length > 0) {
        const results = this.parseOpenFDAResults([response.data.results[0]]);
        this.saveToCache(cacheKey, results);
        return results[0] || null;
      }

      return null;
    } catch (error) {
      console.error('Error fetching drug by NDC:', error);
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
   */
  private parseOpenFDAResults(results: any[]): DrugSearchResult[] {
    return results.map(result => {
      const openfda = result.openfda || {};
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
   * Parse RxTerms API results
   */
  private parseRxTermsResults(data: any): DrugSearchResult[] {
    // RxTerms returns: [totalCount, [codes], [display strings], [synonym arrays]]
    if (!data || !Array.isArray(data) || data.length < 3) return [];

    const displayStrings = data[1] || [];
    const synonymArrays = data[2] || [];

    return displayStrings.map((display: string, index: number) => {
      // RxTerms format: "MEDICATION (strength) [form]"
      // Example: "Ibuprofen 200 MG Oral Tablet [Advil]"
      const parts = display.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(\w+)\s+(.+?)(?:\s+\[(.+?)\])?$/);
      
      let medicationName = display;
      let genericName = display;
      let strength = 0;
      let strengthUnit = 'mg';
      let form = 'Tablet';

      if (parts) {
        genericName = parts[1].trim();
        strength = parseFloat(parts[2]);
        strengthUnit = parts[3].toLowerCase();
        form = this.normalizeForm(parts[4]);
        medicationName = parts[5] || genericName;
      }

      // Try to extract NDC from synonyms if available
      const synonyms = synonymArrays[index] || [];
      let ndcId = '';
      
      // RxTerms doesn't provide NDC, so generate a placeholder
      // Format: RXTERM-{medicationName hash}-{strength}
      // This allows the drug to be created while making it clear it's from RxTerms
      if (!ndcId) {
        const nameHash = this.simpleHash(genericName);
        ndcId = `RXTERM-${nameHash}-${strength}${strengthUnit}`.substring(0, 20);
      }
      
      return {
        source: 'rxterms',
        medicationName,
        genericName,
        strength,
        strengthUnit,
        ndcId,
        form,
        confidence: 85, // RxTerms is very good for prescription drugs
      };
    });
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

