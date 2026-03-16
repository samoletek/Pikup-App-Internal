import { supabase } from '../../config/supabase';
import type {
  RedkikQuoteAction,
  RedkikQuoteRequest,
  RedkikQuoteResponse,
} from '../../supabase/functions/_shared/contracts';

/**
 * Redkik repository centralizes edge-function invocation transport details.
 */
export const invokeRedkikQuote = async ({
  action,
  payload = {},
}: {
  action: RedkikQuoteAction;
  payload?: Omit<RedkikQuoteRequest, 'action'>;
}) => {
  return supabase.functions.invoke<RedkikQuoteResponse>('redkik-quote', {
    body: {
      action,
      ...payload,
    } satisfies RedkikQuoteRequest,
  });
};
