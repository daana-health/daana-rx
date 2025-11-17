import { supabaseServer } from '../utils/supabase';
import { Location, Lot } from '@/types';

/**
 * Create a new location
 */
export async function createLocation(
  name: string,
  temp: 'fridge' | 'room_temp',
  clinicId: string
): Promise<Location> {
  // Transform room_temp to 'room temp' for database
  const dbTemp = temp === 'room_temp' ? 'room temp' : temp;
  
  const { data: location, error } = await supabaseServer
    .from('locations')
    .insert({
      name,
      temp: dbTemp,
      clinic_id: clinicId,
    })
    .select()
    .single();

  if (error || !location) {
    throw new Error(`Failed to create location: ${error?.message}`);
  }

  return formatLocation(location);
}

/**
 * Get all locations for a clinic
 */
export async function getLocations(clinicId: string): Promise<Location[]> {
  const { data: locations, error } = await supabaseServer
    .from('locations')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get locations: ${error.message}`);
  }

  return locations?.map(formatLocation) || [];
}

/**
 * Get location by ID
 */
export async function getLocationById(locationId: string, clinicId: string): Promise<Location | null> {
  const { data: location, error } = await supabaseServer
    .from('locations')
    .select('*')
    .eq('location_id', locationId)
    .eq('clinic_id', clinicId)
    .single();

  if (error || !location) {
    return null;
  }

  return formatLocation(location);
}

/**
 * Update location
 */
export async function updateLocation(
  locationId: string,
  updates: {
    name?: string;
    temp?: 'fridge' | 'room_temp';
  },
  clinicId: string
): Promise<Location> {
  const updateData: Record<string, unknown> = {};

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.temp !== undefined) {
    // Transform room_temp to 'room temp' for database
    updateData.temp = updates.temp === 'room_temp' ? 'room temp' : updates.temp;
  }

  const { data: location, error } = await supabaseServer
    .from('locations')
    .update(updateData)
    .eq('location_id', locationId)
    .eq('clinic_id', clinicId)
    .select()
    .single();

  if (error || !location) {
    throw new Error(`Failed to update location: ${error?.message}`);
  }

  return formatLocation(location);
}

/**
 * Delete location
 */
export async function deleteLocation(locationId: string, clinicId: string): Promise<boolean> {
  // Check if location has any lots
  const { data: lots } = await supabaseServer
    .from('lots')
    .select('lot_id')
    .eq('location_id', locationId)
    .limit(1);

  if (lots && lots.length > 0) {
    throw new Error('Cannot delete location that has associated lots. Please reassign or delete lots first.');
  }

  const { error } = await supabaseServer
    .from('locations')
    .delete()
    .eq('location_id', locationId)
    .eq('clinic_id', clinicId);

  if (error) {
    throw new Error(`Failed to delete location: ${error.message}`);
  }

  return true;
}

/**
 * Create a new lot
 */
export async function createLot(
  source: string,
  locationId: string,
  clinicId: string,
  note?: string
): Promise<Lot> {
  // Verify location exists and belongs to clinic
  const location = await getLocationById(locationId, clinicId);
  if (!location) {
    throw new Error('Location not found or does not belong to your clinic');
  }

  const { data: lot, error } = await supabaseServer
    .from('lots')
    .insert({
      source,
      location_id: locationId,
      clinic_id: clinicId,
      note,
    })
    .select()
    .single();

  if (error || !lot) {
    throw new Error(`Failed to create lot: ${error?.message}`);
  }

  return formatLot(lot);
}

/**
 * Get all lots for a clinic
 */
export async function getLots(clinicId: string): Promise<Lot[]> {
  const { data: lots, error } = await supabaseServer
    .from('lots')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('date_created', { ascending: false });

  if (error) {
    throw new Error(`Failed to get lots: ${error.message}`);
  }

  return lots?.map(formatLot) || [];
}

/**
 * Get lot by ID
 */
export async function getLotById(lotId: string, clinicId: string): Promise<Lot | null> {
  const { data: lot, error } = await supabaseServer
    .from('lots')
    .select('*')
    .eq('lot_id', lotId)
    .eq('clinic_id', clinicId)
    .single();

  if (error || !lot) {
    return null;
  }

  return formatLot(lot);
}

/**
 * Format location data from database
 */
function formatLocation(location: any): Location {
  // Transform 'room temp' from database to 'room_temp' for GraphQL
  const temp = location.temp === 'room temp' ? 'room_temp' : location.temp;
  
  return {
    locationId: location.location_id,
    name: location.name,
    temp: temp,
    clinicId: location.clinic_id,
    createdAt: new Date(location.created_at),
    updatedAt: new Date(location.updated_at),
  };
}

/**
 * Format lot data from database
 */
function formatLot(lot: any): Lot {
  return {
    lotId: lot.lot_id,
    source: lot.source,
    note: lot.note,
    dateCreated: new Date(lot.date_created),
    locationId: lot.location_id,
    clinicId: lot.clinic_id,
  };
}
