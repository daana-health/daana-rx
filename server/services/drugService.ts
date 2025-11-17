/**
 * Drug Service
 * Handles drug search from local database and clinic inventory only
 * No external API dependencies
 */

import { supabaseServer } from '../utils/supabase';
import { DrugSearchResult } from '@/types';

/**
 * Normalize NDC code for consistent searching
 */
export function normalizeNDC(ndc: string): string {
  // Remove all non-numeric characters
  return ndc.replace(/[^0-9]/g, '');
}

/**
 * Unified search for drugs by query (NDC or name)
 * Searches both clinic inventory and universal drugs database
 * Returns results prioritized by: clinic inventory first, then drugs database
 */
export async function searchDrugs(
  query: string,
  clinicId: string
): Promise<DrugSearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const normalizedQuery = query.trim();
  const normalizedNDC = normalizeNDC(normalizedQuery);
  const results: DrugSearchResult[] = [];
  const seenNDCs = new Set<string>();

  // First: Search clinic's inventory (units with drugs)
  // This gives priority to drugs the clinic already has in stock
  const { data: inventoryDrugs } = await supabaseServer
    .from('units')
    .select(
      `
      unit_id,
      drug:drugs (
        drug_id,
        medication_name,
        generic_name,
        strength,
        strength_unit,
        ndc_id,
        form
      )
    `
    )
    .eq('clinic_id', clinicId)
    .gt('available_quantity', 0);

  if (inventoryDrugs) {
    for (const unit of inventoryDrugs) {
      if (!unit.drug) continue;

      const drug = unit.drug as any;
      const ndcMatch = normalizeNDC(drug.ndc_id).includes(normalizedNDC);
      const nameMatch =
        drug.medication_name.toLowerCase().includes(normalizedQuery.toLowerCase()) ||
        drug.generic_name.toLowerCase().includes(normalizedQuery.toLowerCase());

      if ((ndcMatch || nameMatch) && !seenNDCs.has(drug.ndc_id)) {
        seenNDCs.add(drug.ndc_id);
        results.push({
          drugId: drug.drug_id,
          medicationName: drug.medication_name,
          genericName: drug.generic_name,
          strength: drug.strength,
          strengthUnit: drug.strength_unit,
          ndcId: drug.ndc_id,
          form: drug.form,
          inInventory: true, // Flag to show it's already in inventory
        });
      }
    }
  }

  // Second: Comprehensive fuzzy search in drugs database
  // Search by NDC, medication name, and generic name simultaneously
  const { data: allDrugs } = await supabaseServer
    .from('drugs')
    .select('*')
    .or(
      `ndc_id.ilike.%${normalizedNDC || normalizedQuery}%,medication_name.ilike.%${normalizedQuery}%,generic_name.ilike.%${normalizedQuery}%`
    )
    .limit(20);

  if (allDrugs) {
    for (const drug of allDrugs) {
      if (!seenNDCs.has(drug.ndc_id)) {
        seenNDCs.add(drug.ndc_id);
        results.push({
          drugId: drug.drug_id,
          medicationName: drug.medication_name,
          genericName: drug.generic_name,
          strength: drug.strength,
          strengthUnit: drug.strength_unit,
          ndcId: drug.ndc_id,
          form: drug.form,
          inInventory: false,
        });
      }
    }
  }

  return results.slice(0, 10); // Return top 10 results
}

/**
 * Search for drug by exact NDC code
 * Used for barcode scanning
 */
export async function searchDrugByNDC(
  ndc: string,
  clinicId?: string
): Promise<DrugSearchResult | null> {
  const normalizedNDC = normalizeNDC(ndc);

  // First, check if clinic has it in inventory
  if (clinicId) {
    const { data: inventoryUnit } = await supabaseServer
      .from('units')
      .select(
        `
        drug:drugs (
          drug_id,
          medication_name,
          generic_name,
          strength,
          strength_unit,
          ndc_id,
          form
        )
      `
      )
      .eq('clinic_id', clinicId)
      .gt('available_quantity', 0)
      .limit(1)
      .single();

    if (inventoryUnit?.drug) {
      const drug = inventoryUnit.drug as any;
      if (normalizeNDC(drug.ndc_id) === normalizedNDC) {
        return {
          drugId: drug.drug_id,
          medicationName: drug.medication_name,
          genericName: drug.generic_name,
          strength: drug.strength,
          strengthUnit: drug.strength_unit,
          ndcId: drug.ndc_id,
          form: drug.form,
          inInventory: true,
        };
      }
    }
  }

  // Check drugs database
  const { data: drug } = await supabaseServer
    .from('drugs')
    .select('*')
    .eq('ndc_id', ndc)
    .single();

  if (drug) {
    return {
      drugId: drug.drug_id,
      medicationName: drug.medication_name,
      genericName: drug.generic_name,
      strength: drug.strength,
      strengthUnit: drug.strength_unit,
      ndcId: drug.ndc_id,
      form: drug.form,
      inInventory: false,
    };
  }

  return null;
}

/**
 * Get or create drug in database
 */
export async function getOrCreateDrug(
  drugData: Omit<DrugSearchResult, 'drugId' | 'inInventory'>
): Promise<string> {
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

  // Check if similar drug exists by name and strength
  const { data: similarDrug } = await supabaseServer
    .from('drugs')
    .select('drug_id')
    .eq('generic_name', drugData.genericName)
    .eq('strength', drugData.strength)
    .eq('strength_unit', drugData.strengthUnit)
    .eq('form', drugData.form)
    .single();

  if (similarDrug) {
    return similarDrug.drug_id;
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
