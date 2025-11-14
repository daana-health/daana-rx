import { supabaseServer } from '../utils/supabase';
import { Unit, CreateUnitRequest } from '../../src/types/index';
import { getOrCreateDrug } from './drugService';

/**
 * Create a new unit
 */
export async function createUnit(
  input: CreateUnitRequest,
  userId: string,
  clinicId: string
): Promise<Unit> {
  let drugId = input.drugId;

  // If drugData is provided, get or create the drug
  if (input.drugData && !drugId) {
    drugId = await getOrCreateDrug(input.drugData);
  }

  if (!drugId) {
    throw new Error('Either drugId or drugData must be provided');
  }

  // Create the unit
  const { data: unit, error } = await supabaseServer
    .from('units')
    .insert({
      total_quantity: input.totalQuantity,
      available_quantity: input.availableQuantity,
      lot_id: input.lotId,
      expiry_date: input.expiryDate,
      user_id: userId,
      drug_id: drugId,
      optional_notes: input.optionalNotes,
      clinic_id: clinicId,
    })
    .select(`
      *,
      drug:drugs(*),
      lot:lots(*),
      user:users(*)
    `)
    .single();

  if (error || !unit) {
    throw new Error(`Failed to create unit: ${error?.message}`);
  }

  // Create check-in transaction
  await supabaseServer.from('transactions').insert({
    type: 'check in',
    quantity: input.totalQuantity,
    unit_id: unit.unit_id,
    user_id: userId,
    notes: `Initial check-in`,
    clinic_id: clinicId,
  });

  return formatUnit(unit);
}

/**
 * Get unit by ID
 */
export async function getUnitById(unitId: string, clinicId: string): Promise<Unit | null> {
  const { data: unit, error } = await supabaseServer
    .from('units')
    .select(`
      *,
      drug:drugs(*),
      lot:lots(*),
      user:users(*)
    `)
    .eq('unit_id', unitId)
    .eq('clinic_id', clinicId)
    .single();

  if (error || !unit) {
    return null;
  }

  return formatUnit(unit);
}

/**
 * Get all units for a clinic with pagination
 */
export async function getUnits(
  clinicId: string,
  page: number = 1,
  pageSize: number = 50,
  search?: string
) {
  let query = supabaseServer
    .from('units')
    .select(`
      *,
      drug:drugs(*),
      lot:lots(*),
      user:users(*)
    `, { count: 'exact' })
    .eq('clinic_id', clinicId);

  // Add search filter if provided
  if (search) {
    query = query.or(`
      optional_notes.ilike.%${search}%,
      drug.generic_name.ilike.%${search}%,
      drug.medication_name.ilike.%${search}%
    `);
  }

  // Add pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to).order('date_created', { ascending: false });

  const { data: units, error, count } = await query;

  if (error) {
    throw new Error(`Failed to get units: ${error.message}`);
  }

  return {
    units: units?.map(formatUnit) || [],
    total: count || 0,
    page,
    pageSize,
  };
}

/**
 * Search units by query (for quick lookup)
 */
export async function searchUnits(query: string, clinicId: string): Promise<Unit[]> {
  const { data: units, error } = await supabaseServer
    .from('units')
    .select(`
      *,
      drug:drugs(*),
      lot:lots(*),
      user:users(*)
    `)
    .eq('clinic_id', clinicId)
    .or(`unit_id.ilike.%${query}%,drug.generic_name.ilike.%${query}%`)
    .limit(10);

  if (error) {
    throw new Error(`Failed to search units: ${error.message}`);
  }

  return units?.map(formatUnit) || [];
}

/**
 * Update unit
 */
export async function updateUnit(
  unitId: string,
  updates: {
    totalQuantity?: number;
    availableQuantity?: number;
    expiryDate?: string;
    optionalNotes?: string;
  },
  clinicId: string
): Promise<Unit> {
  const updateData: Record<string, unknown> = {};

  if (updates.totalQuantity !== undefined) updateData.total_quantity = updates.totalQuantity;
  if (updates.availableQuantity !== undefined) updateData.available_quantity = updates.availableQuantity;
  if (updates.expiryDate !== undefined) updateData.expiry_date = updates.expiryDate;
  if (updates.optionalNotes !== undefined) updateData.optional_notes = updates.optionalNotes;

  const { data: unit, error } = await supabaseServer
    .from('units')
    .update(updateData)
    .eq('unit_id', unitId)
    .eq('clinic_id', clinicId)
    .select(`
      *,
      drug:drugs(*),
      lot:lots(*),
      user:users(*)
    `)
    .single();

  if (error || !unit) {
    throw new Error(`Failed to update unit: ${error?.message}`);
  }

  return formatUnit(unit);
}

/**
 * Format unit data from database
 */
function formatUnit(unit: any): Unit {
  return {
    unitId: unit.unit_id,
    totalQuantity: unit.total_quantity,
    availableQuantity: unit.available_quantity,
    patientReferenceId: unit.patient_reference_id,
    lotId: unit.lot_id,
    expiryDate: new Date(unit.expiry_date),
    dateCreated: new Date(unit.date_created),
    userId: unit.user_id,
    drugId: unit.drug_id,
    qrCode: unit.qr_code,
    optionalNotes: unit.optional_notes,
    clinicId: unit.clinic_id,
    drug: {
      drugId: unit.drug.drug_id,
      medicationName: unit.drug.medication_name,
      genericName: unit.drug.generic_name,
      strength: unit.drug.strength,
      strengthUnit: unit.drug.strength_unit,
      ndcId: unit.drug.ndc_id,
      form: unit.drug.form,
    },
  };
}

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(clinicId: string) {
  // Get total units
  const { count: totalUnits } = await supabaseServer
    .from('units')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .gt('available_quantity', 0);

  // Get units expiring soon (within 30 days)
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const { count: expiringSoon } = await supabaseServer
    .from('units')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .lte('expiry_date', thirtyDaysFromNow.toISOString())
    .gt('available_quantity', 0);

  // Get recent check-ins (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { count: recentCheckIns } = await supabaseServer
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('type', 'check in')
    .gte('timestamp', sevenDaysAgo.toISOString());

  // Get recent check-outs (last 7 days)
  const { count: recentCheckOuts } = await supabaseServer
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('type', 'check out')
    .gte('timestamp', sevenDaysAgo.toISOString());

  // Get low stock alerts (available < 10% of total)
  const { data: allUnits } = await supabaseServer
    .from('units')
    .select('total_quantity, available_quantity')
    .eq('clinic_id', clinicId)
    .gt('available_quantity', 0);

  const lowStockAlerts = allUnits?.filter(
    (unit) => unit.available_quantity < unit.total_quantity * 0.1
  ).length || 0;

  return {
    totalUnits: totalUnits || 0,
    unitsExpiringSoon: expiringSoon || 0,
    recentCheckIns: recentCheckIns || 0,
    recentCheckOuts: recentCheckOuts || 0,
    lowStockAlerts,
  };
}
