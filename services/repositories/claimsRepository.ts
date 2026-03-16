import { supabase } from '../../config/supabase';
import type { ClaimRequest } from '../contracts/domain';
import type {
  SubmitClaimRequest,
  SubmitClaimResponse,
} from '../../supabase/functions/_shared/contracts';

type SubmitClaimPayload = SubmitClaimRequest & ClaimRequest;

/**
 * Claims repository is the only transport-aware access point for claims storage/functions.
 */
export const fetchClaimsByUserId = async (userId: string) => {
  return supabase
    .from('claims')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
};

export const invokeSubmitClaim = async (payload: SubmitClaimPayload) => {
  return supabase.functions.invoke<SubmitClaimResponse>('submit-claim', { body: payload });
};
