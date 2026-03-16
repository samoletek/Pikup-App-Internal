import { supabase } from '../../config/supabase';

export const getAuthenticatedUser = async () => {
  return supabase.auth.getUser();
};

export const updateAuthenticatedUserMetadata = async (metadata: Record<string, unknown>) => {
  return supabase.auth.updateUser({
    data: metadata,
  });
};
