/**
 * Simple Node.js Backend Server for Lean API Integration
 * This server handles API calls to Lean on behalf of the frontend
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
function loadEnv() {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) {
        console.error('❌ ERROR: .env file not found!');
        console.error('📝 Please copy .env.example to .env and add your credentials');
        process.exit(1);
    }

    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
            const [key, ...valueParts] = line.split('=');
            const value = valueParts.join('=').trim();
            if (key && value) {
                process.env[key.trim()] = value;
            }
        }
    });
}

loadEnv();

// Lean API Configuration from environment variables
const LEAN_CONFIG = {
    client_id: process.env.LEAN_CLIENT_ID,
    client_secret: process.env.LEAN_CLIENT_SECRET,
    auth_url: process.env.LEAN_AUTH_URL || 'https://auth.sandbox.sa.leantech.me/oauth2/token',
    api_url: process.env.LEAN_API_URL || 'https://sandbox.sa.leantech.me'
};

// Validate required environment variables
if (!LEAN_CONFIG.client_id || !LEAN_CONFIG.client_secret) {
    console.error('❌ ERROR: Missing required Lean environment variables!');
    console.error('📝 Please ensure LEAN_CLIENT_ID and LEAN_CLIENT_SECRET are set in .env file');
    process.exit(1);
}

// Plaid API Configuration from environment variables
const PLAID_CONFIG = {
    client_id: process.env.PLAID_CLIENT_ID,
    secret: process.env.PLAID_SECRET,
    env: process.env.PLAID_ENV || 'sandbox',
    get api_url() {
        switch (this.env) {
            case 'production':
                return 'https://production.plaid.com';
            case 'development':
                return 'https://development.plaid.com';
            case 'sandbox':
            default:
                return 'https://sandbox.plaid.com';
        }
    }
};

// Validate Plaid environment variables (optional - only warn if missing)
if (!PLAID_CONFIG.client_id || !PLAID_CONFIG.secret) {
    console.warn('⚠️  WARNING: Plaid credentials not configured');
    console.warn('📝 Set PLAID_CLIENT_ID and PLAID_SECRET in .env to enable Plaid integration');
}

// Cache for API access token
let apiAccessToken = null;
let apiTokenExpiry = null;

/**
 * Make HTTP request (Node.js native)
 */
function makeRequest(url, options, postData = null) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);

        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const protocol = urlObj.protocol === 'https:' ? require('https') : require('http');

        const req = protocol.request(reqOptions, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    // Handle empty responses (like 204 No Content for DELETE)
                    if (!data || data.trim() === '') {
                        resolve({ success: true, status: res.statusCode });
                    } else {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            resolve(data);
                        }
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (postData) {
            req.write(postData);
        }

        req.end();
    });
}

/**
 * Step 1: Get API Access Token
 */
async function getApiAccessToken() {
    console.log('🔑 Getting API Access Token...');

    const formData = new URLSearchParams();
    formData.append('client_id', LEAN_CONFIG.client_id);
    formData.append('client_secret', LEAN_CONFIG.client_secret);
    formData.append('grant_type', 'client_credentials');
    formData.append('scope', 'api');

    const data = await makeRequest(LEAN_CONFIG.auth_url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(formData.toString())
        }
    }, formData.toString());

    apiAccessToken = data.access_token;
    apiTokenExpiry = Date.now() + (data.expires_in * 1000);

    console.log('✅ API Access Token obtained');
    return data.access_token;
}

/**
 * Step 2: Create Customer
 */
async function createCustomer(appUserId) {
    console.log('👤 Creating Customer:', appUserId);

    // Get API access token if needed
    if (!apiAccessToken || Date.now() >= apiTokenExpiry) {
        await getApiAccessToken();
    }

    const postData = JSON.stringify({ app_user_id: appUserId });

    const data = await makeRequest(`${LEAN_CONFIG.api_url}/customers/v1`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiAccessToken}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    }, postData);

    console.log('✅ Customer created:', data.customer_id);
    return data;
}

/**
 * Step 3: Get Customer Access Token
 */
async function getCustomerAccessToken(customerId) {
    console.log('🎫 Getting Customer Access Token for:', customerId);

    const formData = new URLSearchParams();
    formData.append('client_id', LEAN_CONFIG.client_id);
    formData.append('client_secret', LEAN_CONFIG.client_secret);
    formData.append('grant_type', 'client_credentials');
    formData.append('scope', `customer.${customerId}`);

    const data = await makeRequest(LEAN_CONFIG.auth_url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(formData.toString())
        }
    }, formData.toString());

    console.log('✅ Customer Access Token obtained');
    return data;
}


/**
 * Initialize Customer (Complete Flow - 3 steps)
 */
async function initializeCustomer(appUserId) {
    try {
        console.log('='.repeat(50));
        console.log('🚀 Starting Customer Initialization (3-step flow)');
        console.log('='.repeat(50));

        // Step 1
        await getApiAccessToken();

        // Step 2
        const customer = await createCustomer(appUserId);
        const customerId = customer.customer_id || customer.id;

        // Step 3
        const customerToken = await getCustomerAccessToken(customerId);

        console.log('='.repeat(50));
        console.log('✅ Initialization Complete!');
        console.log('='.repeat(50));

        return {
            success: true,
            customer_id: customerId,
            app_user_id: customer.app_user_id,
            access_token: customerToken.access_token,
            token_expires_in: customerToken.expires_in,
            token_scope: customerToken.scope
        };
    } catch (error) {
        console.error('❌ Initialization Failed:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get Tokens for Existing Customer (2-step flow)
 */
async function getTokensForCustomer(customerId) {
    try {
        console.log('='.repeat(50));
        console.log('🎫 Getting Tokens for Existing Customer (2-step flow)');
        console.log('='.repeat(50));

        // Step 1: Get API Access Token
        await getApiAccessToken();

        // Step 2: Get Customer Access Token (skip customer creation)
        const customerToken = await getCustomerAccessToken(customerId);

        console.log('='.repeat(50));
        console.log('✅ Tokens Retrieved!');
        console.log('='.repeat(50));

        return {
            success: true,
            customer_id: customerId,
            access_token: customerToken.access_token,
            token_expires_in: customerToken.expires_in,
            token_scope: customerToken.scope
        };
    } catch (error) {
        console.error('❌ Token Retrieval Failed:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get Accounts (Proxy Function)
 */
async function getAccounts(entityId) {
    console.log('📊 Fetching Accounts for Entity:', entityId);

    // Get API access token if needed
    if (!apiAccessToken || Date.now() >= apiTokenExpiry) {
        await getApiAccessToken();
    }

    const url = `${LEAN_CONFIG.api_url}/data/v2/accounts?entity_id=${entityId}&async=false&force_refresh=false&verbose=false`;

    const data = await makeRequest(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiAccessToken}`,
            'Accept': 'application/json'
        }
    });

    console.log('✅ Accounts fetched:', data.accounts?.length || 0, 'accounts');
    return data;
}

/**
 * Get Account Balances (Proxy Function)
 */
async function getAccountBalances(accountId, entityId) {
    console.log('💰 Fetching Balances for Account:', accountId, 'Entity:', entityId);

    // Get API access token if needed
    if (!apiAccessToken || Date.now() >= apiTokenExpiry) {
        await getApiAccessToken();
    }

    const url = `${LEAN_CONFIG.api_url}/data/v2/accounts/${accountId}/balances?entity_id=${entityId}&async=false&page=0&size=50&verbose=false&force_refresh=true`;

    console.log('🔍 Balance API URL:', url);

    const data = await makeRequest(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiAccessToken}`,
            'Accept': 'application/json'
        }
    });

    console.log('✅ Balances fetched');
    return data;
}

/**
 * Get Account Transactions (Proxy Function)
 */
async function getAccountTransactions(accountId, entityId) {
    console.log('📜 Fetching Transactions for Account:', accountId, 'Entity:', entityId);

    // Get API access token if needed
    if (!apiAccessToken || Date.now() >= apiTokenExpiry) {
        await getApiAccessToken();
    }

    const url = `${LEAN_CONFIG.api_url}/data/v2/accounts/${accountId}/transactions?entity_id=${entityId}&async=false&page=0&size=50&verbose=false`;

    const data = await makeRequest(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiAccessToken}`,
            'Accept': 'application/json'
        }
    });

    console.log('✅ Transactions fetched');
    return data;
}

/**
 * List Consents (for consent management)
 */
async function listConsents(customerId, entityId) {
    console.log('📋 Listing Consents for Customer:', customerId, 'Entity:', entityId);

    // Get API access token if needed
    if (!apiAccessToken || Date.now() >= apiTokenExpiry) {
        await getApiAccessToken();
    }

    const url = `${LEAN_CONFIG.api_url}/customers/v1/${customerId}/entities/${entityId}/consents`;

    const data = await makeRequest(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiAccessToken}`,
            'Accept': 'application/json'
        }
    });

    console.log('✅ Consents listed:', data.data?.length || 0, 'consents');
    return data;
}

/**
 * Delete Consent
 */
async function deleteConsent(customerId, entityId, consentId, reason = 'USER_REQUESTED') {
    console.log('🗑️ Deleting Consent:', consentId);

    // Get API access token if needed
    if (!apiAccessToken || Date.now() >= apiTokenExpiry) {
        await getApiAccessToken();
    }

    const url = `${LEAN_CONFIG.api_url}/customers/v1/${customerId}/entities/${entityId}/consent/${consentId}?reason=${reason}`;

    console.log('🔍 Delete Consent URL:', url);

    const data = await makeRequest(url, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${apiAccessToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    });

    console.log('✅ Consent deleted successfully');
    return data;
}

/**
 * ========================================
 * PLAID API FUNCTIONS
 * ========================================
 */

/**
 * Create Plaid Link Token (with optional institution pre-selection)
 *
 * ⚠️ CRITICAL: Testing shows institution_id does NOT work in sandbox mode.
 *
 * According to Plaid docs (https://plaid.com/docs/api/link/):
 * - institution_id is "used for certain Europe-only configurations,
 *   as well as certain legacy use cases in other regions"
 * - For US institutions, institution_data.routing_number is preferred
 *
 * ❌ VERIFIED: ALL commonly cited sandbox institutions return INVALID_INSTITUTION:
 * - ins_109508 (First Platypus Bank) ❌ Returns HTTP 400
 * - ins_109509 (First Gingham Credit Union) ❌ Returns HTTP 400
 * - ins_109510 (Tattersall Federal Credit Union) ❌ Returns HTTP 400
 * - ins_109511 (Houndstooth Bank) ❌ Returns HTTP 400
 * - ins_109512 (Tartan Bank) ❌ Returns HTTP 400
 * - ins_109513 (Platinum Standard Bank) ❌ Returns HTTP 400
 * - ins_109514 (Gold Standard Bank) ❌ Returns HTTP 400
 *
 * Test Results (run: node test-sandbox-banks.js):
 * - 7/7 institutions failed with INVALID_INSTITUTION error
 * - 0/7 institutions succeeded
 *
 * ✅ SOLUTION: The frontend auto-retry logic is ESSENTIAL (not optional).
 * When institution_id fails, it automatically retries without the parameter,
 * allowing users to select from all available sandbox banks via Plaid Link UI.
 *
 * RECOMMENDATION: Do not use institution_id in sandbox mode. Let users choose
 * from Plaid Link's interface instead.
 */
async function createPlaidLinkToken(userId, institutionId = null) {
    console.log('🔗 Creating Plaid Link Token for user:', userId);
    if (institutionId) {
        console.log('🏦 Institution pre-selected:', institutionId);
    }

    const linkTokenConfig = {
        client_id: PLAID_CONFIG.client_id,
        secret: PLAID_CONFIG.secret,
        user: {
            client_user_id: userId
        },
        client_name: 'Lean SDK Integration App',
        products: ['auth', 'transactions'],
        country_codes: ['US'],
        language: 'en'
    };

    // Add institution_id to link token config to skip institution selection screen
    if (institutionId) {
        linkTokenConfig.institution_id = institutionId;
        console.log('✅ Institution ID added to link token config');
    }

    const postData = JSON.stringify(linkTokenConfig);

    const data = await makeRequest(`${PLAID_CONFIG.api_url}/link/token/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    }, postData);

    console.log('✅ Plaid Link Token created');
    return data;
}

/**
 * Exchange Plaid Public Token for Access Token
 */
async function exchangePlaidPublicToken(publicToken) {
    console.log('🔄 Exchanging Plaid Public Token...');

    const postData = JSON.stringify({
        client_id: PLAID_CONFIG.client_id,
        secret: PLAID_CONFIG.secret,
        public_token: publicToken
    });

    const data = await makeRequest(`${PLAID_CONFIG.api_url}/item/public_token/exchange`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    }, postData);

    console.log('✅ Plaid Access Token obtained');
    console.log('   Item ID:', data.item_id);
    return data;
}

/**
 * Get Plaid Accounts
 */
async function getPlaidAccounts(accessToken) {
    console.log('📊 Fetching Plaid Accounts...');

    const postData = JSON.stringify({
        client_id: PLAID_CONFIG.client_id,
        secret: PLAID_CONFIG.secret,
        access_token: accessToken
    });

    const data = await makeRequest(`${PLAID_CONFIG.api_url}/accounts/get`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    }, postData);

    console.log('✅ Plaid Accounts fetched:', data.accounts?.length || 0, 'accounts');
    return data;
}

/**
 * Get Plaid Account Balances (with optional filtering)
 *
 * @param {string} accessToken - Plaid access token
 * @param {Object} options - Optional filtering parameters
 * @param {Array<string>} options.account_ids - Filter by specific account IDs
 * @param {string} options.min_last_updated_datetime - Filter by minimum update time (ISO 8601)
 */
async function getPlaidBalances(accessToken, options = {}) {
    console.log('💰 Fetching Plaid Account Balances...');

    const requestBody = {
        client_id: PLAID_CONFIG.client_id,
        secret: PLAID_CONFIG.secret,
        access_token: accessToken
    };

    // Add optional parameters if provided
    if (options.account_ids || options.min_last_updated_datetime) {
        requestBody.options = {};

        if (options.account_ids && options.account_ids.length > 0) {
            requestBody.options.account_ids = options.account_ids;
            console.log('   🔍 Filtering accounts:', options.account_ids.length, 'selected');
        }

        if (options.min_last_updated_datetime) {
            requestBody.options.min_last_updated_datetime = options.min_last_updated_datetime;
            console.log('   📅 Min update time:', options.min_last_updated_datetime);
        }
    }

    const postData = JSON.stringify(requestBody);

    const data = await makeRequest(`${PLAID_CONFIG.api_url}/accounts/balance/get`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    }, postData);

    console.log('✅ Plaid Balances fetched');
    return data;
}

/**
 * Get Plaid Transactions
 */
async function getPlaidTransactions(accessToken, startDate, endDate) {
    console.log('📜 Fetching Plaid Transactions...');
    console.log('   Date Range:', startDate, 'to', endDate);

    const postData = JSON.stringify({
        client_id: PLAID_CONFIG.client_id,
        secret: PLAID_CONFIG.secret,
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate
    });

    const data = await makeRequest(`${PLAID_CONFIG.api_url}/transactions/get`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    }, postData);

    console.log('✅ Plaid Transactions fetched:', data.transactions?.length || 0, 'transactions');
    return data;
}

/**
 * Get Plaid Auth (Account & Routing Numbers)
 */
async function getPlaidAuth(accessToken) {
    console.log('🔐 Fetching Plaid Auth Data...');

    const postData = JSON.stringify({
        client_id: PLAID_CONFIG.client_id,
        secret: PLAID_CONFIG.secret,
        access_token: accessToken
    });

    const data = await makeRequest(`${PLAID_CONFIG.api_url}/auth/get`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    }, postData);

    console.log('✅ Plaid Auth data fetched');
    return data;
}

/**
 * Get Payment Initiation Recipients
 */
async function getPlaidRecipients() {
    console.log('💳 Fetching Plaid Payment Recipients...');

    const postData = JSON.stringify({
        client_id: PLAID_CONFIG.client_id,
        secret: PLAID_CONFIG.secret
    });

    const data = await makeRequest(`${PLAID_CONFIG.api_url}/payment_initiation/recipient/list`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    }, postData);

    console.log('✅ Payment Recipients fetched:', data.recipients?.length || 0, 'recipients');
    return data;
}

/**
 * Remove/Disconnect Plaid Item (Delete connection)
 */
async function removePlaidItem(accessToken) {
    console.log('🗑️ Removing Plaid Item...');

    const postData = JSON.stringify({
        client_id: PLAID_CONFIG.client_id,
        secret: PLAID_CONFIG.secret,
        access_token: accessToken
    });

    const data = await makeRequest(`${PLAID_CONFIG.api_url}/item/remove`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    }, postData);

    console.log('✅ Plaid Item removed successfully');
    return data;
}

/**
 * Get Institutions (Banks) with Payment Initiation Support
 */
async function getPlaidInstitutions(countryCode = 'US', count = 500, offset = 0) {
    console.log('🏦 Fetching Plaid Institutions for country:', countryCode);

    const postData = JSON.stringify({
        client_id: PLAID_CONFIG.client_id,
        secret: PLAID_CONFIG.secret,
        count: count,
        offset: offset,
        country_codes: [countryCode],
        options: {
            include_optional_metadata: true,
            include_payment_initiation_metadata: true
        }
    });

    const data = await makeRequest(`${PLAID_CONFIG.api_url}/institutions/get`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    }, postData);

    console.log('✅ Institutions fetched:', data.institutions?.length || 0, 'institutions');
    return data;
}

/**
 * Fire a webhook manually (Sandbox only)
 * This triggers a webhook event for testing purposes
 */
async function firePlaidWebhook(accessToken, webhookCode) {
    console.log('🔔 Firing Plaid Webhook:', webhookCode);

    const postData = JSON.stringify({
        client_id: PLAID_CONFIG.client_id,
        secret: PLAID_CONFIG.secret,
        access_token: accessToken,
        webhook_code: webhookCode
    });

    const data = await makeRequest(`${PLAID_CONFIG.api_url}/sandbox/item/fire_webhook`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    }, postData);

    console.log('✅ Webhook fired successfully');
    return data;
}

/**
 * Reset login for an Item (Sandbox only)
 * This forces ITEM_LOGIN_REQUIRED webhook to be fired
 */
async function resetPlaidLogin(accessToken) {
    console.log('🔄 Resetting Plaid Item Login...');

    const postData = JSON.stringify({
        client_id: PLAID_CONFIG.client_id,
        secret: PLAID_CONFIG.secret,
        access_token: accessToken
    });

    const data = await makeRequest(`${PLAID_CONFIG.api_url}/sandbox/item/reset_login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    }, postData);

    console.log('✅ Item login reset - ITEM_LOGIN_REQUIRED webhook will fire');
    return data;
}

/**
 * Save webhook event to file system for debugging
 */
function saveWebhookEvent(webhookData) {
    const timestamp = new Date().toISOString();
    const dataToSave = {
        ...webhookData,
        received_at: timestamp
    };

    const filename = `webhook_${timestamp.replace(/[:.]/g, '-')}.json`;
    const webhooksDir = path.join(__dirname, 'webhooks');

    if (!fs.existsSync(webhooksDir)) {
        fs.mkdirSync(webhooksDir);
    }

    const filepath = path.join(webhooksDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(dataToSave, null, 2));

    // Also append to master log
    const logFile = path.join(webhooksDir, 'all_webhooks.json');
    let allWebhooks = [];
    if (fs.existsSync(logFile)) {
        const existing = fs.readFileSync(logFile, 'utf8');
        if (existing.trim()) {
            allWebhooks = JSON.parse(existing);
        }
    }
    allWebhooks.push(dataToSave);
    fs.writeFileSync(logFile, JSON.stringify(allWebhooks, null, 2));

    console.log('💾 Webhook saved to:', filename);
    return filename;
}

/**
 * Get Available Lean Banks/Entities
 */
async function getLeanBanks() {
    console.log('🏦 Fetching available Lean banks...');

    // Get API access token first
    const tokenData = await getApiAccessToken();

    const data = await makeRequest(`${LEAN_CONFIG.api_url}/entities/v1`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Content-Type': 'application/json',
            'lean-app-token': LEAN_CONFIG.client_id
        }
    });

    console.log('✅ Lean banks fetched:', data.entities?.length || 0, 'banks');
    return data;
}

/**
 * HTTP Server
 */
const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS (preflight)
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // API endpoint: Get available Lean banks
    if (req.url === '/api/lean/banks' && req.method === 'GET') {
        try {
            const result = await getLeanBanks();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (error) {
            console.error('❌ Failed to fetch Lean banks:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // API endpoint: Get client configuration (safe to expose)
    if (req.url === '/api/config' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            client_id: LEAN_CONFIG.client_id,
            auth_url: LEAN_CONFIG.auth_url,
            api_url: LEAN_CONFIG.api_url
        }));
        return;
    }

    // API endpoint: Initialize customer (3-step flow)
    if (req.url === '/api/initialize-customer' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { app_user_id } = JSON.parse(body);
                const result = await initializeCustomer(app_user_id);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // API endpoint: Get tokens for existing customer (2-step flow)
    if (req.url === '/api/get-customer-tokens' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { customer_id } = JSON.parse(body);

                if (!customer_id) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'customer_id is required' }));
                    return;
                }

                const result = await getTokensForCustomer(customer_id);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }


    // API endpoint: Get Account Balances (Proxy) - MUST COME BEFORE /api/accounts
    if (req.url.match(/^\/api\/accounts\/[^\/]+\/balances/) && req.method === 'GET') {
        const urlParts = req.url.split('?');
        const accountId = urlParts[0].split('/')[3];
        const urlParams = new URL(req.url, `http://${req.headers.host}`);
        const entityId = urlParams.searchParams.get('entity_id');

        if (!entityId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'entity_id is required' }));
            return;
        }

        try {
            const result = await getAccountBalances(accountId, entityId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
        return;
    }

    // API endpoint: Get Account Transactions (Proxy) - MUST COME BEFORE /api/accounts
    if (req.url.match(/^\/api\/accounts\/[^\/]+\/transactions/) && req.method === 'GET') {
        const urlParts = req.url.split('?');
        const accountId = urlParts[0].split('/')[3];
        const urlParams = new URL(req.url, `http://${req.headers.host}`);
        const entityId = urlParams.searchParams.get('entity_id');

        if (!entityId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'entity_id is required' }));
            return;
        }

        try {
            const result = await getAccountTransactions(accountId, entityId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
        return;
    }

    // API endpoint: Get Accounts (Proxy) - MUST COME AFTER /balances and /transactions
    if (req.url.startsWith('/api/accounts') && req.method === 'GET') {
        const urlParams = new URL(req.url, `http://${req.headers.host}`);
        const entityId = urlParams.searchParams.get('entity_id');

        if (!entityId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'entity_id is required' }));
            return;
        }

        try {
            const result = await getAccounts(entityId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
        return;
    }

    // (Removed duplicate - now defined earlier in correct order)

    // API endpoint: List Consents
    if (req.url === '/api/consents' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { customer_id, entity_id } = JSON.parse(body);

                if (!customer_id || !entity_id) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'customer_id and entity_id are required' }));
                    return;
                }

                const result = await listConsents(customer_id, entity_id);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // API endpoint: Delete Consent
    if (req.url === '/api/consents/delete' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { customer_id, entity_id, consent_id, reason } = JSON.parse(body);

                if (!customer_id || !entity_id || !consent_id) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'customer_id, entity_id, and consent_id are required' }));
                    return;
                }

                const result = await deleteConsent(customer_id, entity_id, consent_id, reason || 'USER_REQUESTED');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data: result }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }


    // API endpoint: Save connection details
    if (req.url === '/api/save-connection' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const connectionData = JSON.parse(body);
                const timestamp = new Date().toISOString();

                // Add timestamp to data
                const dataToSave = {
                    ...connectionData,
                    timestamp: timestamp,
                    saved_at: new Date().toLocaleString()
                };

                // Create filename with timestamp
                const filename = `connection_${timestamp.replace(/[:.]/g, '-')}.json`;
                const filepath = path.join(__dirname, 'connections', filename);

                // Create connections directory if it doesn't exist
                const connectionsDir = path.join(__dirname, 'connections');
                if (!fs.existsSync(connectionsDir)) {
                    fs.mkdirSync(connectionsDir);
                }

                // Save to individual file
                fs.writeFileSync(filepath, JSON.stringify(dataToSave, null, 2));

                // Also append to a master log file
                const logFile = path.join(__dirname, 'connections', 'all_connections.json');
                let allConnections = [];
                if (fs.existsSync(logFile)) {
                    const existing = fs.readFileSync(logFile, 'utf8');
                    if (existing.trim()) {
                        allConnections = JSON.parse(existing);
                    }
                }
                allConnections.push(dataToSave);
                fs.writeFileSync(logFile, JSON.stringify(allConnections, null, 2));

                console.log('💾 Connection details saved to file:', filename);
                console.log('   Entity ID:', connectionData.entity_id);
                console.log('   Customer ID:', connectionData.customer_id);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    filename: filename,
                    filepath: filepath
                }));
            } catch (error) {
                console.error('❌ Failed to save connection:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // ========================================
    // PLAID API ENDPOINTS
    // ========================================

    // API endpoint: Create Plaid Link Token
    if (req.url === '/api/plaid/create-link-token' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { user_id, institution_id } = JSON.parse(body);
                const result = await createPlaidLinkToken(
                    user_id || `user_${Date.now()}`,
                    institution_id || null
                );

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error('❌ Create Link Token Failed:', error);

                // Check if this is an INVALID_INSTITUTION error from Plaid
                const errorMessage = error.message || '';
                const isInvalidInstitution = errorMessage.includes('INVALID_INSTITUTION');

                // Return appropriate status code
                const statusCode = isInvalidInstitution ? 400 : 500;

                res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: error.message,
                    error_type: isInvalidInstitution ? 'INVALID_INSTITUTION' : 'SERVER_ERROR'
                }));
            }
        });
        return;
    }

    // API endpoint: Exchange Plaid Public Token
    if (req.url === '/api/plaid/exchange-token' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { public_token } = JSON.parse(body);

                if (!public_token) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'public_token is required' }));
                    return;
                }

                const result = await exchangePlaidPublicToken(public_token);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error('❌ Token Exchange Failed:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // API endpoint: Get Plaid Accounts
    if (req.url === '/api/plaid/accounts' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { access_token } = JSON.parse(body);

                if (!access_token) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'access_token is required' }));
                    return;
                }

                const result = await getPlaidAccounts(access_token);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error('❌ Get Accounts Failed:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // API endpoint: Get Plaid Balances (with optional filtering)
    if (req.url === '/api/plaid/balances' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { access_token, options } = JSON.parse(body);

                if (!access_token) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'access_token is required' }));
                    return;
                }

                // Pass optional filtering parameters to getPlaidBalances
                const result = await getPlaidBalances(access_token, options || {});

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error('❌ Get Balances Failed:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // API endpoint: Get Plaid Transactions
    if (req.url === '/api/plaid/transactions' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { access_token, start_date, end_date } = JSON.parse(body);

                if (!access_token) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'access_token is required' }));
                    return;
                }

                // Default to last 30 days if dates not provided
                const endDateFinal = end_date || new Date().toISOString().split('T')[0];
                const startDateFinal = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                const result = await getPlaidTransactions(access_token, startDateFinal, endDateFinal);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error('❌ Get Transactions Failed:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // API endpoint: Get Plaid Auth
    if (req.url === '/api/plaid/auth' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { access_token } = JSON.parse(body);

                if (!access_token) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'access_token is required' }));
                    return;
                }

                const result = await getPlaidAuth(access_token);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error('❌ Get Auth Failed:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // API endpoint: Save Plaid connection details
    if (req.url === '/api/plaid/save-connection' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const connectionData = JSON.parse(body);
                const timestamp = new Date().toISOString();

                // Add timestamp to data
                const dataToSave = {
                    ...connectionData,
                    timestamp: timestamp,
                    saved_at: new Date().toLocaleString()
                };

                // Create filename with timestamp
                const filename = `plaid_connection_${timestamp.replace(/[:.]/g, '-')}.json`;
                const filepath = path.join(__dirname, 'plaid-connections', filename);

                // Create plaid-connections directory if it doesn't exist
                const connectionsDir = path.join(__dirname, 'plaid-connections');
                if (!fs.existsSync(connectionsDir)) {
                    fs.mkdirSync(connectionsDir);
                }

                // Save to individual file
                fs.writeFileSync(filepath, JSON.stringify(dataToSave, null, 2));

                // Also append to a master log file
                const logFile = path.join(__dirname, 'plaid-connections', 'all_plaid_connections.json');
                let allConnections = [];
                if (fs.existsSync(logFile)) {
                    const existing = fs.readFileSync(logFile, 'utf8');
                    if (existing.trim()) {
                        allConnections = JSON.parse(existing);
                    }
                }
                allConnections.push(dataToSave);
                fs.writeFileSync(logFile, JSON.stringify(allConnections, null, 2));

                console.log('💾 Plaid connection details saved to file:', filename);
                console.log('   Item ID:', connectionData.item_id);
                console.log('   Institution:', connectionData.institution_name);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    filename: filename,
                    filepath: filepath
                }));
            } catch (error) {
                console.error('❌ Failed to save Plaid connection:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // API endpoint: List All Plaid Connections
    if (req.url === '/api/plaid/list-connections' && req.method === 'GET') {
        try {
            const logFile = path.join(__dirname, 'plaid-connections', 'all_plaid_connections.json');

            if (!fs.existsSync(logFile)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ connections: [] }));
                return;
            }

            const data = fs.readFileSync(logFile, 'utf8');
            const connections = data.trim() ? JSON.parse(data) : [];

            console.log(`📊 Listed ${connections.length} Plaid connections`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: connections.length,
                connections: connections
            }));
        } catch (error) {
            console.error('❌ Failed to list Plaid connections:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // API endpoint: List All Plaid Users/Customers
    if (req.url === '/api/plaid/list-users' && req.method === 'GET') {
        try {
            const logFile = path.join(__dirname, 'plaid-connections', 'all_plaid_connections.json');

            if (!fs.existsSync(logFile)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ users: [] }));
                return;
            }

            const data = fs.readFileSync(logFile, 'utf8');
            const connections = data.trim() ? JSON.parse(data) : [];

            // Group connections by user_id and aggregate data
            const usersMap = {};

            connections.forEach(conn => {
                const userId = conn.user_id || 'unknown';

                if (!usersMap[userId]) {
                    usersMap[userId] = {
                        user_id: userId,
                        connection_count: 0,
                        connections: [],
                        first_connection: conn.timestamp,
                        last_connection: conn.timestamp,
                        institutions: []
                    };
                }

                usersMap[userId].connection_count++;
                usersMap[userId].connections.push({
                    item_id: conn.item_id,
                    institution_name: conn.institution_name,
                    institution_id: conn.institution_id,
                    timestamp: conn.timestamp,
                    accounts_count: conn.accounts ? conn.accounts.length : 0
                });

                // Track unique institutions
                if (conn.institution_name && !usersMap[userId].institutions.includes(conn.institution_name)) {
                    usersMap[userId].institutions.push(conn.institution_name);
                }

                // Update timestamps
                if (new Date(conn.timestamp) < new Date(usersMap[userId].first_connection)) {
                    usersMap[userId].first_connection = conn.timestamp;
                }
                if (new Date(conn.timestamp) > new Date(usersMap[userId].last_connection)) {
                    usersMap[userId].last_connection = conn.timestamp;
                }
            });

            // Convert to array
            const users = Object.values(usersMap);

            console.log(`👥 Listed ${users.length} unique Plaid users with ${connections.length} total connections`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                user_count: users.length,
                total_connections: connections.length,
                users: users
            }));
        } catch (error) {
            console.error('❌ Failed to list Plaid users:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // API endpoint: Remove/Disconnect Plaid Item
    if (req.url === '/api/plaid/remove-item' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { access_token } = JSON.parse(body);

                if (!access_token) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'access_token is required' }));
                    return;
                }

                const result = await removePlaidItem(access_token);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error('❌ Remove Item Failed:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // API endpoint: Get Payment Initiation Recipients
    if (req.url === '/api/plaid/recipients' && req.method === 'POST') {
        try {
            const result = await getPlaidRecipients();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (error) {
            console.error('❌ Get Recipients Failed:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // API endpoint: Get Institutions (Banks)
    if (req.url.startsWith('/api/plaid/institutions') && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { country_code, count, offset } = JSON.parse(body || '{}');

                const result = await getPlaidInstitutions(
                    country_code || 'US',
                    count || 500,
                    offset || 0
                );

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error('❌ Get Institutions Failed:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // ========================================
    // PLAID WEBHOOK ENDPOINTS
    // ========================================

    // API endpoint: Plaid Webhook Receiver
    // This is the endpoint Plaid will POST to when events occur
    if (req.url === '/api/plaid/webhook' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const webhookData = JSON.parse(body);

                console.log('='.repeat(50));
                console.log('🔔 WEBHOOK RECEIVED FROM PLAID');
                console.log('='.repeat(50));
                console.log('Webhook Type:', webhookData.webhook_type);
                console.log('Webhook Code:', webhookData.webhook_code);
                console.log('Item ID:', webhookData.item_id);
                console.log('Full Payload:', JSON.stringify(webhookData, null, 2));
                console.log('='.repeat(50));

                // Save webhook to file system
                const filename = saveWebhookEvent(webhookData);

                // Plaid expects a 200 response
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Webhook received and processed',
                    filename: filename
                }));
            } catch (error) {
                console.error('❌ Webhook processing failed:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // API endpoint: Fire Plaid Webhook (Sandbox Testing)
    if (req.url === '/api/plaid/fire-webhook' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { access_token, webhook_code } = JSON.parse(body);

                if (!access_token || !webhook_code) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: 'access_token and webhook_code are required'
                    }));
                    return;
                }

                const result = await firePlaidWebhook(access_token, webhook_code);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: `Webhook ${webhook_code} fired successfully`,
                    result: result
                }));
            } catch (error) {
                console.error('❌ Fire Webhook Failed:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // API endpoint: Reset Plaid Item Login (Sandbox Testing)
    if (req.url === '/api/plaid/reset-login' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { access_token } = JSON.parse(body);

                if (!access_token) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'access_token is required' }));
                    return;
                }

                const result = await resetPlaidLogin(access_token);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Item login reset - ITEM_LOGIN_REQUIRED webhook will be sent',
                    result: result
                }));
            } catch (error) {
                console.error('❌ Reset Login Failed:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // API endpoint: List All Received Webhooks
    if (req.url === '/api/plaid/webhooks' && req.method === 'GET') {
        try {
            const webhooksDir = path.join(__dirname, 'webhooks');
            const logFile = path.join(webhooksDir, 'all_webhooks.json');

            if (!fs.existsSync(logFile)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    count: 0,
                    webhooks: []
                }));
                return;
            }

            const data = fs.readFileSync(logFile, 'utf8');
            const webhooks = data.trim() ? JSON.parse(data) : [];

            console.log(`📊 Listed ${webhooks.length} received webhooks`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: webhooks.length,
                webhooks: webhooks
            }));
        } catch (error) {
            console.error('❌ Failed to list webhooks:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // Serve static files
    // Remove query string from URL
    const urlPath = req.url.split('?')[0];
    let filePath = '.' + urlPath;
    if (filePath === './') {
        filePath = './index.html';
    }

    // Log requests
    console.log(`📥 Request: ${req.method} ${req.url}`);

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 - File Not Found');
            } else {
                res.writeHead(500);
                res.end('500 - Internal Server Error');
            }
        } else {
            // Add cache control headers to prevent browser caching
            const headers = {
                'Content-Type': contentType,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            };
            res.writeHead(200, headers);
            res.end(content, 'utf-8');
        }
    });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(`🚀 Lean Integration Server Running`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`🔧 API Endpoint: http://localhost:${PORT}/api/initialize-customer`);
    console.log(`🔑 Client ID: ${LEAN_CONFIG.client_id.substring(0, 8)}...`);
    console.log('='.repeat(50));
});
