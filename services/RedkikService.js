// Redkik calls must run through a trusted backend.
// Do not place Redkik client secrets in the mobile app bundle.

const REDKIK_PROXY_BASE_URL =
  process.env.EXPO_PUBLIC_REDKIK_PROXY_BASE_URL ||
  process.env.EXPO_PUBLIC_PAYMENT_SERVICE_URL ||
  null;

const buildProxyUrl = (path) => {
  if (!REDKIK_PROXY_BASE_URL) {
    throw new Error(
      'Redkik proxy is not configured. Set EXPO_PUBLIC_REDKIK_PROXY_BASE_URL.'
    );
  }

  const baseUrl = REDKIK_PROXY_BASE_URL.endsWith("/")
    ? REDKIK_PROXY_BASE_URL.slice(0, -1)
    : REDKIK_PROXY_BASE_URL;

  return `${baseUrl}${path}`;
};

const RedkikService = {
  async authenticate() {
    // Kept for compatibility with existing call sites.
    // Authentication is handled server-side by the proxy.
    return true;
  },

  async getQuote(bookingDetails) {
    const response = await fetch(buildProxyUrl('/redkik/quotes'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bookingDetails || {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Redkik quote request failed: ${response.status} ${errorText}`);
    }

    return await response.json();
  },
};

export default RedkikService;
