// Redkik calls must run through a trusted backend (Supabase Edge Function).
// Do not place Redkik client secrets in the mobile app bundle.

import { supabase } from '../config/supabase';

const RedkikService = {
  /**
   * Request an insurance quote for eligible items.
   * Returns null on failure — insurance errors must never block orders.
   *
   * @param {Object} params
   * @param {Array}  params.items   - Items with name, value, weight, condition
   * @param {Object} params.pickup  - { address, coordinates }
   * @param {Object} params.dropoff - { address, coordinates }
   * @param {string|null} params.scheduledTime - ISO string or null
   * @returns {Promise<{ offerId: string, premium: number, details: Object } | null>}
   */
  async getQuote({ items, pickup, dropoff, scheduledTime }) {
    try {
      const { data, error } = await supabase.functions.invoke('redkik-quote', {
        body: {
          action: 'get-quote',
          items: (items || []).map(item => ({
            name: item.name || 'Item',
            description: item.description || '',
            value: Number(item.value) || 0,
            weight: Number(item.weightEstimate || item.weight) || 0,
            condition: item.condition || 'new',
          })),
          pickup,
          dropoff,
          scheduledTime: scheduledTime || null,
        },
      });

      if (error) {
        console.warn('Redkik quote request failed:', error.message || error);
        return null;
      }

      if (data?.error) {
        console.warn('Redkik quote returned error:', data.error);
        return null;
      }

      console.log('[RedkikService] Quote response:', JSON.stringify(data, null, 2));

      if (!data.offerId) {
        console.warn('[RedkikService] Quote missing offerId — check Edge Function logs for raw Redkik response');
        return null;
      }
      if (Number(data.premium) <= 0) {
        console.warn('[RedkikService] Quote has invalid premium:', data.premium);
        return null;
      }

      return {
        offerId: data.offerId,
        premium: Number(data.premium),
        details: data.details || {},
      };
    } catch (err) {
      console.warn('Redkik getQuote exception:', err);
      return null;
    }
  },

  /**
   * Purchase insurance for a confirmed quote.
   * Returns null on failure — order creation must proceed regardless.
   *
   * @param {string} offerId - The offerId from getQuote()
   * @returns {Promise<{ bookingId: string } | null>}
   */
  async purchaseInsurance(offerId) {
    if (!offerId) return null;

    try {
      const { data, error } = await supabase.functions.invoke('redkik-quote', {
        body: {
          action: 'purchase',
          offerId,
        },
      });

      if (error) {
        console.warn('Redkik purchase failed:', error.message || error);
        return null;
      }

      if (data?.error) {
        console.warn('Redkik purchase returned error:', data.error);
        return null;
      }

      console.log('[RedkikService] Purchase response:', JSON.stringify(data, null, 2));

      if (!data.bookingId) {
        console.warn('[RedkikService] Purchase missing bookingId — check Edge Function logs for raw Redkik response');
        return null;
      }

      return {
        bookingId: data.bookingId,
      };
    } catch (err) {
      console.warn('Redkik purchaseInsurance exception:', err);
      return null;
    }
  },
};

export default RedkikService;
