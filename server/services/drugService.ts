import axios from 'axios';
import { supabaseServer } from '../utils/supabase';
import { DrugSearchResult } from '../../src/types/index';

const RXNORM_API_BASE = 'https://rxnav.nlm.nih.gov/REST';
const OPENFDA_API_BASE = 'https://api.fda.gov/drug';

/**
 * Normalize NDC code from various formats to 11-digit format
 * Formats: 4-4-2, 5-3-2, 5-4-1, 5-4-2 -> 11 digits
 */
export function normalizeNDC(ndc: string): string {
  // Remove all non-numeric characters
  const cleaned = ndc.replace(/[^0-9]/g, '');

  // If already 11 digits, return as is
  if (cleaned.length === 11) {
    return cleaned;
  }

  // If 10 digits, add leading zero to first segment
  if (cleaned.length === 10) {
    return '0' + cleaned;
  }

  return cleaned;
}

/**
 * Search for drug by NDC code
 * Tries internal database first, then RxNorm, then openFDA
 */
export async function searchDrugByNDC(ndc: string): Promise<DrugSearchResult | null> {
  const normalizedNDC = normalizeNDC(ndc);

  // First, check internal database
  const { data: existingDrug } = await supabaseServer
    .from('drugs')
    .select('*')
    .eq('ndc_id', normalizedNDC)
    .single();

  if (existingDrug) {
    return {
      drugId: existingDrug.drug_id,
      medicationName: existingDrug.medication_name,
      genericName: existingDrug.generic_name,
      strength: existingDrug.strength,
      strengthUnit: existingDrug.strength_unit,
      ndcId: existingDrug.ndc_id,
      form: existingDrug.form,
    };
  }

  // Try RxNorm API
  try {
    const rxnormResult = await searchRxNormByNDC(normalizedNDC);
    if (rxnormResult) {
      // Save to database for future use
      await saveDrugToDatabase(rxnormResult);
      return rxnormResult;
    }
  } catch (error) {
    console.error('RxNorm API error:', error);
  }

  // Try openFDA API as fallback
  try {
    const fdaResult = await searchOpenFDAByNDC(normalizedNDC);
    if (fdaResult) {
      await saveDrugToDatabase(fdaResult);
      return fdaResult;
    }
  } catch (error) {
    console.error('openFDA API error:', error);
  }

  return null;
}

/**
 * Search RxNorm API by NDC
 */
async function searchRxNormByNDC(ndc: string): Promise<DrugSearchResult | null> {
  try {
    // Get RxCUI from NDC
    const ndcResponse = await axios.get(`${RXNORM_API_BASE}/ndcstatus.json`, {
      params: { ndc },
    });

    if (!ndcResponse.data.ndcStatus?.rxcui) {
      return null;
    }

    const rxcui = ndcResponse.data.ndcStatus.rxcui;

    // Get drug properties
    const propsResponse = await axios.get(`${RXNORM_API_BASE}/rxcui/${rxcui}/allProperties.json`, {
      params: { prop: 'all' },
    });

    const properties = propsResponse.data.propConceptGroup?.propConcept || [];

    // Extract drug information
    let genericName = '';
    let strength = 0;
    let strengthUnit = 'mg';
    let form = '';

    for (const prop of properties) {
      if (prop.propName === 'RxNorm Name') {
        genericName = prop.propValue;
      }
    }

    // Parse strength from name (e.g., "Lisinopril 10 MG Oral Tablet")
    const strengthMatch = genericName.match(/(\d+\.?\d*)\s*([A-Z]+)/i);
    if (strengthMatch) {
      strength = parseFloat(strengthMatch[1]);
      strengthUnit = strengthMatch[2].toLowerCase();
    }

    // Parse form
    const formMatch = genericName.match(/(tablet|capsule|solution|injection|cream|ointment)/i);
    if (formMatch) {
      form = formMatch[1];
    }

    return {
      medicationName: genericName,
      genericName: genericName.split(' ')[0], // First word is usually the generic name
      strength,
      strengthUnit,
      ndcId: ndc,
      form: form || 'Tablet',
    };
  } catch (error) {
    console.error('RxNorm search error:', error);
    return null;
  }
}

/**
 * Search openFDA API by NDC
 */
async function searchOpenFDAByNDC(ndc: string): Promise<DrugSearchResult | null> {
  try {
    const response = await axios.get(`${OPENFDA_API_BASE}/ndc.json`, {
      params: {
        search: `product_ndc:"${ndc}"`,
        limit: 1,
      },
    });

    if (!response.data.results || response.data.results.length === 0) {
      return null;
    }

    const drug = response.data.results[0];
    const activeIngredient = drug.active_ingredients?.[0] || {};

    // Parse strength
    let strength = 0;
    let strengthUnit = 'mg';
    const strengthStr = activeIngredient.strength || '';
    const strengthMatch = strengthStr.match(/(\d+\.?\d*)\s*([A-Z]+)/i);
    if (strengthMatch) {
      strength = parseFloat(strengthMatch[1]);
      strengthUnit = strengthMatch[2].toLowerCase();
    }

    return {
      medicationName: drug.brand_name || drug.generic_name || 'Unknown',
      genericName: drug.generic_name || activeIngredient.name || 'Unknown',
      strength,
      strengthUnit,
      ndcId: ndc,
      form: drug.dosage_form || 'Tablet',
    };
  } catch (error) {
    console.error('openFDA search error:', error);
    return null;
  }
}

/**
 * Search for drugs by generic name (fuzzy search)
 */
export async function searchDrugsByName(query: string): Promise<DrugSearchResult[]> {
  // Search internal database first
  const { data: localDrugs } = await supabaseServer
    .from('drugs')
    .select('*')
    .ilike('generic_name', `%${query}%`)
    .limit(10);

  const results: DrugSearchResult[] = localDrugs?.map((drug) => ({
    drugId: drug.drug_id,
    medicationName: drug.medication_name,
    genericName: drug.generic_name,
    strength: drug.strength,
    strengthUnit: drug.strength_unit,
    ndcId: drug.ndc_id,
    form: drug.form,
  })) || [];

  // If we have enough results, return them
  if (results.length >= 5) {
    return results;
  }

  // Otherwise, search RxNorm for more
  try {
    const rxnormResults = await searchRxNormByName(query);
    return [...results, ...rxnormResults].slice(0, 10);
  } catch (error) {
    console.error('RxNorm name search error:', error);
    return results;
  }
}

/**
 * Search RxNorm by drug name
 */
async function searchRxNormByName(name: string): Promise<DrugSearchResult[]> {
  try {
    const response = await axios.get(`${RXNORM_API_BASE}/drugs.json`, {
      params: { name },
    });

    const drugGroup = response.data.drugGroup?.conceptGroup || [];
    const results: DrugSearchResult[] = [];

    for (const group of drugGroup) {
      if (group.conceptProperties) {
        for (const concept of group.conceptProperties.slice(0, 5)) {
          const drugName = concept.name || '';

          // Parse strength
          let strength = 0;
          let strengthUnit = 'mg';
          const strengthMatch = drugName.match(/(\d+\.?\d*)\s*([A-Z]+)/i);
          if (strengthMatch) {
            strength = parseFloat(strengthMatch[1]);
            strengthUnit = strengthMatch[2].toLowerCase();
          }

          // Parse form
          const formMatch = drugName.match(/(tablet|capsule|solution|injection|cream)/i);
          const form = formMatch ? formMatch[1] : 'Tablet';

          results.push({
            medicationName: drugName,
            genericName: drugName.split(' ')[0],
            strength,
            strengthUnit,
            ndcId: '', // No NDC from name search
            form,
          });
        }
      }
    }

    return results;
  } catch (error) {
    console.error('RxNorm name search error:', error);
    return [];
  }
}

/**
 * Save drug to database
 */
async function saveDrugToDatabase(drug: DrugSearchResult): Promise<void> {
  try {
    await supabaseServer.from('drugs').insert({
      medication_name: drug.medicationName,
      generic_name: drug.genericName,
      strength: drug.strength,
      strength_unit: drug.strengthUnit,
      ndc_id: drug.ndcId,
      form: drug.form,
    });
  } catch (error) {
    // Ignore duplicate key errors
    console.error('Error saving drug to database:', error);
  }
}

/**
 * Get or create drug in database
 */
export async function getOrCreateDrug(drugData: Omit<DrugSearchResult, 'drugId'>): Promise<string> {
  // Check if drug exists by NDC
  if (drugData.ndcId) {
    const { data: existingDrug } = await supabaseServer
      .from('drugs')
      .select('drug_id')
      .eq('ndc_id', drugData.ndcId)
      .single();

    if (existingDrug) {
      return existingDrug.drug_id;
    }
  }

  // Create new drug
  const { data: newDrug, error } = await supabaseServer
    .from('drugs')
    .insert({
      medication_name: drugData.medicationName,
      generic_name: drugData.genericName,
      strength: drugData.strength,
      strength_unit: drugData.strengthUnit,
      ndc_id: drugData.ndcId || `MANUAL-${Date.now()}`,
      form: drugData.form,
    })
    .select('drug_id')
    .single();

  if (error) {
    throw new Error(`Failed to create drug: ${error.message}`);
  }

  return newDrug.drug_id;
}
