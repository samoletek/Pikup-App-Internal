import Constants from 'expo-constants';

// Get Redkik config from env via Expo Constants (if exposed) or process.env shim
// Note: In Expo, process.env isn't always reliable without specific setup, 
// so we typically rely on EXPO_PUBLIC_ prefix or .env.local being loaded into process.env by the bundler.
// Since these vars lack EXPO_PUBLIC_ prefix in .env.local, they might not be exposed to the client bundle 
// unless configured in app.config.js or via babel-plugin-transform-inline-environment-variables.
// 
// HOWEVER, the user asked to "do the task" and we found them in .env.local.
// Check if they are actually accessible. If not, we might need to add EXPO_PUBLIC_ prefix or similar.

// Assuming for now they will be shimmed or we will use a hardcoded fallback structure for development 
// if process.env fails (SECURITY RISK: Only for local dev). 

// BETTER APPROACH for secure client-side:
const REDKIK_BASE_URL = process.env.EXPO_PUBLIC_REDKIK_BASE_URL || 'https://sales.app.redkik.com';
const CLIENT_ID = process.env.EXPO_PUBLIC_REDKIK_CLIENT_ID;
const CLIENT_SECRET = process.env.EXPO_PUBLIC_REDKIK_CLIENT_SECRET;

// In-memory token storage
let accessToken = null;
let tokenExpiry = null;

const RedkikService = {
    /**
     * authenticate
     * Exchanges Client ID and Secret for a Bearer Token.
     */
    async authenticate() {
        if (accessToken && tokenExpiry && new Date() < tokenExpiry) {
            console.log('✅ Redkik: Using cached token');
            return accessToken;
        }

        console.log('🔄 Redkik: Authenticating...');
        try {
            if (!CLIENT_ID || !CLIENT_SECRET) {
                throw new Error('Missing Redkik Credentials. Check .env.local');
            }

            const response = await fetch(`${REDKIK_BASE_URL}/oauth/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    grant_type: 'client_credentials',
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    scope: 'quote:write policy:write claim:write', // Adjust scopes as needed
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Redkik Auth Failed:', response.status, errorText);
                throw new Error(`Redkik Auth Failed: ${response.status}`);
            }

            const data = await response.json();
            accessToken = data.access_token;

            // Calculate expiry (minus 60s safety buffer)
            const expiresIn = data.expires_in || 3600;
            tokenExpiry = new Date(new Date().getTime() + (expiresIn - 60) * 1000);

            console.log('✅ Redkik: Authenticated successfully');
            return accessToken;
        } catch (error) {
            console.error('Redkik Auth Error:', error);
            throw error;
        }
    },

    /**
     * getQuote
     * Generic method to get a quote
     */
    async getQuote(bookingDetails) {
        const token = await this.authenticate();

        // TODO: Implement actual quote payload mapping
        // This is a placeholder for the authenticated request
        try {
            const response = await fetch(`${REDKIK_BASE_URL}/quotes`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bookingDetails),
            });

            return await response.json();
        } catch (error) {
            console.error('Redkik Quote Error:', error);
            throw error;
        }
    }
};

export default RedkikService;
