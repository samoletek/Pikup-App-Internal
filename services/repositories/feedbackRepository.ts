import { supabase } from '../../config/supabase';
import type {
  SubmitFeedbackRequest,
  SubmitFeedbackResponse,
} from '../../supabase/functions/_shared/contracts';

type RowPayload = Record<string, unknown>;
type ProfileTableName = 'drivers' | 'customers';

/**
 * Feedback repository centralizes transport-level access for feedback writes/reads and related profile updates.
 */
export const invokeSubmitFeedback = async (payload: SubmitFeedbackRequest) => {
  return supabase.functions.invoke<SubmitFeedbackResponse>('submit-feedback', {
    body: payload,
  });
};

export const fetchFeedbackIdsByRequestAndUser = async (requestId: string, userId: string) => {
  return supabase
    .from('feedbacks')
    .select('id')
    .eq('request_id', requestId)
    .eq('user_id', userId)
    .limit(1);
};

export const fetchProfileByTableAndId = async (tableName: string, userId: string) => {
  return supabase
    .from(tableName)
    .select('*')
    .eq('id', userId)
    .maybeSingle();
};

export const updateProfileByTableAndId = async (
  tableName: string,
  userId: string,
  updates: RowPayload,
) => {
  return supabase
    .from(tableName)
    .update(updates)
    .eq('id', userId);
};

export const insertFeedbackRow = async (payload: RowPayload) => {
  return supabase
    .from('feedbacks')
    .insert(payload);
};

export const insertFeedbackRowWithSelect = async (payload: RowPayload) => {
  return supabase
    .from('feedbacks')
    .insert(payload)
    .select()
    .single();
};

export const fetchProfileRatingSnapshotByTable = async (
  tableName: ProfileTableName,
  userId: string,
) => {
  return supabase
    .from(tableName)
    .select('*')
    .eq('id', userId)
    .maybeSingle();
};

export const updateProfileRatingSnapshotByTable = async (
  tableName: ProfileTableName,
  userId: string,
  updates: RowPayload,
) => {
  return supabase
    .from(tableName)
    .update(updates)
    .eq('id', userId);
};

export const fetchFeedbackRowsByDriver = async (driverId: string, limit: number) => {
  return supabase
    .from('feedbacks')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(limit);
};

type LatestFeedbackQueryParams = {
  requestId: string;
  userId: string;
  includeBadges?: boolean;
};

export const fetchLatestTripFeedbackRowsByUser = async ({
  requestId,
  userId,
  includeBadges = true,
}: LatestFeedbackQueryParams) => {
  return supabase
    .from('feedbacks')
    .select(
      includeBadges
        ? 'id,request_id,user_id,rating,badges,created_at'
        : 'id,request_id,user_id,rating,created_at',
    )
    .eq('request_id', requestId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
};
