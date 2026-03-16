// Redkik calls must run through a trusted backend (Supabase Edge Function).
// Do not place Redkik client secrets in the mobile app bundle.

import { logger } from './logger';
import { invokeRedkikQuote } from './repositories/redkikRepository';
import { normalizeError } from './errorService';

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
      const { data, error } = await invokeRedkikQuote({ action: 'setup' });

      if (error) {
        logger.warn('RedkikService', 'Setup request failed', error?.message || error);
        return null;
      }

      if (data?.error) {
        logger.warn('RedkikService', 'Setup returned error', data.error);
        return null;
      }

      logger.info('RedkikService', 'Setup response', data);
      return data;
    } catch (error) {
      const normalized = normalizeError(error, 'Redkik setup request failed');
      logger.warn('RedkikService', 'getSetup exception', normalized, error);
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
      const { data, error } = await invokeRedkikQuote({
        action: 'get-quote',
        payload: {
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
        logger.warn('RedkikService', 'Quote request failed', error?.message || error);
        return null;
      }

      if (data?.error) {
        logger.warn('RedkikService', 'Quote returned error', data.error);
        return null;
      }

      logger.info('RedkikService', 'Quote response', data);

      if (!data.offerId) {
        logger.warn('RedkikService', 'Quote missing offerId; check Edge Function logs');
        return null;
      }
      if (Number(data.premium) <= 0) {
        logger.warn('RedkikService', 'Quote has invalid premium', data.premium);
        return null;
      }

      return {
        offerId: data.offerId,
        premium: Number(data.premium),
        canPurchase: data.canPurchase !== false, // default true if field missing
        amendments: data.amendments || [],
        details: data.details || {},
      };
    } catch (error) {
      const normalized = normalizeError(error, 'Redkik quote request failed');
      logger.warn('RedkikService', 'getQuote exception', normalized, error);
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
      const { data, error } = await invokeRedkikQuote({
        action: 'purchase',
        payload: { offerId },
      });

      if (error) {
        logger.warn('RedkikService', 'Purchase failed', error?.message || error);
        return null;
      }

      if (data?.error) {
        logger.warn('RedkikService', 'Purchase returned error', data.error);
        return null;
      }

      logger.info('RedkikService', 'Purchase response', data);

      if (!data.bookingId) {
        logger.warn('RedkikService', 'Purchase missing bookingId; check Edge Function logs');
        return null;
      }

      return {
        bookingId: data.bookingId,
      };
    } catch (error) {
      const normalized = normalizeError(error, 'Redkik purchase request failed');
      logger.warn('RedkikService', 'purchaseInsurance exception', normalized, error);
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
      const { data, error } = await invokeRedkikQuote({
        action: 'complete',
        payload: { bookingId },
      });

      if (error) {
        logger.warn('RedkikService', 'Complete failed', error?.message || error);
        return null;
      }

      if (data?.error) {
        logger.warn('RedkikService', 'Complete returned error', data.error);
        return null;
      }

      logger.info('RedkikService', 'Complete response', data);
      return { success: true, bookingId };
    } catch (error) {
      const normalized = normalizeError(error, 'Redkik complete request failed');
      logger.warn('RedkikService', 'completeBooking exception', normalized, error);
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
      const { data, error } = await invokeRedkikQuote({
        action: 'cancel',
        payload: { bookingId },
      });

      if (error) {
        logger.warn('RedkikService', 'Cancel failed', error?.message || error);
        return null;
      }

      if (data?.error) {
        logger.warn('RedkikService', 'Cancel returned error', data.error);
        return null;
      }

      logger.info('RedkikService', 'Cancel response', data);
      return { success: true, bookingId };
    } catch (error) {
      const normalized = normalizeError(error, 'Redkik cancel request failed');
      logger.warn('RedkikService', 'cancelBooking exception', normalized, error);
      return null;
    }
  },
};

export default RedkikService;
