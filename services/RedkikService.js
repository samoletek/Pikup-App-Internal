// Redkik calls must run through a trusted backend (Supabase Edge Function).
// Do not place Redkik client secrets in the mobile app bundle.

import { supabase } from '../config/supabase';

const RedkikService = {
  /**
   * Fetch setup data from Redkik (commodities, currencies, policies).
   * Useful for verifying configuration — not required before quoting
   * since the Edge Function calls setup internally.
   *
   * @returns {Promise<Object|null>}
   */
  async getSetup() {
    try {
      const { data, error } = await supabase.functions.invoke('redkik-quote', {
        body: { action: 'setup' },
      });

      if (error) {
        console.warn('Redkik setup request failed:', error.message || error);
        return null;
      }

      if (data?.error) {
        console.warn('Redkik setup returned error:', data.error);
        return null;
      }

      console.log('[RedkikService] Setup response:', JSON.stringify(data, null, 2));
      return data;
    } catch (err) {
      console.warn('Redkik getSetup exception:', err);
      return null;
    }
  },

  /**
   * Request an insurance quote for eligible items.
   * The Edge Function handles Setup -> Quote internally.
   * Returns null on failure — insurance errors must never block orders.
   *
   * @param {Object} params
   * @param {Array}  params.items   - Items with name, value, weight, condition
   * @param {Object} params.pickup  - { address, coordinates }
   * @param {Object} params.dropoff - { address, coordinates }
   * @param {string|null} params.scheduledTime - ISO string or null
   * @param {number|null} params.durationMinutes
   * @param {string}      params.customerEmail
   * @param {string}      params.customerName
   * @returns {Promise<{ offerId: string, premium: number, canPurchase: boolean, amendments: Array, details: Object } | null>}
   */
  async getQuote({ items, pickup, dropoff, scheduledTime, durationMinutes, customerEmail, customerName }) {
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
          durationMinutes: durationMinutes || null,
          customerEmail: customerEmail || null,
          customerName: customerName || null,
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
        console.warn('[RedkikService] Quote missing offerId — check Edge Function logs');
        return null;
      }
      if (Number(data.premium) <= 0) {
        console.warn('[RedkikService] Quote has invalid premium:', data.premium);
        return null;
      }

      return {
        offerId: data.offerId,
        premium: Number(data.premium),
        canPurchase: data.canPurchase !== false, // default true if field missing
        amendments: data.amendments || [],
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
        console.warn('[RedkikService] Purchase missing bookingId — check Edge Function logs');
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

  /**
   * Complete a booking after successful delivery.
   * Should be called when driver finishes the trip.
   *
   * @param {string} bookingId - The bookingId from purchaseInsurance()
   * @returns {Promise<{ success: boolean } | null>}
   */
  async completeBooking(bookingId) {
    if (!bookingId) return null;

    try {
      const { data, error } = await supabase.functions.invoke('redkik-quote', {
        body: {
          action: 'complete',
          bookingId,
        },
      });

      if (error) {
        console.warn('Redkik complete failed:', error.message || error);
        return null;
      }

      if (data?.error) {
        console.warn('Redkik complete returned error:', data.error);
        return null;
      }

      console.log('[RedkikService] Complete response:', JSON.stringify(data, null, 2));
      return { success: true, bookingId };
    } catch (err) {
      console.warn('Redkik completeBooking exception:', err);
      return null;
    }
  },

  /**
   * Cancel a booking (e.g. when order is cancelled before delivery).
   *
   * @param {string} bookingId - The bookingId from purchaseInsurance()
   * @returns {Promise<{ success: boolean } | null>}
   */
  async cancelBooking(bookingId) {
    if (!bookingId) return null;

    try {
      const { data, error } = await supabase.functions.invoke('redkik-quote', {
        body: {
          action: 'cancel',
          bookingId,
        },
      });

      if (error) {
        console.warn('Redkik cancel failed:', error.message || error);
        return null;
      }

      if (data?.error) {
        console.warn('Redkik cancel returned error:', data.error);
        return null;
      }

      console.log('[RedkikService] Cancel response:', JSON.stringify(data, null, 2));
      return { success: true, bookingId };
    } catch (err) {
      console.warn('Redkik cancelBooking exception:', err);
      return null;
    }
  },
};

export default RedkikService;
