import { supabase } from '../../config/supabase';
import type { TripRequest } from '../contracts/domain';
import type {
  DriverRequestPoolRequest,
  DriverRequestPoolResponse,
} from '../../supabase/functions/_shared/contracts';

const DRIVER_REQUEST_POOL_FUNCTION = 'get-driver-request-pool';
const DRIVER_PREFERENCE_SELECT_COLUMNS = [
  'metadata',
  'pref_pickup_small_items',
  'pref_pickup_medium_items',
  'pref_pickup_large_items',
  'pref_pickup_extra_large_items',
  'pref_pickup_fragile_items',
  'pref_pickup_outdoor_items',
  'pref_equipment_dolly',
  'pref_equipment_hand_truck',
  'pref_equipment_moving_straps',
  'pref_equipment_heavy_duty_gloves',
  'pref_equipment_furniture_pads',
  'pref_equipment_tool_set',
  'pref_equipment_rope',
  'pref_equipment_tarp',
  'pref_vehicle_truck_bed',
  'pref_vehicle_trailer',
  'pref_vehicle_large_van',
  'pref_vehicle_suv_space',
  'pref_vehicle_roof_rack',
  'pref_team_willing_to_help',
  'pref_team_needs_extra_hand',
  'pref_mode_solo',
  'pref_mode_team',
  'pref_mode_both',
  'pref_availability_weekends',
  'pref_availability_evenings',
  'pref_availability_short_notice',
  'pref_availability_long_distance',
].join(',');

/**
 * Trip repository centralizes transport-level access for trip/request-related storage and edge functions.
 */
export const invokeDriverRequestPool = async (payload: DriverRequestPoolRequest) => {
  return supabase.functions.invoke<DriverRequestPoolResponse>(DRIVER_REQUEST_POOL_FUNCTION, {
    body: payload,
  });
};

export const fetchDriverMetadata = async (driverId: string) => {
  return supabase
    .from('drivers')
    .select(DRIVER_PREFERENCE_SELECT_COLUMNS)
    .eq('id', driverId)
    .maybeSingle();
};

export const fetchCustomersByIds = async (customerIds: string[]) => {
  return supabase
    .from('customers')
    .select('id, first_name, last_name, email')
    .in('id', customerIds);
};

export const fetchPendingTrips = async (pendingTripStatus: string) => {
  return supabase
    .from('trips')
    .select('*')
    .eq('status', pendingTripStatus);
};

export const insertTripWithSelect = async (tripData: TripRequest) => {
  return supabase
    .from('trips')
    .insert(tripData)
    .select()
    .single();
};

export const fetchTripsByParticipantId = async (userId: string) => {
  return supabase
    .from('trips')
    .select('*')
    .or(`customer_id.eq.${userId},driver_id.eq.${userId}`)
    .order('created_at', { ascending: false });
};

export const fetchExpiredPendingTrips = async (pendingStatus: string, nowIso: string) => {
  return supabase
    .from('trips')
    .select('*')
    .eq('status', pendingStatus)
    .lt('expires_at', nowIso);
};

export const resetPendingUnassignedTripById = async (
  requestId: string,
  pendingStatus: string,
  updates: Partial<TripRequest>,
) => {
  return supabase
    .from('trips')
    .update(updates)
    .eq('id', requestId)
    .eq('status', pendingStatus)
    .is('driver_id', null)
    .select('id');
};

export const fetchTripExpiryById = async (requestId: string) => {
  return supabase
    .from('trips')
    .select('expires_at')
    .eq('id', requestId)
    .single();
};

export const updateTripById = async (requestId: string, updates: Partial<TripRequest>) => {
  return supabase
    .from('trips')
    .update(updates)
    .eq('id', requestId);
};

export const fetchTripColumnsById = async (requestId: string, columns: string) => {
  return supabase
    .from('trips')
    .select(columns)
    .eq('id', requestId)
    .single();
};

export const fetchTripColumnsByIdMaybeSingle = async (requestId: string, columns: string) => {
  return supabase
    .from('trips')
    .select(columns)
    .eq('id', requestId)
    .maybeSingle();
};

export const acceptPendingTripForDriver = async ({
  requestId,
  driverId,
  pendingStatus,
  acceptedStatus,
  updatedAt,
}: {
  requestId: string;
  driverId: string;
  pendingStatus: string;
  acceptedStatus: string;
  updatedAt: string;
}) => {
  const driverMatchOrNull = `driver_id.is.null,driver_id.eq.${driverId}`;
  return supabase
    .from('trips')
    .update({
      status: acceptedStatus,
      driver_id: driverId,
      updated_at: updatedAt,
    })
    .eq('id', requestId)
    .eq('status', pendingStatus)
    .or(driverMatchOrNull);
};

export const invokeTripRpc = async (rpcName: string, payload: Record<string, unknown>) => {
  return supabase.rpc(rpcName, payload);
};

export const fetchTripsByDriverId = async ({
  driverId,
  columns = '*',
  status,
  ascending = false,
}: {
  driverId: string;
  columns?: string;
  status?: string;
  ascending?: boolean;
}) => {
  let query = supabase
    .from('trips')
    .select(columns)
    .eq('driver_id', driverId);

  if (status) {
    query = query.eq('status', status);
  }

  return query.order('created_at', { ascending });
};

export const createRealtimeChannel = (channelName: string) => {
  return supabase.channel(channelName);
};

export const removeRealtimeChannel = (channel: unknown) => {
  return supabase.removeChannel(channel as Parameters<typeof supabase.removeChannel>[0]);
};
