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
      type: 'check out',
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

  // Add search filter if provided
  if (search) {
    query = query.or(`notes.ilike.%${search}%,patient_reference_id.ilike.%${search}%`);
  }

  // Add pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to).order('timestamp', { ascending: false });

  const { data: transactions, error, count } = await query;

  if (error) {
    throw new Error(`Failed to get transactions: ${error.message}`);
  }

  return {
    transactions: transactions?.map(formatTransaction) || [],
    total: count || 0,
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
