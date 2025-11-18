import { supabaseServer } from '../utils/supabase';
import { Unit, CreateUnitRequest } from '@/types';
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

  // Create the unit (qr_code will be the unitId itself, set after insertion)
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

  // Update the unit with its own ID as the QR code (simple and effective)
  await supabaseServer
    .from('units')
    .update({ qr_code: unit.unit_id })
    .eq('unit_id', unit.unit_id);

  // Add qr_code to the returned unit
  unit.qr_code = unit.unit_id;

  // Create check-in transaction
  await supabaseServer.from('transactions').insert({
    type: 'check_in',
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

  // Add pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to).order('date_created', { ascending: false });

  const { data: units, error, count } = await query;

  if (error) {
    throw new Error(`Failed to get units: ${error.message}`);
  }

  // Apply fuzzy search filtering on the client side for joined fields
  let filteredUnits = units || [];
  if (search && filteredUnits.length > 0) {
    const searchLower = search.toLowerCase();
    filteredUnits = filteredUnits.filter((unit: any) => {
      return (
        // Search in notes
        (unit.optional_notes && unit.optional_notes.toLowerCase().includes(searchLower)) ||
        // Search in drug names
        (unit.drug && unit.drug.medication_name && unit.drug.medication_name.toLowerCase().includes(searchLower)) ||
        (unit.drug && unit.drug.generic_name && unit.drug.generic_name.toLowerCase().includes(searchLower)) ||
        (unit.drug && unit.drug.ndc_id && unit.drug.ndc_id.toLowerCase().includes(searchLower)) ||
        (unit.drug && unit.drug.form && unit.drug.form.toLowerCase().includes(searchLower)) ||
        // Search in lot source
        (unit.lot && unit.lot.source && unit.lot.source.toLowerCase().includes(searchLower)) ||
        (unit.lot && unit.lot.note && unit.lot.note.toLowerCase().includes(searchLower)) ||
        // Search in unit ID
        (unit.unit_id && unit.unit_id.toLowerCase().includes(searchLower)) ||
        // Search in quantity (convert to string)
        (unit.available_quantity && unit.available_quantity.toString().includes(searchLower)) ||
        (unit.total_quantity && unit.total_quantity.toString().includes(searchLower)) ||
        // Search in user
        (unit.user && unit.user.username && unit.user.username.toLowerCase().includes(searchLower))
      );
    });
  }

  return {
    units: filteredUnits.map(formatUnit),
    total: search ? filteredUnits.length : (count || 0),
    page,
    pageSize,
  };
}

/**
 * Search units by query (for quick lookup)
 * Searches by unit ID, medication name, generic name, and strength
 */
export async function searchUnits(query: string, clinicId: string): Promise<Unit[]> {
  // Validate input
  if (!query || typeof query !== 'string') {
    return [];
  }

  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) {
    return [];
  }

  const queryLower = trimmedQuery.toLowerCase();
  const isNumeric = !isNaN(Number(queryLower)) && queryLower.length > 0;
  const numericValue = isNumeric ? Number(queryLower) : null;

  // Determine if query looks like a UUID (36 chars with hyphens) or partial UUID
  const looksLikeUnitId = trimmedQuery.length >= 8 && /^[a-f0-9-]+$/i.test(trimmedQuery);
  
  try {
    // Fetch units with available quantity
    let queryBuilder = supabaseServer
      .from('units')
      .select(`
        *,
        drug:drugs(*),
        lot:lots(*),
        user:users(*)
      `)
      .eq('clinic_id', clinicId)
      .gt('available_quantity', 0);

    if (looksLikeUnitId) {
      // If it looks like a unit ID, filter by it for better performance
      // Escape the query to prevent SQL injection-like issues
      const escapedQuery = trimmedQuery.replace(/%/g, '\\%').replace(/_/g, '\\_');
      queryBuilder = queryBuilder.ilike('unit_id', `%${escapedQuery}%`);
    } else {
      // For non-UUID queries, fetch a reasonable number of recent units
      queryBuilder = queryBuilder.order('date_created', { ascending: false });
    }
    
    // Limit to reasonable number for filtering
    const limit = looksLikeUnitId ? 50 : 100;
    const { data: units, error } = await queryBuilder.limit(limit);

    if (error) {
      console.error('Error searching units:', error);
      throw new Error(`Failed to search units: ${error.message}`);
    }

    if (!units || units.length === 0) {
      return [];
    }

    // Filter units in JavaScript for more flexible searching
    const filteredUnits = units.filter((unit: any) => {
      const drug = unit.drug;
      if (!drug) return false;

      // Check unit ID match
      const unitIdMatch = unit.unit_id && unit.unit_id.toLowerCase().includes(queryLower);

      // Check medication name match
      const medicationMatch = drug.medication_name && 
                              drug.medication_name.toLowerCase().includes(queryLower);

      // Check generic name match
      const genericMatch = drug.generic_name && 
                          drug.generic_name.toLowerCase().includes(queryLower);

      // Check strength match (if query is numeric or contains numbers)
      let strengthMatch = false;
      if (numericValue !== null) {
        // Exact match or partial match (e.g., "10" matches 10.0)
        strengthMatch = drug.strength === numericValue || 
                       String(drug.strength).includes(queryLower);
      } else if (drug.strength !== null && drug.strength !== undefined) {
        // Text search might contain strength (e.g., "10mg" or "lisinopril 10")
        const strengthStr = String(drug.strength);
        strengthMatch = strengthStr.includes(queryLower) || 
                       queryLower.includes(strengthStr);
      }

      return unitIdMatch || medicationMatch || genericMatch || strengthMatch;
    });

    // Limit results to 20
    return filteredUnits.slice(0, 20).map(formatUnit);
  } catch (error: any) {
    console.error('Error in searchUnits:', error);
    throw new Error(`Failed to search units: ${error.message || 'Unknown error'}`);
  }
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
    lot: {
      lotId: unit.lot.lot_id,
      source: unit.lot.source,
      note: unit.lot.note,
      dateCreated: new Date(unit.lot.date_created),
      locationId: unit.lot.location_id,
      clinicId: unit.lot.clinic_id,
    },
    user: {
      userId: unit.user.user_id,
      username: unit.user.username,
      email: unit.user.email,
      password: '',
      clinicId: unit.user.clinic_id,
      userRole: unit.user.user_role,
      createdAt: new Date(unit.user.created_at),
      updatedAt: new Date(unit.user.updated_at),
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
    .eq('type', 'check_in')
    .gte('timestamp', sevenDaysAgo.toISOString());

  // Get recent check-outs (last 7 days)
  const { count: recentCheckOuts } = await supabaseServer
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('type', 'check_out')
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
