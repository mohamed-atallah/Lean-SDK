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
    console.error('❌ ERROR: Missing required environment variables!');
    console.error('📝 Please ensure LEAN_CLIENT_ID and LEAN_CLIENT_SECRET are set in .env file');
    process.exit(1);
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
