import { supabaseServer } from '../utils/supabase';
import { Transaction, CheckOutRequest } from '@/types';

/**
 * FEFO Checkout Result
 */
export interface FEFOCheckoutResult {
  transactions: Transaction[];
  totalQuantityDispensed: number;
  unitsUsed: Array<{
    unitId: string;
    quantityTaken: number;
    expiryDate: string;
    medicationName: string;
  }>;
}

/**
 * FEFO Checkout Request
 */
export interface FEFOCheckoutRequest {
  ndcId?: string;
  medicationName?: string;
  strength?: number;
  strengthUnit?: string;
  quantity: number;
  patientName?: string;
  patientReferenceId?: string;
  notes?: string;
}

/**
 * Check out medication using FEFO (First Expired, First Out) logic
 * Finds units with matching medication and pulls from units expiring first
 */
export async function checkOutMedicationFEFO(
  input: FEFOCheckoutRequest,
  userId: string,
  clinicId: string
): Promise<FEFOCheckoutResult> {
  // Validate input - must have either NDC or name+strength
  if (!input.ndcId && (!input.medicationName || !input.strength || !input.strengthUnit)) {
    throw new Error('Must provide either NDC or medication name with strength and unit');
  }

  if (input.quantity <= 0) {
    throw new Error('Quantity must be greater than 0');
  }

  // Find all matching units with available quantity, ordered by expiry date (FEFO)
  let query = supabaseServer
    .from('units')
    .select(`
      *,
      drug:drugs(*)
    `)
    .eq('clinic_id', clinicId)
    .gt('available_quantity', 0)
    .order('expiry_date', { ascending: true });

  // Add drug matching criteria
  if (input.ndcId) {
    // Match by NDC
    const { data: drug } = await supabaseServer
      .from('drugs')
      .select('drug_id')
      .eq('ndc_id', input.ndcId)
      .single();
    
    if (!drug) {
      throw new Error(`No medication found with NDC: ${input.ndcId}`);
    }
    
    query = query.eq('drug_id', drug.drug_id);
  } else {
    // Match by name and strength
    const { data: drugs } = await supabaseServer
      .from('drugs')
      .select('drug_id')
      .ilike('medication_name', input.medicationName!)
      .eq('strength', input.strength!)
      .eq('strength_unit', input.strengthUnit!);
    
    if (!drugs || drugs.length === 0) {
      throw new Error(`No medication found matching: ${input.medicationName} ${input.strength}${input.strengthUnit}`);
    }
    
    const drugIds = drugs.map(d => d.drug_id);
    query = query.in('drug_id', drugIds);
  }

  const { data: units, error: unitsError } = await query;

  if (unitsError) {
    throw new Error(`Failed to fetch units: ${unitsError.message}`);
  }

  if (!units || units.length === 0) {
    throw new Error('No units available for this medication');
  }

  // Calculate total available quantity
  const totalAvailable = units.reduce((sum, unit) => sum + unit.available_quantity, 0);
  
  if (totalAvailable < input.quantity) {
    throw new Error(
      `Insufficient quantity. Available: ${totalAvailable}, Requested: ${input.quantity}`
    );
  }

  // Distribute quantity across units (FEFO)
  let remainingQuantity = input.quantity;
  const transactions: Transaction[] = [];
  const unitsUsed: Array<{
    unitId: string;
    quantityTaken: number;
    expiryDate: string;
    medicationName: string;
  }> = [];

  for (const unit of units) {
    if (remainingQuantity <= 0) break;

    const quantityToTake = Math.min(remainingQuantity, unit.available_quantity);
    const newAvailableQuantity = unit.available_quantity - quantityToTake;

    // Update unit quantity
    const { error: updateError } = await supabaseServer
      .from('units')
      .update({ available_quantity: newAvailableQuantity })
      .eq('unit_id', unit.unit_id);

    if (updateError) {
      // Rollback previous updates
      for (const usedUnit of unitsUsed) {
        const { data: rollbackUnit } = await supabaseServer
          .from('units')
          .select('available_quantity')
          .eq('unit_id', usedUnit.unitId)
          .single();
        
        if (rollbackUnit) {
          await supabaseServer
            .from('units')
            .update({ 
              available_quantity: rollbackUnit.available_quantity + usedUnit.quantityTaken
            })
            .eq('unit_id', usedUnit.unitId);
        }
      }
      throw new Error(`Failed to update unit: ${updateError.message}`);
    }

    // Create transaction
    const { data: transaction, error: transactionError } = await supabaseServer
      .from('transactions')
      .insert({
        type: 'check_out',
        quantity: quantityToTake,
        unit_id: unit.unit_id,
        patient_name: input.patientName,
        patient_reference_id: input.patientReferenceId,
        user_id: userId,
        notes: input.notes || `FEFO checkout - Unit ${unitsUsed.length + 1} of batch`,
        clinic_id: clinicId,
      })
      .select(`
        *,
        unit:units!transactions_unit_clinic_fkey(*, drug:drugs(*)),
        user:users(*)
      `)
      .single();

    if (transactionError || !transaction) {
      // Rollback all updates
      for (const usedUnit of unitsUsed) {
        const { data: rollbackUnit } = await supabaseServer
          .from('units')
          .select('available_quantity')
          .eq('unit_id', usedUnit.unitId)
          .single();
        
        if (rollbackUnit) {
          await supabaseServer
            .from('units')
            .update({ 
              available_quantity: rollbackUnit.available_quantity + usedUnit.quantityTaken
            })
            .eq('unit_id', usedUnit.unitId);
        }
      }
      // Rollback current unit
      await supabaseServer
        .from('units')
        .update({ available_quantity: unit.available_quantity })
        .eq('unit_id', unit.unit_id);

      throw new Error(`Failed to create transaction: ${transactionError?.message}`);
    }

    transactions.push(formatTransaction(transaction));
    unitsUsed.push({
      unitId: unit.unit_id,
      quantityTaken: quantityToTake,
      expiryDate: unit.expiry_date,
      medicationName: unit.drug.medication_name,
    });

    remainingQuantity -= quantityToTake;
  }

  return {
    transactions,
    totalQuantityDispensed: input.quantity,
    unitsUsed,
  };
}

/**
 * Check out a unit (dispense medication)
 */
export async function checkOutUnit(
  input: CheckOutRequest,
  userId: string,
  clinicId: string
): Promise<Transaction> {
  // Get the unit
  const { data: unit, error: unitError } = await supabaseServer
    .from('units')
    .select('*')
    .eq('unit_id', input.unitId)
    .eq('clinic_id', clinicId)
    .single();

  if (unitError || !unit) {
    throw new Error('Unit not found');
  }

  // Validate quantity
  if (unit.available_quantity < input.quantity) {
    throw new Error(
      `Insufficient quantity. Available: ${unit.available_quantity}, Requested: ${input.quantity}`
    );
  }

  // Update unit quantity
  const newAvailableQuantity = unit.available_quantity - input.quantity;
  const { error: updateError } = await supabaseServer
    .from('units')
    .update({ available_quantity: newAvailableQuantity })
    .eq('unit_id', input.unitId);

  if (updateError) {
    throw new Error(`Failed to update unit: ${updateError.message}`);
  }

  // Create transaction
  const { data: transaction, error: transactionError } = await supabaseServer
    .from('transactions')
    .insert({
      type: 'check_out',
      quantity: input.quantity,
      unit_id: input.unitId,
      patient_name: input.patientName,
      patient_reference_id: input.patientReferenceId,
      user_id: userId,
      notes: input.notes,
      clinic_id: clinicId,
    })
    .select(`
      *,
      unit:units!transactions_unit_clinic_fkey(*),
      user:users(*)
    `)
    .single();

  if (transactionError || !transaction) {
    // Rollback unit update
    await supabaseServer
      .from('units')
      .update({ available_quantity: unit.available_quantity })
      .eq('unit_id', input.unitId);

    throw new Error(`Failed to create transaction: ${transactionError?.message}`);
  }

  return formatTransaction(transaction);
}

/**
 * Get transactions with pagination
 */
export async function getTransactions(
  clinicId: string,
  page: number = 1,
  pageSize: number = 50,
  search?: string,
  unitId?: string
) {
  let query = supabaseServer
    .from('transactions')
    .select(`
      *,
      unit:units!transactions_unit_clinic_fkey(*, drug:drugs(*), lot:lots!units_lot_clinic_fkey(*, location:locations!lots_location_clinic_fkey(*))),
      user:users(*)
    `, { count: 'exact' })
    .eq('clinic_id', clinicId);

  // Filter by unit if provided
  if (unitId) {
    query = query.eq('unit_id', unitId);
  }

  // Add pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to).order('timestamp', { ascending: false });

  const { data: transactions, error, count } = await query;

  // Apply fuzzy search filtering on the client side for joined fields
  let filteredTransactions = transactions || [];
  if (search && filteredTransactions.length > 0) {
    const searchLower = search.toLowerCase();
    filteredTransactions = filteredTransactions.filter((tx: any) => {
      return (
        // Search in notes
        (tx.notes && tx.notes.toLowerCase().includes(searchLower)) ||
        // Search in patient reference ID
        (tx.patient_reference_id && tx.patient_reference_id.toLowerCase().includes(searchLower)) ||
        // Search in transaction type
        (tx.type && tx.type.toLowerCase().includes(searchLower)) ||
        // Search in quantity (convert to string)
        (tx.quantity && tx.quantity.toString().includes(searchLower)) ||
        // Search in user name
        (tx.user && tx.user.username && tx.user.username.toLowerCase().includes(searchLower)) ||
        (tx.user && tx.user.email && tx.user.email.toLowerCase().includes(searchLower)) ||
        // Search in drug/medication name
        (tx.unit && tx.unit.drug && tx.unit.drug.medication_name && 
          tx.unit.drug.medication_name.toLowerCase().includes(searchLower)) ||
        (tx.unit && tx.unit.drug && tx.unit.drug.generic_name && 
          tx.unit.drug.generic_name.toLowerCase().includes(searchLower))
      );
    });
  }

  if (error) {
    throw new Error(`Failed to get transactions: ${error.message}`);
  }

  return {
    transactions: filteredTransactions.map(formatTransaction),
    total: search ? filteredTransactions.length : (count || 0),
    page,
    pageSize,
  };
}

/**
 * Get transaction by ID
 */
export async function getTransactionById(
  transactionId: string,
  clinicId: string
): Promise<Transaction | null> {
  const { data: transaction, error } = await supabaseServer
    .from('transactions')
    .select(`
      *,
      unit:units!transactions_unit_clinic_fkey(*, drug:drugs(*)),
      user:users(*)
    `)
    .eq('transaction_id', transactionId)
    .eq('clinic_id', clinicId)
    .single();

  if (error || !transaction) {
    return null;
  }

  return formatTransaction(transaction);
}

/**
 * Update transaction (superadmin only)
 */
export async function updateTransaction(
  transactionId: string,
  updates: {
    quantity?: number;
    notes?: string;
  },
  clinicId: string
): Promise<Transaction> {
  const updateData: Record<string, unknown> = {};

  if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
  if (updates.notes !== undefined) updateData.notes = updates.notes;

  const { data: transaction, error } = await supabaseServer
    .from('transactions')
    .update(updateData)
    .eq('transaction_id', transactionId)
    .eq('clinic_id', clinicId)
    .select(`
      *,
      unit:units!transactions_unit_clinic_fkey(*, drug:drugs(*)),
      user:users(*)
    `)
    .single();

  if (error || !transaction) {
    throw new Error(`Failed to update transaction: ${error?.message}`);
  }

  return formatTransaction(transaction);
}

/**
 * Format transaction data from database
 */
function formatTransaction(transaction: any): any {
  const formatted: any = {
    transactionId: transaction.transaction_id,
    timestamp: new Date(transaction.timestamp),
    type: transaction.type,
    quantity: transaction.quantity,
    unitId: transaction.unit_id,
    patientName: transaction.patient_name,
    patientReferenceId: transaction.patient_reference_id,
    userId: transaction.user_id,
    notes: transaction.notes,
    clinicId: transaction.clinic_id,
  };

  // Include user if available
  if (transaction.user) {
    formatted.user = {
      userId: transaction.user.user_id,
      username: transaction.user.username,
      email: transaction.user.email,
      clinicId: transaction.user.clinic_id,
      userRole: transaction.user.user_role,
      createdAt: new Date(transaction.user.created_at),
      updatedAt: new Date(transaction.user.updated_at),
    };
  }

  // Include unit if available
  if (transaction.unit) {
    formatted.unit = {
      unitId: transaction.unit.unit_id,
      totalQuantity: transaction.unit.total_quantity,
      availableQuantity: transaction.unit.available_quantity,
      expiryDate: transaction.unit.expiry_date,
      optionalNotes: transaction.unit.optional_notes,
      lotId: transaction.unit.lot_id,
      drugId: transaction.unit.drug_id,
      userId: transaction.unit.user_id,
      clinicId: transaction.unit.clinic_id,
    };

    // Include drug if available
    if (transaction.unit.drug) {
      formatted.unit.drug = {
        drugId: transaction.unit.drug.drug_id,
        medicationName: transaction.unit.drug.medication_name,
        genericName: transaction.unit.drug.generic_name,
        strength: transaction.unit.drug.strength,
        strengthUnit: transaction.unit.drug.strength_unit,
        ndcId: transaction.unit.drug.ndc_id,
        form: transaction.unit.drug.form,
      };
    }

    // Include lot if available
    if (transaction.unit.lot) {
      formatted.unit.lot = {
        lotId: transaction.unit.lot.lot_id,
        source: transaction.unit.lot.source,
        note: transaction.unit.lot.note,
        dateCreated: transaction.unit.lot.date_created,
        locationId: transaction.unit.lot.location_id,
        clinicId: transaction.unit.lot.clinic_id,
      };

      // Include location if available
      if (transaction.unit.lot.location) {
        // Normalize temp to GraphQL enum values (DB uses "room temp")
        const temp =
          transaction.unit.lot.location.temp === 'room temp'
            ? 'room_temp'
            : transaction.unit.lot.location.temp;

        formatted.unit.lot.location = {
          locationId: transaction.unit.lot.location.location_id,
          name: transaction.unit.lot.location.name,
          temp,
          clinicId: transaction.unit.lot.location.clinic_id,
        };
      }
    }
  }

  return formatted;
}
