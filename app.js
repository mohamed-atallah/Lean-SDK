/**
 * Lean SDK Test Integration - Using Builder Pattern
 * This script uses the correct Lean SDK approach with Builder pattern
 * and customer access tokens
 */

// Global state
let leanInstance = null;
let currentCustomerId = null;
let currentAccessToken = null;
let appToken = null; // Will be fetched from backend

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if returning from success page
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
        const successBanner = document.getElementById('successBanner');
        const connectionInfo = document.getElementById('connectionInfo');

        // Get last connection from localStorage
        const lastConnection = localStorage.getItem('lean_last_connection');
        if (lastConnection) {
            const data = JSON.parse(lastConnection);
            connectionInfo.innerHTML = `
                Entity ID: <strong>${data.entity_id || 'N/A'}</strong><br>
                Customer ID: <strong>${data.customer_id || 'N/A'}</strong><br>
                Bank: <strong>${data.bank_identifier || 'N/A'}</strong>
            `;

            // Show Step 3 (Manage Consents) and Step 4 (Fetch Account Data)
            const consentManagementCard = document.getElementById('consentManagementCard');
            const consentCustomerIdInput = document.getElementById('consentCustomerId');
            const consentEntityIdInput = document.getElementById('consentEntityId');
            const listConsentsBtn = document.getElementById('listConsentsBtn');

            const accountDataCard = document.getElementById('accountDataCard');
            const entityIdInput = document.getElementById('entityId');
            const fetchAccountsBtn = document.getElementById('fetchAccountsBtn');

            if (data.entity_id && data.customer_id) {
                // Show and populate Step 3: Manage Consents
                consentManagementCard.style.display = 'block';
                consentCustomerIdInput.value = data.customer_id;
                consentEntityIdInput.value = data.entity_id;
                listConsentsBtn.disabled = false;

                // Show and populate Step 4: Fetch Account Data
                accountDataCard.style.display = 'block';
                entityIdInput.value = data.entity_id;
                fetchAccountsBtn.disabled = false;
            }
        }

        successBanner.style.display = 'block';

        // Clean URL by removing success parameter
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Get DOM elements
    const initBtn = document.getElementById('initBtn');
    const connectBtn = document.getElementById('connectBtn');
    const customerIdInput = document.getElementById('customerId');
    const accessTokenInput = document.getElementById('accessToken');
    const accountTypeSelect = document.getElementById('accountType');
    const sandboxModeCheckbox = document.getElementById('sandboxMode');
    const debugModeCheckbox = document.getElementById('debugMode');
    const resultsCard = document.getElementById('resultsCard');
    const resultsDiv = document.getElementById('results');

    // Option B elements
    const getTokensBtn = document.getElementById('getTokensBtn');
    const existingCustomerIdInput = document.getElementById('existingCustomerId');

    /**
     * Log debug information
     */
    function debugLog(message, data) {
        const isDebug = debugModeCheckbox.checked;
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;

        if (isDebug) {
            if (data) {
                console.log(logMessage, data);
            } else {
                console.log(logMessage);
            }
        }
    }

    /**
     * Check if Lean SDK is loaded
     */
    function checkLeanSDK() {
        debugLog('🔍 Checking Lean SDK...');

        // Check if Lean SDK is available
        if (typeof window.Lean === 'undefined') {
            throw new Error('Lean SDK not loaded. Please refresh the page.');
        }

        debugLog('✅ Lean SDK found');
        debugLog('✅ Lean.connect available:', typeof window.Lean.connect === 'function');

        return true;
    }

    /**
     * Initialize customer using real Lean APIs via backend server
     * Calls the Node.js backend which makes actual API calls to Lean
     */
    async function initializeCustomer() {
        debugLog('🔄 Initializing customer with real Lean APIs...');

        resultsDiv.innerHTML = '<p class="loading">Calling Backend Server...<br>Step 1: Getting API Access Token...<br>Step 2: Creating Customer...<br>Step 3: Getting Customer Access Token...</p>';
        resultsCard.style.display = 'block';

        try {
            // Generate a random unique app user ID
            const randomId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            const appUserId = 'user_' + randomId;

            debugLog('Calling backend API...');
            debugLog('Generated app_user_id:', appUserId);

            // Call the backend server - this makes REAL API calls to Lean
            const response = await fetch('http://localhost:8000/api/initialize-customer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    app_user_id: appUserId
                })
            });

            if (!response.ok) {
                throw new Error(`Backend API failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Customer initialization failed');
            }

            // Store the customer data
            currentCustomerId = result.customer_id;
            currentAccessToken = result.access_token;

            // Update UI
            customerIdInput.value = currentCustomerId;
            accessTokenInput.value = currentAccessToken;

            // Enable connect button
            connectBtn.disabled = false;

            resultsDiv.innerHTML = `
                <div class="status-badge status-success">✅ Customer Initialized Successfully!</div>
                <div class="response-item">
                    <strong>App User ID:</strong> ${result.app_user_id}
                </div>
                <div class="response-item">
                    <strong>Customer ID:</strong> ${currentCustomerId}
                </div>
                <div class="response-item">
                    <strong>Access Token:</strong> Obtained (JWT format)
                </div>
                <div class="response-item">
                    <strong>Token Scope:</strong> ${result.token_scope}
                </div>
                <div class="response-item">
                    <strong>Expires In:</strong> ${result.token_expires_in} seconds
                </div>
                <div class="help-box">
                    <h4>✅ Real API Calls Completed!</h4>
                    <p>All 3 Lean API calls were successful:</p>
                    <ol>
                        <li>✅ API Access Token obtained</li>
                        <li>✅ Customer created in Lean</li>
                        <li>✅ Customer Access Token obtained</li>
                    </ol>
                    <p><strong>Next:</strong> Click "Connect with Lean" to link a bank account!</p>
                </div>
                <details class="json-details">
                    <summary>Full API Response</summary>
                    <pre>${JSON.stringify(result, null, 2)}</pre>
                </details>
            `;

            debugLog('✅ Customer initialized with real APIs', {
                customerId: currentCustomerId,
                appUserId: result.app_user_id,
                tokenScope: result.token_scope
            });

        } catch (error) {
            console.error('❌ Customer initialization failed:', error);
            debugLog('❌ Failed to initialize customer:', error);

            resultsDiv.innerHTML = `
                <div class="status-badge status-error">❌ Initialization Failed</div>
                <div class="response-item">
                    <strong>Error:</strong> ${error.message}
                </div>
                <div class="help-box">
                    <h4>Common Issues:</h4>
                    <ol>
                        <li>Check browser console (F12) for detailed error</li>
                        <li>Verify Lean sandbox API is accessible</li>
                        <li>Check if client credentials are correct in backend-simulation.js</li>
                        <li>Enable Debug Mode for more information</li>
                    </ol>
                </div>
                <details class="json-details">
                    <summary>Error Details</summary>
                    <pre>${error.stack || error.message}</pre>
                </details>
            `;
        }
    }

    /**
     * Fetch app configuration from backend
     */
    async function fetchAppConfig() {
        try {
            const response = await fetch('http://localhost:8000/api/config');
            if (!response.ok) {
                throw new Error('Failed to fetch app configuration');
            }
            const config = await response.json();
            appToken = config.client_id;
            debugLog('✅ App configuration loaded', { client_id: appToken });
        } catch (error) {
            console.error('❌ Failed to fetch app config:', error);
            throw new Error('Unable to load application configuration. Please ensure the server is running.');
        }
    }

    /**
     * Connect to bank using Lean SDK
     */
    async function connectToBank() {
        const accountType = accountTypeSelect.value.toUpperCase(); // 'PERSONAL' or 'BUSINESS' (uppercase required by Lean SDK)

        debugLog('🔗 Starting bank connection...');

        // Validate inputs
        if (!currentCustomerId || !currentAccessToken) {
            alert('Please initialize customer first');
            return;
        }

        resultsDiv.innerHTML = '<p class="loading">Opening Lean SDK...</p>';
        resultsCard.style.display = 'block';

        try {
            // Fetch app token from backend if not already loaded
            if (!appToken) {
                await fetchAppConfig();
            }

            // Check if Lean SDK is loaded
            checkLeanSDK();

            debugLog('✅ Calling Lean.connect()...');

            // Get selected bank (if any)
            const leanBankSelect = document.getElementById('leanBankSelect');
            const selectedBank = leanBankSelect ? leanBankSelect.value : '';

            // Get selected language
            const leanLanguageSelect = document.getElementById('leanLanguage');
            const selectedLanguage = leanLanguageSelect ? leanLanguageSelect.value : 'en';

            // Prepare connection config - exactly as per Lean docs
            const connectConfig = {
                app_token: appToken,
                permissions: [
                    "identity",
                    "accounts",
                    "balance",
                    "transactions",
                    "identities",
                    "scheduled_payments",
                    "standing_orders",
                    "direct_debits",
                    "beneficiaries"
                ],
                customer_id: currentCustomerId,
                sandbox: sandboxModeCheckbox.checked,
                access_token: currentAccessToken,
                fail_redirect_url: window.location.origin + '/lean-failed.html',
                success_redirect_url: window.location.origin + '/lean-success.html',
                account_type: accountType,
                language: selectedLanguage,  // "en" for English, "ar" for Arabic (with RTL support)
                // UI Customization (optional)
                customization: {
                    theme_color: "#667eea",           // Primary brand color
                    button_text_color: "#ffffff",     // White text on buttons
                    button_border_radius: 8,          // Number (pixels) or "pill" for fully rounded
                    link_color: "#667eea",            // Call-to-action element color
                    overlay_color: "rgba(0,0,0,0.5)" // Semi-transparent modal overlay
                    // dialog_mode: "uncontained"     // Uncomment for non-modal mode
                }
            };

            // Add bank_identifier if a bank is pre-selected
            if (selectedBank) {
                connectConfig.bank_identifier = selectedBank;
                debugLog('🏦 Bank pre-selected:', selectedBank);
            }

            debugLog('📋 Lean.connect() config:', connectConfig);

            // Debug: Check if Lean SDK is available
            console.log('🔍 Checking window.Lean:', window.Lean);
            console.log('🔍 typeof window.Lean:', typeof window.Lean);
            console.log('🔍 window.Lean.connect:', window.Lean?.connect);

            if (!window.Lean) {
                throw new Error('❌ window.Lean is not defined. SDK may not have loaded correctly.');
            }

            if (typeof window.Lean.connect !== 'function') {
                throw new Error('❌ window.Lean.connect is not a function. Available methods: ' + Object.keys(window.Lean).join(', '));
            }

            // Add callback to debug SDK response
            connectConfig.callback = function(response) {
                console.log('📱 Lean SDK Callback:', response);
                debugLog('📱 Lean SDK Response:', response);
            };

            // Call Lean.connect() directly
            console.log('🚀 Calling window.Lean.connect()...');
            const result = window.Lean.connect(connectConfig);
            console.log('✅ window.Lean.connect() returned:', result);

            debugLog('✅ Lean.connect() called - SDK popup should open');

            resultsDiv.innerHTML = `
                <div class="status-badge status-success">✅ Lean SDK Opened</div>
                <div class="response-item">
                    <strong>Status:</strong> Lean SDK window opened (full-screen takeover)
                </div>
                <div class="response-item">
                    <strong>Customer ID:</strong> ${currentCustomerId}
                </div>
                <div class="response-item">
                    <strong>Account Type:</strong> ${accountType}
                </div>
                <div class="response-item" style="background: #f0e7ff; padding: 10px; border-radius: 8px; border-left: 3px solid #667eea; margin-top: 10px;">
                    <strong>ℹ️ UI Note:</strong> Lean opens as a full-screen iframe takeover (not a centered modal like Plaid). This provides an immersive experience typical of Middle Eastern banking integrations.
                </div>
                <div class="help-box">
                    <h4>✅ Next Steps:</h4>
                    <ol>
                        <li>Complete the bank authentication in the Lean popup</li>
                        <li>Select your bank and log in</li>
                        <li>Grant permissions for data access</li>
                        <li>You'll be redirected back when done</li>
                    </ol>
                </div>
                <details class="json-details">
                    <summary>Connection Config</summary>
                    <pre>${JSON.stringify(connectConfig, null, 2)}</pre>
                </details>
            `;

        } catch (error) {
            console.error('❌ Connection error:', error);
            debugLog('❌ Connection failed:', error);

            resultsDiv.innerHTML = `
                <div class="status-badge status-error">❌ Connection Failed</div>
                <div class="response-item">
                    <strong>Error:</strong> ${error.message}
                </div>
                <div class="help-box">
                    <h4>Troubleshooting:</h4>
                    <ol>
                        <li>Make sure you clicked "Initialize Customer" first</li>
                        <li>Enable Debug Mode for detailed logs</li>
                        <li>Check browser console (F12) for errors</li>
                        <li>Ensure Lean SDK loaded (check for errors on page load)</li>
                        <li>Verify backend server is running on port 8000</li>
                        <li>Refresh the page and try again</li>
                    </ol>
                </div>
                <details class="json-details">
                    <summary>Error Details</summary>
                    <pre>${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}</pre>
                </details>
            `;
        }
    }

    /**
     * Get tokens for existing customer (2-step flow)
     */
    async function getTokensForExistingCustomer() {
        debugLog('🎫 Getting tokens for existing customer...');

        const customerId = existingCustomerIdInput.value.trim();

        resultsDiv.innerHTML = '<p class="loading">Calling Backend Server...<br>Step 1: Getting API Access Token...<br>Step 2: Getting Customer Access Token...</p>';
        resultsCard.style.display = 'block';

        // Validate customer ID
        if (!customerId) {
            resultsDiv.innerHTML = `
                <div class="status-badge status-error">❌ Validation Failed</div>
                <div class="response-item">
                    <strong>Error:</strong> Customer ID is required
                </div>
                <div class="help-box">
                    <h4>Please provide:</h4>
                    <p><strong>Customer ID:</strong> UUID format (e.g., 82e518a0-19fe-4561-ae2a-988b5056d5af)</p>
                </div>
            `;
            return;
        }

        // Basic validation for UUID format
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidPattern.test(customerId)) {
            resultsDiv.innerHTML = `
                <div class="status-badge status-error">❌ Invalid Customer ID</div>
                <div class="response-item">
                    <strong>Error:</strong> Customer ID must be a valid UUID format
                </div>
                <div class="help-box">
                    <p><strong>Expected format:</strong> xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</p>
                    <p><strong>Example:</strong> 82e518a0-19fe-4561-ae2a-988b5056d5af</p>
                </div>
            `;
            return;
        }

        try {
            debugLog('Calling backend API...');
            debugLog('Customer ID:', customerId);

            // Call the backend server - this makes 2 API calls (skip customer creation)
            const response = await fetch('http://localhost:8000/api/get-customer-tokens', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    customer_id: customerId
                })
            });

            if (!response.ok) {
                throw new Error(`Backend API failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Token retrieval failed');
            }

            // Store the customer data
            currentCustomerId = result.customer_id;
            currentAccessToken = result.access_token;

            // Update UI
            customerIdInput.value = currentCustomerId;
            accessTokenInput.value = currentAccessToken;

            // Enable connect button
            connectBtn.disabled = false;

            resultsDiv.innerHTML = `
                <div class="status-badge status-success">✅ Tokens Retrieved Successfully!</div>
                <div class="response-item">
                    <strong>Customer ID:</strong> ${currentCustomerId}
                </div>
                <div class="response-item">
                    <strong>Access Token:</strong> Obtained (JWT format)
                </div>
                <div class="response-item">
                    <strong>Token Scope:</strong> ${result.token_scope}
                </div>
                <div class="response-item">
                    <strong>Expires In:</strong> ${result.token_expires_in} seconds
                </div>
                <div class="help-box">
                    <h4>✅ 2-Step API Flow Completed!</h4>
                    <p>Tokens retrieved successfully:</p>
                    <ol>
                        <li>✅ API Access Token obtained</li>
                        <li>✅ Customer Access Token obtained</li>
                    </ol>
                    <p><strong>Next:</strong> Click "Connect with Lean" to link a bank account!</p>
                </div>
                <details class="json-details">
                    <summary>Full API Response</summary>
                    <pre>${JSON.stringify(result, null, 2)}</pre>
                </details>
            `;

            debugLog('✅ Tokens retrieved successfully', {
                customerId: currentCustomerId,
                tokenScope: result.token_scope
            });

            // Clear the input field
            existingCustomerIdInput.value = '';

        } catch (error) {
            console.error('❌ Token retrieval failed:', error);
            debugLog('❌ Failed to retrieve tokens:', error);

            resultsDiv.innerHTML = `
                <div class="status-badge status-error">❌ Token Retrieval Failed</div>
                <div class="response-item">
                    <strong>Error:</strong> ${error.message}
                </div>
                <div class="help-box">
                    <h4>Common Issues:</h4>
                    <ol>
                        <li>Check if the Customer ID exists in Lean system</li>
                        <li>Verify backend server is running on port 8000</li>
                        <li>Check browser console (F12) for detailed error</li>
                        <li>Enable Debug Mode for more information</li>
                    </ol>
                </div>
                <details class="json-details">
                    <summary>Error Details</summary>
                    <pre>${error.stack || error.message}</pre>
                </details>
            `;
        }
    }

    /**
     * Load Available Lean Banks
     */
    async function loadLeanBanks() {
        const loadBtn = document.getElementById('loadLeanBanksBtn');
        const bankSelect = document.getElementById('leanBankSelect');

        if (!loadBtn || !bankSelect) return;

        loadBtn.disabled = true;
        loadBtn.textContent = '⏳ Loading Banks...';

        try {
            debugLog('🏦 Fetching available Lean banks...');

            const response = await fetch('/api/lean/banks');
            if (!response.ok) {
                throw new Error('Failed to fetch Lean banks');
            }

            const data = await response.json();
            const banks = data.banks || [];

            debugLog('✅ Lean banks loaded:', banks.length);

            // Clear existing options (except the default one)
            bankSelect.innerHTML = '<option value="">Let user choose from all banks</option>';

            // Add banks to dropdown
            banks.forEach(bank => {
                const option = document.createElement('option');
                option.value = bank.identifier || bank.id;
                option.textContent = `${bank.name || bank.display_name} (${bank.identifier || bank.id})`;
                bankSelect.appendChild(option);
            });

            loadBtn.textContent = `✅ Loaded ${banks.length} Banks`;

            setTimeout(() => {
                loadBtn.textContent = '🏦 Load Available Banks';
                loadBtn.disabled = false;
            }, 2000);

        } catch (error) {
            console.error('❌ Failed to load Lean banks:', error);
            debugLog('❌ Error loading banks:', error);
            alert('Failed to load banks: ' + error.message);
            loadBtn.textContent = '❌ Load Failed';
            setTimeout(() => {
                loadBtn.textContent = '🏦 Load Available Banks';
                loadBtn.disabled = false;
            }, 2000);
        }
    }

    // Attach event listeners
    initBtn.addEventListener('click', initializeCustomer);
    connectBtn.addEventListener('click', connectToBank);
    getTokensBtn.addEventListener('click', getTokensForExistingCustomer);

    const loadLeanBanksBtn = document.getElementById('loadLeanBanksBtn');
    if (loadLeanBanksBtn) {
        loadLeanBanksBtn.addEventListener('click', loadLeanBanks);
    }

    // Initialize on page load
    console.log('='.repeat(50));
    console.log('🏦 Lean SDK Test Integration (Builder Pattern)');
    console.log('='.repeat(50));

    // Fetch app configuration on load
    fetchAppConfig().catch(error => {
        console.error('❌ Failed to load app configuration:', error);
    });

    // Check SDK loading - optimized with reduced delay
    setTimeout(() => {
        if (window.leanLinkError) {
            console.error('❌ Lean SDK failed to load from CDN');
            resultsCard.style.display = 'block';
            resultsDiv.innerHTML = `
                <div class="status-badge status-error">❌ SDK Loading Error</div>
                <div class="response-item">
                    <strong>Error:</strong> Lean SDK script failed to load from CDN
                </div>
                <div class="help-box">
                    <h4>Possible Solutions:</h4>
                    <ol>
                        <li>Check your internet connection</li>
                        <li>Refresh the page</li>
                        <li>Check if CDN is accessible: https://cdn.leantech.me</li>
                    </ol>
                </div>
            `;
        } else if (window.leanLinkLoaded) {
            console.log('✅ Lean SDK loaded successfully');

            // Debug what's available
            const leanSdk = window.Lean || window.LeanLink;
            if (leanSdk) {
                console.log('✅ SDK object available:', typeof leanSdk);
                console.log('✅ SDK methods:', Object.keys(leanSdk).join(', '));

                if (leanSdk.Builder) {
                    console.log('✅ Builder pattern available');
                } else {
                    console.warn('⚠️ Builder pattern NOT available');
                }
            }
        } else {
            console.log('⏳ Lean SDK still loading...');
        }
    }, 500);

    /**
     * Step 3: Consent Management Functionality
     */
    const listConsentsBtn = document.getElementById('listConsentsBtn');
    const consentCustomerIdInput = document.getElementById('consentCustomerId');
    const consentEntityIdInput = document.getElementById('consentEntityId');
    const consentsList = document.getElementById('consentsList');

    if (listConsentsBtn) {
        listConsentsBtn.addEventListener('click', async function() {
            const customerId = consentCustomerIdInput.value;
            const entityId = consentEntityIdInput.value;

            if (!customerId || !entityId) {
                alert('❌ Customer ID and Entity ID are required');
                return;
            }

            listConsentsBtn.disabled = true;
            listConsentsBtn.textContent = '⏳ Loading Consents...';
            consentsList.innerHTML = '<p>Loading consents...</p>';

            try {
                const response = await fetch('http://localhost:8000/api/consents', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        customer_id: customerId,
                        entity_id: entityId
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch consents');
                }

                console.log('📋 Consents Data:', data);
                console.log('📋 Full Response Structure:', JSON.stringify(data, null, 2));

                // Handle nested data structure: data.data or data directly
                const consents = data.data?.data || data.data || data.consents || [];

                console.log('📋 Parsed Consents Array:', consents);
                console.log('📋 Consents Length:', consents.length);

                if (consents && consents.length > 0) {
                    let html = '<h3>✅ Consents Retrieved (' + consents.length + ')</h3>';

                    for (const consent of consents) {
                        const consentId = consent.consent_id || consent.id;
                        const consentStatus = consent.consent_status || consent.status || 'UNKNOWN';
                        const createdAt = consent.creation_date_time || consent.created_at || 'N/A';
                        const expiresAt = consent.expiration_date_time || consent.expires_at || 'N/A';
                        const permissions = consent.permissions || [];

                        // Format permissions based on data type
                        let permissionsDisplay = 'None';
                        if (Array.isArray(permissions) && permissions.length > 0) {
                            permissionsDisplay = permissions.join(', ');
                        } else if (typeof permissions === 'object' && permissions !== null) {
                            // Convert object to readable list
                            const permList = Object.entries(permissions)
                                .filter(([key, value]) => value === true || value === 'true')
                                .map(([key]) => key)
                                .join(', ');
                            permissionsDisplay = permList || JSON.stringify(permissions);
                        } else if (permissions && typeof permissions === 'string') {
                            permissionsDisplay = permissions;
                        }

                        html += `
                            <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: #f9f9f9;">
                                <h4 style="margin-top: 0; color: #2d3748;">Consent: ${consentId}</h4>
                                <p><strong>Status:</strong> <span style="color: ${consentStatus === 'ACTIVE' || consentStatus === 'AUTHORISED' ? '#38a169' : '#e53e3e'};">${consentStatus}</span></p>
                                <p><strong>Created:</strong> ${createdAt}</p>
                                <p><strong>Expires:</strong> ${expiresAt}</p>
                                <p><strong>Permissions:</strong> ${permissionsDisplay}</p>
                                <button onclick="deleteConsent('${consentId}')" style="padding: 8px 16px; background: #e53e3e; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 0.9em;">
                                    🗑️ Delete Consent
                                </button>
                            </div>
                        `;
                    }

                    consentsList.innerHTML = html;
                } else {
                    // Show raw response for debugging
                    consentsList.innerHTML = `
                        <p style="color: #ed8936;">⚠️ No consents found in expected format</p>
                        <details style="margin-top: 15px;">
                            <summary style="cursor: pointer; font-weight: bold;">📋 Raw API Response (Debug)</summary>
                            <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; margin-top: 10px;">${JSON.stringify(data, null, 2)}</pre>
                        </details>
                    `;
                }

                listConsentsBtn.disabled = false;
                listConsentsBtn.textContent = '📋 List Consents';

            } catch (error) {
                console.error('❌ Error fetching consents:', error);
                consentsList.innerHTML = '<p style="color: #f56565;">❌ Error: ' + error.message + '</p>';
                listConsentsBtn.disabled = false;
                listConsentsBtn.textContent = '📋 List Consents';
            }
        });
    }

    /**
     * Step 4: Fetch Accounts Functionality
     */
    const fetchAccountsBtn = document.getElementById('fetchAccountsBtn');
    const entityIdInput = document.getElementById('entityId');
    const accountsList = document.getElementById('accountsList');

    if (fetchAccountsBtn) {
        fetchAccountsBtn.addEventListener('click', async function() {
            const entityId = entityIdInput.value;

            if (!entityId) {
                alert('❌ No entity ID available. Please connect a bank account first.');
                return;
            }

            fetchAccountsBtn.disabled = true;
            fetchAccountsBtn.textContent = '⏳ Fetching Accounts...';
            accountsList.innerHTML = '<p>Loading accounts...</p>';

            try {
                const response = await fetch(`http://localhost:8000/api/accounts?entity_id=${entityId}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch accounts');
                }

                console.log('📊 Accounts Data:', data);
                console.log('📊 Full Response Structure:', JSON.stringify(data, null, 2));

                // Handle nested data structure: data.data.accounts or data.accounts
                const accounts = data.data?.accounts || data.accounts || [];

                console.log('📊 Parsed Accounts Array:', accounts);
                console.log('📊 Accounts Length:', accounts.length);

                // Display accounts
                if (accounts && accounts.length > 0) {
                    let html = '<h3>✅ Accounts Retrieved (' + accounts.length + ')</h3>';

                    for (const account of accounts) {
                        const accountId = account.account_id || account.id;
                        const entityId = account.entity_id;
                        const accountName = account.nickname || account.description || account.account?.[0]?.name || 'Unknown Account';
                        const accountType = account.account_type || account.type || 'N/A';
                        const accountSubType = account.account_sub_type || account.sub_type || '';
                        const accountNumber = account.account?.[0]?.identification || account.number || 'N/A';
                        const currency = account.currency || 'SAR';
                        const status = account.status || 'UNKNOWN';

                        html += `
                            <div style="background: #f7fafc; padding: 20px; border-radius: 10px; margin: 15px 0; border-left: 4px solid #667eea;">
                                <h4 style="margin-top: 0;">🏦 ${accountName}</h4>
                                <p><strong>Account ID:</strong> <code style="font-size: 0.85em;">${accountId}</code></p>
                                <p><strong>Type:</strong> ${accountType}${accountSubType ? ' - ' + accountSubType : ''}</p>
                                <p><strong>Number:</strong> ${accountNumber}</p>
                                <p><strong>Currency:</strong> ${currency} | <strong>Status:</strong> <span style="color: ${status === 'ENABLED' ? '#48bb78' : '#ed8936'}">${status}</span></p>
                                <button class="connect-btn" onclick="fetchBalances('${accountId}', '${entityId}')" style="margin-right: 10px; padding: 10px 20px; font-size: 0.9em;">
                                    💰 Get Balances
                                </button>
                                <button class="connect-btn" onclick="fetchTransactions('${accountId}', '${entityId}')" style="padding: 10px 20px; font-size: 0.9em; background: linear-gradient(135deg, #f093fb, #f5576c);">
                                    📋 Get Transactions
                                </button>
                                <div id="account-data-${accountId}" style="margin-top: 15px;"></div>
                            </div>
                        `;
                    }

                    accountsList.innerHTML = html;
                } else {
                    // Show raw response for debugging
                    accountsList.innerHTML = `
                        <p style="color: #ed8936;">⚠️ No accounts found in expected format</p>
                        <details style="margin-top: 15px;">
                            <summary style="cursor: pointer; font-weight: bold;">📊 Raw API Response (Debug)</summary>
                            <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; margin-top: 10px;">${JSON.stringify(data, null, 2)}</pre>
                        </details>
                    `;
                }

                fetchAccountsBtn.disabled = false;
                fetchAccountsBtn.textContent = '📊 Fetch Accounts';

            } catch (error) {
                console.error('❌ Error fetching accounts:', error);
                accountsList.innerHTML = '<p style="color: #f56565;">❌ Error: ' + error.message + '</p>';
                fetchAccountsBtn.disabled = false;
                fetchAccountsBtn.textContent = '📊 Fetch Accounts';
            }
        });
    }
});

/**
 * Fetch Balances for Account
 */
async function fetchBalances(accountId, entityId) {
    const container = document.getElementById(`account-data-${accountId}`);
    container.innerHTML = '<p>⏳ Loading balances...</p>';

    try {
        const response = await fetch(`http://localhost:8000/api/accounts/${accountId}/balances?entity_id=${entityId}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || data.error || 'Failed to fetch balances');
        }

        console.log('💰 Balances Data:', data);
        console.log('💰 Full Response Structure:', JSON.stringify(data, null, 2));

        // The Lean API returns balances directly in data.balances
        // Structure: data.data.balances (array of balance objects)
        const balances = data.data?.balances || [];

        console.log('💰 Parsed Balances Array:', balances);
        console.log('💰 Balances Length:', balances.length);

        let html = '<div style="background: #e6fffa; padding: 15px; border-radius: 8px; margin-top: 10px;">';
        html += '<h5 style="margin-top: 0; color: #2c7a7b;">💰 Account Balances</h5>';

        if (balances && balances.length > 0) {
            for (const balance of balances) {
                const balanceType = balance.type || balance.balance_type || 'Balance';
                const amount = balance.amount?.amount || balance.amount || '0';
                const currency = balance.amount?.currency || balance.currency || 'SAR';
                const creditDebit = balance.credit_debit_indicator || balance.indicator || '';

                html += `<p style="margin: 8px 0; padding: 8px; background: white; border-radius: 5px;">
                    <strong>${balanceType}:</strong>
                    <span style="color: ${creditDebit === 'CREDIT' ? '#48bb78' : '#c53030'}; font-weight: bold;">
                        ${amount} ${currency}
                    </span>
                    ${creditDebit ? ` (${creditDebit})` : ''}
                </p>`;
            }
        } else {
            // Show helpful message
            html += '<p style="color: #d97706;">⚠️ No balance data available from Lean Sandbox</p>';
            html += '<p style="font-size: 0.9em; color: #6b7280;"><strong>Note:</strong> The Lean Sandbox environment does not return actual balance amounts in the API response. This is a known limitation of the sandbox. In production, this endpoint will return real balance data.</p>';
            html += '<details style="margin-top: 10px;">';
            html += '<summary style="cursor: pointer; font-weight: bold;">📋 View Full API Response</summary>';
            html += '<pre style="background: white; padding: 10px; border-radius: 5px; overflow-x: auto; margin-top: 5px; font-size: 0.75em;">' + JSON.stringify(data, null, 2) + '</pre>';
            html += '</details>';
        }

        html += '</div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('❌ Error fetching balances:', error);
        container.innerHTML = '<p style="color: #f56565;">❌ Error: ' + error.message + '</p>';
    }
}

/**
 * Fetch Transactions for Account
 */
async function fetchTransactions(accountId, entityId) {
    const container = document.getElementById(`account-data-${accountId}`);
    container.innerHTML = '<p>⏳ Loading transactions...</p>';

    try {
        const response = await fetch(`http://localhost:8000/api/accounts/${accountId}/transactions?entity_id=${entityId}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || data.error || 'Failed to fetch transactions');
        }

        console.log('📋 Transactions Data:', data);
        console.log('📋 Full Response Structure:', JSON.stringify(data, null, 2));

        // The Lean API returns transactions in data.data.transactions
        // Structure matches balance: data.data.transactions (array of transaction objects)
        const transactions = data.data?.transactions || [];

        console.log('📋 Parsed Transactions Array:', transactions);
        console.log('📋 Transactions Length:', transactions.length);

        let html = '<div style="background: #fff5f5; padding: 15px; border-radius: 8px; margin-top: 10px; max-height: 400px; overflow-y: auto;">';
        html += '<h5 style="margin-top: 0; color: #c53030;">📋 Recent Transactions</h5>';

        if (transactions && transactions.length > 0) {
            for (const txn of transactions.slice(0, 10)) {
                const description = txn.transaction_information || txn.description || txn.merchant?.name || 'Transaction';
                const amount = txn.amount?.amount || txn.amount || '0';
                const currency = txn.amount?.currency || txn.currency || 'SAR';
                const creditDebit = txn.credit_debit_indicator || txn.indicator || '';
                const date = txn.booking_date_time || txn.date || txn.value_date_time || 'N/A';
                const status = txn.status || '';
                const category = txn.transaction_category || '';

                const amountColor = creditDebit === 'CREDIT' ? '#48bb78' : '#c53030';

                html += `
                    <div style="border-bottom: 1px solid #fed7d7; padding: 12px 0;">
                        <p style="margin: 5px 0;"><strong>${description}</strong></p>
                        <p style="margin: 5px 0;">
                            Amount: <strong style="color: ${amountColor};">${creditDebit === 'CREDIT' ? '+' : '-'}${amount} ${currency}</strong>
                            ${status ? `<span style="font-size: 0.8em; color: #718096;"> • ${status}</span>` : ''}
                        </p>
                        ${category ? `<p style="margin: 5px 0; font-size: 0.85em; color: #718096;">Category: ${category}</p>` : ''}
                        <p style="margin: 5px 0; font-size: 0.85em; color: #718096;">Date: ${date}</p>
                    </div>
                `;
            }
            if (transactions.length > 10) {
                html += `<p style="margin-top: 10px; color: #718096;">... and ${transactions.length - 10} more transactions</p>`;
            }
        } else {
            // Check if API returned successfully but with empty transactions array
            if (data.status === 'OK' && data.type === 'transactions') {
                html += '<p style="color: #10b981;">✅ API call successful - No transactions found for this account</p>';
                html += '<p style="font-size: 0.9em; color: #6b7280;">This account may be new or have no transaction history in the sandbox environment.</p>';
            } else {
                html += '<p style="color: #d97706;">⚠️ No transaction data available</p>';
                html += '<p style="font-size: 0.9em; color: #6b7280;">The API response may not contain transaction data.</p>';
            }
            html += '<details style="margin-top: 10px;">';
            html += '<summary style="cursor: pointer; font-weight: bold;">📋 View Full API Response</summary>';
            html += '<pre style="background: white; padding: 10px; border-radius: 5px; overflow-x: auto; margin-top: 5px; font-size: 0.75em;">' + JSON.stringify(data, null, 2) + '</pre>';
            html += '</details>';
        }

        html += '</div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('❌ Error fetching transactions:', error);
        container.innerHTML = '<p style="color: #f56565;">❌ Error: ' + error.message + '</p>';
    }
}

/**
 * Delete Consent (Global function for onclick handler)
 */
async function deleteConsent(consentId) {
    const customerId = document.getElementById('consentCustomerId').value;
    const entityId = document.getElementById('consentEntityId').value;

    if (!confirm(`⚠️ Are you sure you want to delete consent: ${consentId}?`)) {
        return;
    }

    try {
        const response = await fetch('http://localhost:8000/api/consents/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                customer_id: customerId,
                entity_id: entityId,
                consent_id: consentId,
                reason: 'USER_REQUESTED'
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to delete consent');
        }

        console.log('✅ Consent deleted:', consentId);
        alert('✅ Consent deleted successfully!');

        // Refresh the consents list
        document.getElementById('listConsentsBtn').click();

    } catch (error) {
        console.error('❌ Error deleting consent:', error);
        alert('❌ Error deleting consent: ' + error.message);
    }
}

