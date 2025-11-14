import { supabaseServer } from '../utils/supabase';
import { Transaction, CheckOutRequest } from '../../src/types/index';

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
      patient_reference_id: input.patientReferenceId,
      user_id: userId,
      notes: input.notes,
      clinic_id: clinicId,
    })
    .select(`
      *,
      unit:units(*),
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
      unit:units(*, drug:drugs(*)),
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
      unit:units(*, drug:drugs(*)),
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
      unit:units(*, drug:drugs(*)),
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
function formatTransaction(transaction: any): Transaction {
  return {
    transactionId: transaction.transaction_id,
    timestamp: new Date(transaction.timestamp),
    type: transaction.type,
    quantity: transaction.quantity,
    unitId: transaction.unit_id,
    patientReferenceId: transaction.patient_reference_id,
    userId: transaction.user_id,
    notes: transaction.notes,
    clinicId: transaction.clinic_id,
  };
}
