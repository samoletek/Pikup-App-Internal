import { supabase } from '../../config/supabase';

/**
 * Pricing repository centralizes remote pricing config reads.
 */
export const fetchPricingConfigRows = async () => {
  return supabase
    .from('pricing_config')
    .select('id, value');
};
