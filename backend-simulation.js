/**
 * Backend API Simulation for Lean Integration (DEPRECATED - DO NOT USE)
 *
 * ⚠️ WARNING: This file is kept for reference only and should NOT be used.
 * It contains hardcoded credentials which is a SECURITY RISK.
 *
 * Use the proper backend implementation in server.js instead, which:
 * - Loads credentials from environment variables
 * - Keeps secrets server-side only
 * - Follows security best practices
 *
 * This file demonstrates why backend integration is necessary:
 * Client credentials should NEVER be exposed to the frontend!
 */

const LeanBackendAPI = {
    // ⚠️ DEPRECATED: Do not use hardcoded credentials
    // Use server.js with .env file instead
    config: {
        client_id: 'YOUR_CLIENT_ID_HERE',
        client_secret: 'YOUR_CLIENT_SECRET_HERE',
        auth_url: 'https://auth.sandbox.sa.leantech.me/oauth2/token',
        api_url: 'https://sandbox.sa.leantech.me'
    },

    // Cache for API access token
    apiAccessToken: null,
    apiTokenExpiry: null,

    /**
     * Step 1: Get API Access Token
     * This gets an access token to call Lean's Management APIs
     */
    async getApiAccessToken() {
        console.log('🔑 Step 1: Getting API Access Token...');

        try {
            const formData = new URLSearchParams();
            formData.append('client_id', this.config.client_id);
            formData.append('client_secret', this.config.client_secret);
            formData.append('grant_type', 'client_credentials');
            formData.append('scope', 'api');

            const response = await fetch(this.config.auth_url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to get API token: ${response.status} - ${errorText}`);
            }

            const data = await response.json();

            this.apiAccessToken = data.access_token;
            this.apiTokenExpiry = Date.now() + (data.expires_in * 1000);

            console.log('✅ API Access Token obtained');
            console.log('   Token type:', data.token_type);
            console.log('   Expires in:', data.expires_in, 'seconds');

            return data.access_token;

        } catch (error) {
            console.error('❌ Failed to get API access token:', error);
            throw error;
        }
    },

    /**
     * Step 2: Create Customer
     * Creates a customer in Lean's system
     */
    async createCustomer(appUserId) {
        console.log('👤 Step 2: Creating Customer...');
        console.log('   App User ID:', appUserId);

        try {
            // Get API access token first
            let apiToken = this.apiAccessToken;

            // Check if token is expired or not available
            if (!apiToken || Date.now() >= this.apiTokenExpiry) {
                console.log('   ⏳ API token expired or missing, getting new one...');
                apiToken = await this.getApiAccessToken();
            }

            const response = await fetch(`${this.config.api_url}/customers/v1`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    app_user_id: appUserId
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to create customer: ${response.status} - ${errorText}`);
            }

            const data = await response.json();

            console.log('✅ Customer created successfully');
            console.log('   Full response:', JSON.stringify(data, null, 2));

            // API returns 'customer_id' not 'id'
            const customerId = data.customer_id || data.id;
            const appUserId = data.app_user_id;

            console.log('   Customer ID:', customerId);
            console.log('   App User ID:', appUserId);

            // Validate customer_id exists
            if (!customerId) {
                throw new Error('Customer API did not return a customer_id. Response: ' + JSON.stringify(data));
            }

            return {
                customer_id: customerId,
                app_user_id: appUserId,
                created_at: data.created_at
            };

        } catch (error) {
            console.error('❌ Failed to create customer:', error);
            throw error;
        }
    },

    /**
     * Step 3: Get Customer Access Token
     * Gets a customer-specific access token for SDK usage
     */
    async getCustomerAccessToken(customerId) {
        console.log('🎫 Step 3: Getting Customer Access Token...');
        console.log('   Customer ID:', customerId);

        // Validate customerId
        if (!customerId || customerId === 'undefined') {
            throw new Error(`Invalid customer ID: ${customerId}. Make sure Step 2 returned a valid customer ID.`);
        }

        try {
            const scope = `customer.${customerId}`;
            console.log('   Scope:', scope);

            const formData = new URLSearchParams();
            formData.append('client_id', this.config.client_id);
            formData.append('client_secret', this.config.client_secret);
            formData.append('grant_type', 'client_credentials');
            formData.append('scope', scope);

            const response = await fetch(this.config.auth_url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to get customer token: ${response.status} - ${errorText}`);
            }

            const data = await response.json();

            console.log('✅ Customer Access Token obtained');
            console.log('   Token type:', data.token_type);
            console.log('   Expires in:', data.expires_in, 'seconds');
            console.log('   Scope:', data.scope);

            return {
                access_token: data.access_token,
                token_type: data.token_type,
                expires_in: data.expires_in,
                scope: data.scope
            };

        } catch (error) {
            console.error('❌ Failed to get customer access token:', error);
            throw error;
        }
    },

    /**
     * Complete initialization flow
     * This combines all 3 steps into one call
     */
    async initializeCustomer(appUserId) {
        console.log('='.repeat(50));
        console.log('🚀 Starting Complete Customer Initialization Flow');
        console.log('='.repeat(50));

        try {
            // Step 1: Get API Access Token
            await this.getApiAccessToken();
            console.log('   ✓ API Token obtained');

            // Step 2: Create Customer
            const customer = await this.createCustomer(appUserId);
            console.log('   ✓ Customer created');
            console.log('   ✓ Customer object:', JSON.stringify(customer, null, 2));

            // Validate customer object has customer_id
            if (!customer || !customer.customer_id) {
                throw new Error('Failed to get customer_id from createCustomer. Customer object: ' + JSON.stringify(customer));
            }

            console.log('   ✓ Using customer_id for token request:', customer.customer_id);

            // Step 3: Get Customer Access Token
            const customerToken = await this.getCustomerAccessToken(customer.customer_id);

            console.log('='.repeat(50));
            console.log('✅ Customer Initialization Complete!');
            console.log('='.repeat(50));

            return {
                success: true,
                customer_id: customer.customer_id,
                app_user_id: customer.app_user_id,
                access_token: customerToken.access_token,
                token_expires_in: customerToken.expires_in,
                token_scope: customerToken.scope
            };

        } catch (error) {
            console.error('='.repeat(50));
            console.error('❌ Customer Initialization Failed');
            console.error('='.repeat(50));
            console.error('Error:', error.message);

            return {
                success: false,
                error: error.message
            };
        }
    }
};

// Make it globally available
window.LeanBackendAPI = LeanBackendAPI;
