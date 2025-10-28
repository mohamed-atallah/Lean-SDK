/**
 * Plaid Integration - Frontend Logic
 * This script handles the Plaid Link integration flow
 */

// Global state for Plaid
let plaidLinkToken = null;
let plaidAccessToken = null;
let plaidItemId = null;
let plaidHandler = null;

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('='.repeat(50));
    console.log('🔵 Plaid Integration Initialized');
    console.log('='.repeat(50));

    // Check if returning from Plaid success/failure
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('plaid_success') === 'true') {
        showPlaidSuccessBanner();
    }

    // Get DOM elements
    const initPlaidBtn = document.getElementById('initPlaidBtn');
    const plaidResultsDiv = document.getElementById('plaidResults');
    const plaidAccountsList = document.getElementById('plaidAccountsList');
    const fetchPlaidAccountsBtn = document.getElementById('fetchPlaidAccountsBtn');
    const fetchInstitutionsBtn = document.getElementById('fetchInstitutionsBtn');
    const fetchRecipientsBtn = document.getElementById('fetchRecipientsBtn');
    const countrySelect = document.getElementById('countrySelect');
    const institutionsList = document.getElementById('institutionsList');
    const recipientsList = document.getElementById('recipientsList');
    const institutionsResults = document.getElementById('institutionsResults');
    const recipientsResults = document.getElementById('recipientsResults');

    /**
     * Initialize Plaid Link
     */
    async function initializePlaid() {
        console.log('🔗 Initializing Plaid Link...');
        plaidResultsDiv.innerHTML = '<p class="loading">Creating Plaid Link Token...</p>';
        plaidResultsDiv.style.display = 'block';

        try {
            // Get user_id from input field or generate one
            const userIdInput = document.getElementById('plaidUserId');
            const userId = userIdInput && userIdInput.value.trim()
                ? userIdInput.value.trim()
                : `user_${Date.now()}`;

            console.log('👤 Using User ID:', userId);

            // Get selected institution (if any) - will be sent to backend for link token
            const institutionSelect = document.getElementById('plaidInstitutionSelect');
            const selectedInstitution = institutionSelect && institutionSelect.value ? institutionSelect.value : null;

            if (selectedInstitution) {
                console.log('🏦 Institution pre-selected:', selectedInstitution);
                console.log('📤 Sending institution_id to backend for link token creation');
            }

            // Step 1: Create Link Token via backend with institution_id
            let linkTokenRequest = {
                user_id: userId
            };

            // Add institution_id if selected - this makes Plaid skip institution selection
            if (selectedInstitution) {
                linkTokenRequest.institution_id = selectedInstitution;
            }

            let response = await fetch('http://localhost:8000/api/plaid/create-link-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(linkTokenRequest)
            });

            let data = await response.json();
            console.log('📥 Initial Response:', { ok: response.ok, status: response.status, error_type: data.error_type });

            // If institution_id is invalid, retry without it
            if (!response.ok && (data.error_type === 'INVALID_INSTITUTION' || (data.error && data.error.includes('INVALID_INSTITUTION')))) {
                console.warn('⚠️ Invalid institution ID detected, initiating retry...');
                console.warn('   Institution attempted:', selectedInstitution);
                console.warn('   Error type:', data.error_type);
                console.warn('   Full error:', data.error);

                plaidResultsDiv.innerHTML = `
                    <div class="status-badge" style="background: linear-gradient(135deg, #fbbf24, #f59e0b); color: white;">⚠️ Institution Not Available</div>
                    <div class="response-item">
                        <strong>Institution "${selectedInstitution}" not available in sandbox mode</strong>
                        <p style="margin: 10px 0 0 0; font-size: 0.9em;">This institution is only available in production mode.</p>
                    </div>
                    <p class="loading">🔄 Retrying with all available sandbox banks...</p>
                `;

                // Small delay to show the message
                await new Promise(resolve => setTimeout(resolve, 500));

                // Retry without institution_id
                console.log('🔄 Retrying without institution_id...');
                linkTokenRequest = { user_id: userId };
                response = await fetch('http://localhost:8000/api/plaid/create-link-token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(linkTokenRequest)
                });

                data = await response.json();
                console.log('📥 Retry Response:', { ok: response.ok, status: response.status, has_link_token: !!data.link_token });
            }

            // Check if final response is successful
            if (!response.ok) {
                console.error('❌ Final response not OK:', data);
                throw new Error(data.error || 'Failed to create link token');
            }

            if (!data.link_token) {
                console.error('❌ No link token in response:', data);
                throw new Error('No link token returned from server');
            }

            plaidLinkToken = data.link_token;
            console.log('✅ Link Token created:', plaidLinkToken);

            // Step 2: Initialize Plaid Link
            if (typeof Plaid === 'undefined') {
                throw new Error('Plaid Link SDK not loaded');
            }

            // Configure Plaid Link (institution_id already in link token)
            // NOTE: Plaid Link opens as a centered modal dialog (not full-screen)
            // This is by design from Plaid and cannot be customized
            // Different from Lean SDK which opens as a full-screen takeover
            const plaidConfig = {
                token: plaidLinkToken,
                onSuccess: handlePlaidSuccess,
                onExit: handlePlaidExit,
                onEvent: handlePlaidEvent
            };

            plaidHandler = Plaid.create(plaidConfig);

            // Step 3: Open Plaid Link
            // Opens as a centered modal dialog on top of the current page
            console.log('🚀 Opening Plaid Link...');
            plaidHandler.open();

            plaidResultsDiv.innerHTML = `
                <div class="status-badge status-success">✅ Plaid Link Opened</div>
                <div class="response-item">
                    <strong>Status:</strong> Plaid Link modal opened (centered dialog)
                </div>
                <div class="response-item" style="background: #e6fffa; padding: 10px; border-radius: 8px; border-left: 3px solid #00d4aa; margin-top: 10px;">
                    <strong>ℹ️ UI Note:</strong> Plaid opens as a centered modal dialog (not full-screen like Lean SDK). This is by design from Plaid and matches standard US banking integration patterns.
                </div>
                <div class="help-box">
                    <h4>Next Steps:</h4>
                    <ol>
                        <li>Select your bank from the list</li>
                        <li>Log in with your credentials</li>
                        <li>For Sandbox: Use username "user_good" and password "pass_good"</li>
                        <li>Complete the authentication flow</li>
                    </ol>
                </div>
            `;

        } catch (error) {
            console.error('❌ Plaid initialization failed:', error);
            plaidResultsDiv.innerHTML = `
                <div class="status-badge status-error">❌ Initialization Failed</div>
                <div class="response-item">
                    <strong>Error:</strong> ${error.message}
                </div>
                <div class="help-box">
                    <h4>Common Issues:</h4>
                    <ol>
                        <li>Verify Plaid credentials are set in .env file</li>
                        <li>Check browser console for errors</li>
                        <li>Ensure backend server is running on port 8000</li>
                        <li>Verify Plaid Link script is loaded</li>
                    </ol>
                </div>
            `;
        }
    }

    /**
     * Handle Plaid Link Success
     */
    async function handlePlaidSuccess(public_token, metadata) {
        console.log('🎉 Plaid Link Success!');
        console.log('Public Token:', public_token);
        console.log('Metadata:', metadata);

        plaidResultsDiv.innerHTML = `
            <div class="status-badge status-success">✅ Connection Successful!</div>
            <div class="response-item">
                <strong>🔑 Public Token (temporary):</strong>
                <code style="display: block; background: #f7fafc; padding: 10px; border-radius: 5px; margin-top: 5px; word-break: break-all; font-size: 0.85em;">${public_token}</code>
            </div>
            <p class="loading">🔄 Exchanging Public Token for Access Token...</p>
        `;

        try {
            // Exchange public token for access token
            const response = await fetch('http://localhost:8000/api/plaid/exchange-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    public_token: public_token
                })
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Failed to exchange token');
            }

            plaidAccessToken = data.access_token;
            plaidItemId = data.item_id;

            console.log('✅ Access Token obtained:', plaidAccessToken);
            console.log('✅ Item ID:', plaidItemId);

            // Get user_id from either automatic or manual input
            const userIdInput = document.getElementById('plaidUserId');
            const manualUserIdInput = document.getElementById('manualUserId');

            let userId = userIdInput && userIdInput.value.trim()
                ? userIdInput.value.trim()
                : manualUserIdInput && manualUserIdInput.value.trim()
                    ? manualUserIdInput.value.trim()
                    : localStorage.getItem('plaid_last_user_id') || `user_${Date.now()}`;

            // Save connection details
            await savePlaidConnection({
                user_id: userId,
                access_token: plaidAccessToken,
                item_id: plaidItemId,
                institution_id: metadata.institution?.institution_id,
                institution_name: metadata.institution?.name,
                accounts: metadata.accounts
            });

            // Store in localStorage
            localStorage.setItem('plaid_access_token', plaidAccessToken);
            localStorage.setItem('plaid_item_id', plaidItemId);
            localStorage.setItem('plaid_institution', JSON.stringify(metadata.institution));

            // Show success message
            plaidResultsDiv.innerHTML = `
                <div class="status-badge status-success">✅ Connection Successful!</div>
                <div class="response-item">
                    <strong>🔑 Public Token (temporary):</strong>
                    <code style="display: block; background: #f7fafc; padding: 10px; border-radius: 5px; margin-top: 5px; word-break: break-all; font-size: 0.85em;">${public_token}</code>
                    <small style="color: #718096;">⚠️ Single-use token - already exchanged for access_token</small>
                </div>
                <div class="response-item">
                    <strong>Institution:</strong> ${metadata.institution?.name || 'N/A'}
                </div>
                <div class="response-item">
                    <strong>🔐 Access Token (permanent):</strong>
                    <code style="display: block; background: #f7fafc; padding: 10px; border-radius: 5px; margin-top: 5px; word-break: break-all; font-size: 0.85em;">${plaidAccessToken}</code>
                </div>
                <div class="response-item">
                    <strong>Item ID:</strong> ${plaidItemId}
                </div>
                <div class="response-item">
                    <strong>Accounts Connected:</strong> ${metadata.accounts?.length || 0}
                </div>
                <div class="help-box">
                    <h4>✅ Success!</h4>
                    <p>Your bank account has been successfully connected via Plaid.</p>
                    <p><strong>Next:</strong> Click "Fetch Accounts" below to view your account details!</p>
                </div>
            `;

            // Enable fetch accounts button
            if (fetchPlaidAccountsBtn) {
                fetchPlaidAccountsBtn.disabled = false;
            }

        } catch (error) {
            console.error('❌ Token exchange failed:', error);
            plaidResultsDiv.innerHTML = `
                <div class="status-badge status-error">❌ Token Exchange Failed</div>
                <div class="response-item">
                    <strong>Error:</strong> ${error.message}
                </div>
            `;
        }
    }

    /**
     * Handle Plaid Link Exit
     */
    function handlePlaidExit(err, metadata) {
        console.log('🚪 Plaid Link Exit');
        console.log('Error:', err);
        console.log('Metadata:', metadata);

        if (err != null) {
            plaidResultsDiv.innerHTML = `
                <div class="status-badge status-error">❌ Connection Failed</div>
                <div class="response-item">
                    <strong>Error:</strong> ${err.error_message || err.display_message || 'Unknown error'}
                </div>
                <div class="help-box">
                    <h4>What happened?</h4>
                    <p>${err.error_message || 'The connection was not completed.'}</p>
                    <p><strong>Try again:</strong> Click "Initialize Plaid" to restart the process.</p>
                </div>
            `;
        } else {
            plaidResultsDiv.innerHTML = `
                <div class="status-badge status-cancelled">⚠️ Connection Cancelled</div>
                <div class="response-item">
                    <strong>Status:</strong> User cancelled the connection
                </div>
                <div class="help-box">
                    <p>You can restart the process by clicking "Initialize Plaid" again.</p>
                </div>
            `;
        }
    }

    /**
     * Handle Plaid Link Events (for debugging)
     */
    function handlePlaidEvent(eventName, metadata) {
        console.log('📊 Plaid Event:', eventName, metadata);
    }

    /**
     * Save Plaid connection to backend
     */
    async function savePlaidConnection(connectionData) {
        try {
            await fetch('http://localhost:8000/api/plaid/save-connection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(connectionData)
            });
            console.log('💾 Connection saved to backend');
        } catch (error) {
            console.error('❌ Failed to save connection:', error);
        }
    }

    /**
     * Fetch Plaid Accounts
     */
    async function fetchPlaidAccounts() {
        console.log('📊 Fetching Plaid Accounts...');

        const accessToken = plaidAccessToken || localStorage.getItem('plaid_access_token');

        if (!accessToken) {
            alert('Please connect a bank account first');
            return;
        }

        fetchPlaidAccountsBtn.disabled = true;
        fetchPlaidAccountsBtn.textContent = '⏳ Loading Accounts...';
        plaidAccountsList.innerHTML = '<p>Loading accounts...</p>';

        try {
            const response = await fetch('http://localhost:8000/api/plaid/accounts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    access_token: accessToken
                })
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Failed to fetch accounts');
            }

            console.log('📊 Accounts Data:', data);

            const accounts = data.accounts || [];

            if (accounts.length > 0) {
                let html = '<h3>✅ Accounts Retrieved (' + accounts.length + ')</h3>';

                for (const account of accounts) {
                    const accountName = account.name || 'Unknown Account';
                    const accountType = account.type || 'N/A';
                    const accountSubtype = account.subtype || '';
                    const mask = account.mask || 'N/A';
                    const balance = account.balances?.current || 0;
                    const currency = account.balances?.iso_currency_code || 'USD';

                    html += `
                        <div style="background: #f7fafc; padding: 20px; border-radius: 10px; margin: 15px 0; border-left: 4px solid #00d4aa;">
                            <h4 style="margin-top: 0;">💳 ${accountName}</h4>
                            <p><strong>Account ID:</strong> <code style="font-size: 0.85em;">${account.account_id}</code></p>
                            <p><strong>Type:</strong> ${accountType}${accountSubtype ? ' - ' + accountSubtype : ''}</p>
                            <p><strong>Mask:</strong> ****${mask}</p>
                            <p><strong>Balance:</strong> ${currency} ${balance.toFixed(2)}</p>
                            <button class="connect-btn" onclick="fetchPlaidTransactionsFor('${account.account_id}', '${accessToken}')" style="margin-top: 10px; padding: 10px 20px; font-size: 0.9em;">
                                📋 Get Transactions
                            </button>
                            <div id="plaid-account-data-${account.account_id}" style="margin-top: 15px;"></div>
                        </div>
                    `;
                }

                plaidAccountsList.innerHTML = html;

                // Populate account filter checkboxes for balance filtering
                populateAccountFilterCheckboxes(accounts);

                // Show the balances card
                const plaidBalancesCard = document.getElementById('plaidBalancesCard');
                if (plaidBalancesCard) {
                    plaidBalancesCard.style.display = 'block';
                }
            } else {
                plaidAccountsList.innerHTML = '<p style="color: #ed8936;">⚠️ No accounts found</p>';
            }

            fetchPlaidAccountsBtn.disabled = false;
            fetchPlaidAccountsBtn.textContent = '📊 Fetch Accounts';

        } catch (error) {
            console.error('❌ Error fetching accounts:', error);
            plaidAccountsList.innerHTML = '<p style="color: #f56565;">❌ Error: ' + error.message + '</p>';
            fetchPlaidAccountsBtn.disabled = false;
            fetchPlaidAccountsBtn.textContent = '📊 Fetch Accounts';
        }
    }

    /**
     * Show success banner
     */
    function showPlaidSuccessBanner() {
        const banner = document.getElementById('plaidSuccessBanner');
        if (banner) {
            banner.style.display = 'block';
        }
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    /**
     * Fetch Available Institutions (Banks)
     */
    async function fetchInstitutions() {
        console.log('🏦 Fetching Available Banks...');

        const countryCode = countrySelect.value;
        fetchInstitutionsBtn.disabled = true;
        fetchInstitutionsBtn.textContent = '⏳ Loading Banks...';
        institutionsList.style.display = 'block';
        institutionsResults.innerHTML = '<p>Loading institutions...</p>';

        try {
            const response = await fetch('http://localhost:8000/api/plaid/institutions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    country_code: countryCode,
                    count: 100,
                    offset: 0
                })
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Failed to fetch institutions');
            }

            console.log('🏦 Institutions Data:', data);

            const institutions = data.institutions || [];

            // Also populate the institution select dropdown
            const institutionSelect = document.getElementById('plaidInstitutionSelect');
            if (institutionSelect && institutions.length > 0) {
                // SANDBOX-ONLY institutions (these work with sandbox credentials)
                // All use username: "user_good", password: "pass_good"
                const sandboxInstitutions = [
                    'ins_109508', // First Platypus Bank
                    'ins_109509', // First Gingham Credit Union
                    'ins_109510', // Tattersall Federal Credit Union
                    'ins_109511', // Houndstooth Bank
                    'ins_109512', // Tartan Bank
                    'ins_109513', // Platinum Standard Bank
                    'ins_109514'  // Gold Standard Bank
                ];

                // Clear and repopulate dropdown
                institutionSelect.innerHTML = '<option value="">Let user choose from all sandbox banks</option>';

                // Filter to show ONLY sandbox institutions
                const sandboxInsts = institutions.filter(inst => sandboxInstitutions.includes(inst.institution_id));

                if (sandboxInsts.length > 0) {
                    const optgroup = document.createElement('optgroup');
                    optgroup.label = '✅ Sandbox Test Banks (username: user_good, password: pass_good)';
                    sandboxInsts.forEach(inst => {
                        const option = document.createElement('option');
                        option.value = inst.institution_id;
                        option.textContent = `${inst.name} (${inst.institution_id})`;
                        optgroup.appendChild(option);
                    });
                    institutionSelect.appendChild(optgroup);
                    console.log(`✅ Populated institution dropdown: ${sandboxInsts.length} sandbox test banks`);
                } else {
                    console.warn('⚠️ No sandbox institutions found in the API response');
                    // Add manual fallback options
                    const optgroup = document.createElement('optgroup');
                    optgroup.label = '✅ Sandbox Test Banks (use if API fails)';
                    const manualBanks = [
                        { id: 'ins_109508', name: 'First Platypus Bank' },
                        { id: 'ins_109509', name: 'First Gingham Credit Union' },
                        { id: 'ins_109510', name: 'Tattersall Federal Credit Union' },
                        { id: 'ins_109511', name: 'Houndstooth Bank' },
                        { id: 'ins_109512', name: 'Tartan Bank' }
                    ];
                    manualBanks.forEach(bank => {
                        const option = document.createElement('option');
                        option.value = bank.id;
                        option.textContent = `${bank.name} (${bank.id})`;
                        optgroup.appendChild(option);
                    });
                    institutionSelect.appendChild(optgroup);
                    console.log(`✅ Added ${manualBanks.length} manual sandbox banks as fallback`);
                }
            }

            // Filter to show ONLY sandbox institutions in the display list
            const sandboxInstIds = [
                'ins_109508', // First Platypus Bank
                'ins_109509', // First Gingham Credit Union
                'ins_109510', // Tattersall Federal Credit Union
                'ins_109511', // Houndstooth Bank
                'ins_109512', // Tartan Bank
                'ins_109513', // Platinum Standard Bank
                'ins_109514'  // Gold Standard Bank
            ];

            const sandboxInstitutionsDisplay = institutions.filter(inst =>
                sandboxInstIds.includes(inst.institution_id)
            );

            if (sandboxInstitutionsDisplay.length > 0) {
                let html = '<div style="max-height: 500px; overflow-y: auto;">';
                html += `<div style="background: #e6fffa; padding: 15px; border-radius: 10px; border-left: 4px solid #00d4aa; margin-bottom: 20px;">`;
                html += `<p style="color: #00695c; font-weight: 600; margin: 0 0 10px 0;">✅ Found ${sandboxInstitutionsDisplay.length} Verified Sandbox Test Banks</p>`;
                html += `<p style="color: #00695c; font-size: 0.9em; margin: 0;">All banks use test credentials: <strong>username: user_good, password: pass_good</strong></p>`;
                html += `</div>`;

                for (const inst of sandboxInstitutionsDisplay) {
                    const name = inst.name || 'Unknown Institution';
                    const instId = inst.institution_id || 'N/A';
                    const logo = inst.logo || '';
                    const products = inst.products || [];
                    const url = inst.url || '#';
                    const primaryColor = inst.primary_color || '#00d4aa';

                    // Check if payment initiation is supported
                    const paymentInitiation = inst.payment_initiation_metadata || {};
                    const supportsPayments = Object.keys(paymentInitiation).length > 0;

                    // Create logo display with fallback
                    let logoHtml = '';
                    if (logo) {
                        logoHtml = `
                            <div style="width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; background: white; border-radius: 8px; padding: 5px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                                <img src="data:image/png;base64,${logo}"
                                     alt="${name}"
                                     style="max-width: 50px; max-height: 50px; object-fit: contain;"
                                     onerror="this.parentElement.innerHTML='<div style=\\'width:50px;height:50px;background:${primaryColor};border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:20px;\\'>${name.charAt(0).toUpperCase()}</div>'">
                            </div>
                        `;
                    } else {
                        // Fallback to colored circle with first letter
                        logoHtml = `
                            <div style="width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;">
                                <div style="width: 50px; height: 50px; background: ${primaryColor}; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                                    ${name.charAt(0).toUpperCase()}
                                </div>
                            </div>
                        `;
                    }

                    html += `
                        <div style="background: #f7fafc; padding: 20px; border-radius: 10px; margin: 15px 0; border-left: 4px solid ${primaryColor};">
                            <div style="display: flex; align-items: center; gap: 15px;">
                                ${logoHtml}
                                <div style="flex: 1;">
                                    <h4 style="margin: 0 0 5px 0;">${name}</h4>
                                    <p style="margin: 0; font-size: 0.85em; color: #718096;">
                                        <strong>ID:</strong> <code style="font-size: 0.8em;">${instId}</code>
                                    </p>
                                    ${url !== '#' ? `<p style="margin: 5px 0 0 0; font-size: 0.85em;"><a href="${url}" target="_blank" style="color: #00d4aa;">🌐 Visit Website</a></p>` : ''}
                                </div>
                            </div>
                            ${supportsPayments ? `
                                <div style="background: #c6f6d5; padding: 10px; border-radius: 5px; margin-top: 15px;">
                                    <p style="margin: 0; font-size: 0.85em; color: #22543d;">
                                        ✅ <strong>Payment Initiation Supported</strong>
                                    </p>
                                    ${paymentInitiation.maximum_payment_amount ? `<p style="margin: 5px 0 0 0; font-size: 0.8em;">Max Amount: ${paymentInitiation.maximum_payment_amount.currency} ${paymentInitiation.maximum_payment_amount.value}</p>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }

                html += '</div>';
                institutionsResults.innerHTML = html;
            } else {
                institutionsResults.innerHTML = `
                    <div style="background: #fff3cd; padding: 20px; border-radius: 10px; border-left: 4px solid #ffc107;">
                        <p style="color: #856404; font-weight: 600; margin: 0 0 10px 0;">⚠️ No Sandbox Test Banks Found</p>
                        <p style="color: #856404; font-size: 0.9em; margin: 0 0 15px 0;">
                            The API didn't return any of the 7 verified sandbox banks for country: <strong>${countryCode}</strong>
                        </p>
                        <div style="background: white; padding: 15px; border-radius: 8px;">
                            <p style="color: #495057; font-weight: 600; margin: 0 0 10px 0;">✅ Verified Sandbox Banks (US only):</p>
                            <ul style="margin: 0; padding-left: 20px; color: #495057;">
                                <li>First Platypus Bank (ins_109508) ⭐ Recommended</li>
                                <li>First Gingham Credit Union (ins_109509)</li>
                                <li>Tattersall Federal Credit Union (ins_109510)</li>
                                <li>Houndstooth Bank (ins_109511)</li>
                                <li>Tartan Bank (ins_109512)</li>
                                <li>Platinum Standard Bank (ins_109513)</li>
                                <li>Gold Standard Bank (ins_109514)</li>
                            </ul>
                            <p style="margin: 15px 0 0 0; color: #495057; font-size: 0.9em;">
                                💡 <strong>Tip:</strong> Select <strong>US</strong> from the country dropdown above and try again.
                            </p>
                        </div>
                    </div>
                `;
            }

            fetchInstitutionsBtn.disabled = false;
            fetchInstitutionsBtn.textContent = '🏦 Get Available Banks';

        } catch (error) {
            console.error('❌ Error fetching institutions:', error);
            institutionsResults.innerHTML = `
                <p style="color: #f56565;">❌ Error: ${error.message}</p>
                <div class="help-box">
                    <h4>Possible Issues:</h4>
                    <ol>
                        <li>Verify Plaid credentials are set in .env file</li>
                        <li>Check backend server is running</li>
                        <li>Ensure you have access to the institutions endpoint</li>
                    </ol>
                </div>
            `;
            fetchInstitutionsBtn.disabled = false;
            fetchInstitutionsBtn.textContent = '🏦 Get Available Banks';
        }
    }

    /**
     * Fetch Payment Recipients
     */
    async function fetchRecipients() {
        console.log('💳 Fetching Payment Recipients...');

        fetchRecipientsBtn.disabled = true;
        fetchRecipientsBtn.textContent = '⏳ Loading Recipients...';
        recipientsList.style.display = 'block';
        recipientsResults.innerHTML = '<p>Loading recipients...</p>';

        try {
            const response = await fetch('http://localhost:8000/api/plaid/recipients', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Failed to fetch recipients');
            }

            console.log('💳 Recipients Data:', data);

            const recipients = data.recipients || [];

            if (recipients.length > 0) {
                let html = '<div style="max-height: 400px; overflow-y: auto;">';
                html += `<p style="color: #00d4aa; font-weight: 600;">Found ${recipients.length} payment recipients</p>`;

                for (const recipient of recipients) {
                    const name = recipient.name || 'Unknown Recipient';
                    const recipientId = recipient.recipient_id || 'N/A';
                    const iban = recipient.iban || recipient.bacs?.account || 'N/A';
                    const address = recipient.address || {};

                    html += `
                        <div style="background: #f7fafc; padding: 20px; border-radius: 10px; margin: 15px 0; border-left: 4px solid #f093fb;">
                            <h4 style="margin-top: 0;">💳 ${name}</h4>
                            <p><strong>Recipient ID:</strong> <code style="font-size: 0.85em;">${recipientId}</code></p>
                            <p><strong>IBAN/Account:</strong> ${iban}</p>
                            ${address.street ? `
                                <p style="font-size: 0.9em; color: #718096;">
                                    <strong>Address:</strong><br>
                                    ${address.street.join(', ')}<br>
                                    ${address.city}, ${address.postal_code}<br>
                                    ${address.country}
                                </p>
                            ` : ''}
                        </div>
                    `;
                }

                html += '</div>';
                recipientsResults.innerHTML = html;
            } else {
                recipientsResults.innerHTML = `
                    <div style="background: #fff5f5; padding: 20px; border-radius: 10px;">
                        <p style="color: #c53030; margin: 0;">ℹ️ No payment recipients found</p>
                        <p style="margin: 10px 0 0 0; font-size: 0.9em; color: #718096;">
                            You haven't created any payment recipients yet. Recipients are created when you initiate payments through the Payment Initiation API.
                        </p>
                    </div>
                `;
            }

            fetchRecipientsBtn.disabled = false;
            fetchRecipientsBtn.textContent = '💳 Get Payment Recipients';

        } catch (error) {
            console.error('❌ Error fetching recipients:', error);
            recipientsResults.innerHTML = `
                <p style="color: #f56565;">❌ Error: ${error.message}</p>
                <div class="help-box">
                    <h4>Note:</h4>
                    <p>The Payment Initiation product requires special access and is primarily for European markets. If you're using a US sandbox account, this endpoint may not be available.</p>
                </div>
            `;
            fetchRecipientsBtn.disabled = false;
            fetchRecipientsBtn.textContent = '💳 Get Payment Recipients';
        }
    }

    /**
     * List All Plaid Connections
     */
    async function listAllPlaidConnections() {
        console.log('📋 Fetching all Plaid connections...');

        const listBtn = document.getElementById('listPlaidConnectionsBtn');
        const listDiv = document.getElementById('allPlaidConnectionsList');

        listBtn.disabled = true;
        listBtn.textContent = '⏳ Loading Connections...';
        listDiv.innerHTML = '<p>Loading connections...</p>';

        try {
            const response = await fetch('http://localhost:8000/api/plaid/list-connections', {
                method: 'GET'
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Failed to fetch connections');
            }

            console.log('📋 Connections Data:', data);

            const connections = data.connections || [];

            if (connections.length > 0) {
                let html = `
                    <div style="background: #f0f9ff; padding: 15px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #667eea;">
                        <h3 style="margin: 0; color: #667eea;">✅ Found ${connections.length} connection${connections.length > 1 ? 's' : ''}</h3>
                        <p style="margin: 10px 0 0 0; color: #4a5568;">All Plaid bank connections saved locally</p>
                    </div>
                `;

                // Group connections by user_id
                const connectionsByUser = {};
                for (const conn of connections) {
                    const userId = conn.user_id || 'unknown';
                    if (!connectionsByUser[userId]) {
                        connectionsByUser[userId] = [];
                    }
                    connectionsByUser[userId].push(conn);
                }

                // Display connections grouped by user
                for (const [userId, userConnections] of Object.entries(connectionsByUser)) {
                    html += `
                        <div style="background: white; padding: 20px; border-radius: 10px; margin: 15px 0; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border-left: 5px solid #667eea;">
                            <h3 style="margin-top: 0; color: #667eea;">👤 User: ${userId}</h3>
                            <p style="color: #718096; margin: 5px 0 15px 0;">${userConnections.length} connection${userConnections.length > 1 ? 's' : ''}</p>
                    `;

                    for (const conn of userConnections) {
                        const institutionName = conn.institution_name || 'Unknown Institution';
                        const itemId = conn.item_id || 'N/A';
                        const accountCount = conn.accounts?.length || 0;
                        const timestamp = conn.saved_at || conn.timestamp || 'N/A';
                        const accessToken = conn.access_token ? conn.access_token.substring(0, 20) + '...' : 'N/A';

                        html += `
                            <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin: 10px 0;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                                    <h4 style="margin: 0; color: #2d3748;">🏦 ${institutionName}</h4>
                                    <span style="background: #c6f6d5; color: #22543d; padding: 4px 10px; border-radius: 5px; font-size: 0.85em; font-weight: 600;">Active</span>
                                </div>
                                <p style="margin: 8px 0; font-size: 0.9em;"><strong>Item ID:</strong> <code style="font-size: 0.8em; background: #edf2f7; padding: 2px 6px; border-radius: 4px;">${itemId}</code></p>
                                <p style="margin: 8px 0; font-size: 0.9em;"><strong>Access Token:</strong> <code style="font-size: 0.8em; background: #edf2f7; padding: 2px 6px; border-radius: 4px;">${accessToken}</code></p>
                                <p style="margin: 8px 0; font-size: 0.9em;"><strong>Accounts:</strong> ${accountCount}</p>
                                <p style="margin: 8px 0; font-size: 0.9em; color: #718096;"><strong>Connected:</strong> ${timestamp}</p>

                                ${conn.accounts && conn.accounts.length > 0 ? `
                                    <details style="margin-top: 10px;">
                                        <summary style="cursor: pointer; color: #667eea; font-weight: 600;">View Account Details (${conn.accounts.length})</summary>
                                        <div style="margin-top: 10px; padding: 10px; background: white; border-radius: 5px;">
                                            ${conn.accounts.map(acc => `
                                                <div style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 0.85em;">
                                                    <p style="margin: 3px 0;"><strong>${acc.name || 'Account'}</strong></p>
                                                    <p style="margin: 3px 0; color: #718096;">Type: ${acc.type || 'N/A'}${acc.subtype ? ' - ' + acc.subtype : ''}</p>
                                                    <p style="margin: 3px 0; color: #718096;">ID: <code style="font-size: 0.9em;">${acc.id}</code></p>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </details>
                                ` : ''}

                                <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                                    <button class="connect-btn" onclick="loadPlaidConnection('${conn.access_token}')" style="padding: 10px 20px; font-size: 0.9em; background: linear-gradient(135deg, #00d4aa, #00a896); flex: 1; min-width: 150px;">
                                        🔄 Load Connection
                                    </button>
                                    <button class="connect-btn" onclick="removePlaidItem('${conn.access_token}', '${conn.item_id}', '${conn.institution_name || 'Unknown Bank'}')" style="padding: 10px 20px; font-size: 0.9em; background: linear-gradient(135deg, #f56565, #c53030); flex: 1; min-width: 150px;">
                                        🗑️ Disconnect
                                    </button>
                                </div>
                            </div>
                        `;
                    }

                    html += '</div>';
                }

                listDiv.innerHTML = html;
            } else {
                listDiv.innerHTML = `
                    <div style="background: #fff5f5; padding: 30px; border-radius: 10px; text-align: center;">
                        <p style="color: #c53030; font-size: 1.1em; margin: 0;">📭 No Plaid connections found</p>
                        <p style="margin: 10px 0 0 0; color: #718096;">
                            Connect a bank account using the steps above to see your connections here.
                        </p>
                    </div>
                `;
            }

            listBtn.disabled = false;
            listBtn.textContent = '📋 View All Connections';

        } catch (error) {
            console.error('❌ Error fetching connections:', error);
            listDiv.innerHTML = `
                <div style="background: #fff5f5; padding: 20px; border-radius: 10px;">
                    <p style="color: #f56565; margin: 0;">❌ Error: ${error.message}</p>
                    <p style="margin: 10px 0 0 0; color: #718096;">
                        Make sure the backend server is running and you have created at least one connection.
                    </p>
                </div>
            `;
            listBtn.disabled = false;
            listBtn.textContent = '📋 View All Connections';
        }
    }

    /**
     * List All Plaid Users (sorted by user_id descending)
     */
    async function listAllPlaidUsers() {
        console.log('👥 Fetching all Plaid users...');

        const listBtn = document.getElementById('listPlaidUsersBtn');
        const listDiv = document.getElementById('allPlaidUsersList');

        listBtn.disabled = true;
        listBtn.textContent = '⏳ Loading Users...';
        listDiv.innerHTML = '<p>Loading users...</p>';

        try {
            const response = await fetch('http://localhost:8000/api/plaid/list-users', {
                method: 'GET'
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Failed to fetch users');
            }

            console.log('👥 Users Data:', data);

            const users = data.users || [];

            if (users.length > 0) {
                // Sort users by user_id descending
                users.sort((a, b) => b.user_id.localeCompare(a.user_id));

                let html = '<div style="max-height: 600px; overflow-y: auto;">';
                html += `<p style="color: #00d4aa; font-weight: 600; margin-bottom: 15px;">Found ${users.length} unique users with ${data.total_connections} total connections</p>`;

                for (const user of users) {
                    html += `
                        <div style="background: linear-gradient(135deg, #667eea15, #764ba215); padding: 20px; border-radius: 10px; margin-bottom: 15px; border-left: 4px solid #667eea;">
                            <h4 style="margin: 0 0 10px 0; color: #667eea;">👤 ${user.user_id}</h4>
                            <p style="margin: 5px 0;"><strong>Connections:</strong> ${user.connection_count}</p>
                            <p style="margin: 5px 0;"><strong>Banks Connected:</strong> ${user.institutions.join(', ')}</p>
                            <p style="margin: 5px 0;"><strong>First Connection:</strong> ${new Date(user.first_connection).toLocaleString()}</p>
                            <p style="margin: 5px 0;"><strong>Last Connection:</strong> ${new Date(user.last_connection).toLocaleString()}</p>

                            <details style="margin-top: 15px;">
                                <summary style="cursor: pointer; color: #667eea; font-weight: 600;">View All Connections (${user.connection_count})</summary>
                                <div style="margin-top: 10px; padding: 10px; background: white; border-radius: 5px;">
                                    ${user.connections.map(conn => `
                                        <div style="padding: 10px; border-bottom: 1px solid #e2e8f0; margin-bottom: 10px;">
                                            <p style="margin: 3px 0;"><strong>${conn.institution_name || 'Unknown Bank'}</strong></p>
                                            <p style="margin: 3px 0; font-size: 0.85em; color: #718096;">Item ID: <code>${conn.item_id}</code></p>
                                            <p style="margin: 3px 0; font-size: 0.85em; color: #718096;">Accounts: ${conn.accounts_count}</p>
                                            <p style="margin: 3px 0; font-size: 0.85em; color: #718096;">Connected: ${new Date(conn.timestamp).toLocaleString()}</p>
                                        </div>
                                    `).join('')}
                                </div>
                            </details>
                        </div>
                    `;
                }

                html += '</div>';
                listDiv.innerHTML = html;
            } else {
                listDiv.innerHTML = `
                    <div style="background: #fff5f5; padding: 20px; border-radius: 10px; text-align: center;">
                        <h4>No Users Found</h4>
                        <p style="color: #718096;">
                            No Plaid users/customers have been created yet.
                            Connect a bank account to create your first user.
                        </p>
                    </div>
                `;
            }

            listBtn.disabled = false;
            listBtn.textContent = '👥 List All Users (Sorted by User ID)';

        } catch (error) {
            console.error('❌ Error fetching users:', error);
            listDiv.innerHTML = `
                <div style="background: #fff5f5; padding: 20px; border-radius: 10px;">
                    <h4 style="color: #f56565;">Error</h4>
                    <p>${error.message}</p>
                </div>
            `;
            listBtn.disabled = false;
            listBtn.textContent = '👥 List All Users (Sorted by User ID)';
        }
    }

    /**
     * Remove/Disconnect Plaid Item
     */
    async function removePlaidItem(accessToken, itemId, institutionName) {
        if (!confirm(`Are you sure you want to disconnect "${institutionName}"?\n\nThis will permanently remove the connection and invalidate the access token.`)) {
            return;
        }

        console.log('🗑️ Removing Plaid Item:', itemId);

        try {
            const response = await fetch('http://localhost:8000/api/plaid/remove-item', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    access_token: accessToken
                })
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Failed to remove item');
            }

            console.log('✅ Item removed successfully');
            alert(`✅ Successfully disconnected "${institutionName}"!\n\nThe connection has been removed from Plaid.`);

            // Refresh the connections list
            listAllPlaidConnections();

        } catch (error) {
            console.error('❌ Error removing item:', error);
            alert(`❌ Failed to disconnect: ${error.message}`);
        }
    }

    // Make removePlaidItem globally accessible for onclick handlers
    window.removePlaidItem = removePlaidItem;

    /**
     * Open Plaid Link with Manual Link Token
     */
    async function openPlaidWithManualToken() {
        const startTime = performance.now();
        console.log('🎯 Opening Plaid Link with manual link token...');

        const manualLinkTokenInput = document.getElementById('manualLinkToken');
        const manualUserIdInput = document.getElementById('manualUserId');
        const openButton = document.getElementById('openPlaidWithTokenBtn');

        const linkToken = manualLinkTokenInput.value.trim();
        const userId = manualUserIdInput.value.trim();

        if (!linkToken) {
            plaidResultsDiv.innerHTML = `
                <div class="status-badge status-error">❌ Link Token Required</div>
                <div class="response-item">
                    <strong>Error:</strong> Please enter a link token
                </div>
            `;
            plaidResultsDiv.style.display = 'block';
            return;
        }

        // Disable button and show loading
        openButton.disabled = true;
        openButton.textContent = '⏳ Opening Plaid Link...';

        plaidResultsDiv.innerHTML = '<p class="loading">⏳ Initializing Plaid Link...</p>';
        plaidResultsDiv.style.display = 'block';

        try {
            // Step 1: Validate Plaid SDK is loaded
            if (typeof Plaid === 'undefined') {
                throw new Error('Plaid Link SDK not loaded. Please refresh the page.');
            }

            console.log('✅ Plaid SDK loaded');

            // Store the link token
            plaidLinkToken = linkToken;

            // Store user ID for later use
            if (userId) {
                localStorage.setItem('plaid_last_user_id', userId);
                console.log('👤 Using User ID:', userId);
            }

            // Step 2: Initialize Plaid Link with the provided token
            console.log('🔧 Creating Plaid Link handler...');
            plaidResultsDiv.innerHTML = '<p class="loading">⏳ Creating Plaid Link handler...</p>';

            const plaidConfig = {
                token: linkToken,
                onSuccess: handlePlaidSuccess,
                onExit: handlePlaidExit,
                onEvent: handlePlaidEvent
            };

            plaidHandler = Plaid.create(plaidConfig);
            console.log('✅ Plaid Link handler created');

            // Step 3: Open Plaid Link
            console.log('🚀 Opening Plaid Link modal...');
            plaidResultsDiv.innerHTML = '<p class="loading">⏳ Opening Plaid Link modal...</p>';

            // Use setTimeout to let the UI update before opening
            setTimeout(() => {
                plaidHandler.open();
                const endTime = performance.now();
                console.log(`⚡ Time to open: ${(endTime - startTime).toFixed(0)}ms`);

                // Re-enable button after opening
                openButton.disabled = false;
                openButton.textContent = '🎯 Open with Link Token';
            }, 100);

            plaidResultsDiv.innerHTML = `
                <div class="status-badge status-success">✅ Plaid Link Opened</div>
                <div class="response-item">
                    <strong>Status:</strong> Plaid Link modal opened (centered dialog)
                </div>
                <div class="response-item">
                    <strong>Link Token:</strong>
                    <code style="display: block; background: #f7fafc; padding: 10px; border-radius: 5px; margin-top: 5px; word-break: break-all; font-size: 0.85em;">${linkToken.substring(0, 50)}...</code>
                </div>
                ${userId ? `
                <div class="response-item">
                    <strong>User ID:</strong> ${userId}
                </div>
                ` : ''}
                <div class="response-item" style="background: #e6fffa; padding: 10px; border-radius: 8px; border-left: 3px solid #00d4aa; margin-top: 10px;">
                    <strong>ℹ️ UI Note:</strong> Plaid opens as a centered modal dialog (not full-screen like Lean SDK). This is by design from Plaid and matches standard US banking integration patterns.
                </div>
                <div class="help-box">
                    <h4>Next Steps:</h4>
                    <ol>
                        <li>Select your bank from the list</li>
                        <li>Log in with your credentials</li>
                        <li>For Sandbox: Use username "user_good" and password "pass_good"</li>
                        <li>Complete the authentication flow</li>
                    </ol>
                </div>
            `;

        } catch (error) {
            console.error('❌ Failed to open Plaid Link:', error);

            // Re-enable button on error
            openButton.disabled = false;
            openButton.textContent = '🎯 Open with Link Token';

            plaidResultsDiv.innerHTML = `
                <div class="status-badge status-error">❌ Failed to Open Plaid Link</div>
                <div class="response-item">
                    <strong>Error:</strong> ${error.message}
                </div>
                <div class="help-box">
                    <h4>Common Issues:</h4>
                    <ol>
                        <li>Link token may be expired (they expire after 30 minutes)</li>
                        <li>Link token format may be invalid</li>
                        <li>Check browser console for more details</li>
                        <li>Verify Plaid Link SDK is loaded</li>
                    </ol>
                </div>
            `;
        }
    }

    // Attach event listeners
    if (initPlaidBtn) {
        initPlaidBtn.addEventListener('click', initializePlaid);
    }

    const openPlaidWithTokenBtn = document.getElementById('openPlaidWithTokenBtn');
    if (openPlaidWithTokenBtn) {
        openPlaidWithTokenBtn.addEventListener('click', openPlaidWithManualToken);
    }

    if (fetchPlaidAccountsBtn) {
        fetchPlaidAccountsBtn.addEventListener('click', fetchPlaidAccounts);
    }

    if (fetchInstitutionsBtn) {
        fetchInstitutionsBtn.addEventListener('click', fetchInstitutions);
    }

    if (fetchRecipientsBtn) {
        fetchRecipientsBtn.addEventListener('click', fetchRecipients);
    }

    const listPlaidConnectionsBtn = document.getElementById('listPlaidConnectionsBtn');
    if (listPlaidConnectionsBtn) {
        listPlaidConnectionsBtn.addEventListener('click', listAllPlaidConnections);
    }

    const listPlaidUsersBtn = document.getElementById('listPlaidUsersBtn');
    if (listPlaidUsersBtn) {
        listPlaidUsersBtn.addEventListener('click', listAllPlaidUsers);
    }

    /**
     * Show Plaid API Reference
     */
    function showPlaidApiReference() {
        console.log('📖 Showing Plaid API Reference...');

        const referenceDiv = document.getElementById('plaidApiReference');
        const showBtn = document.getElementById('showPlaidApiRefBtn');

        if (referenceDiv.style.display === 'block') {
            referenceDiv.style.display = 'none';
            showBtn.textContent = '📖 Show API Reference';
            return;
        }

        referenceDiv.style.display = 'block';
        showBtn.textContent = '📖 Hide API Reference';

        const apiReference = {
            'Link Token Creation': {
                endpoint: 'POST /link/token/create',
                backend: 'POST /api/plaid/create-link-token',
                description: 'Creates a link_token for initializing Plaid Link',
                requestParams: {
                    user_id: 'string (required) - Your user identifier'
                },
                backendRequest: {
                    user_id: 'user_123'
                },
                plaidRequest: {
                    client_id: 'your_client_id',
                    secret: 'your_secret',
                    user: {
                        client_user_id: 'user_123'
                    },
                    client_name: 'Your App Name',
                    products: ['auth', 'transactions'],
                    country_codes: ['US'],
                    language: 'en'
                },
                response: {
                    link_token: 'link-sandbox-abc123...',
                    expiration: '2025-10-23T12:00:00Z',
                    request_id: 'xyz'
                },
                notes: 'Link token expires in 30 minutes. Use it to initialize Plaid Link on frontend.'
            },
            'Token Exchange': {
                endpoint: 'POST /item/public_token/exchange',
                backend: 'POST /api/plaid/exchange-token',
                description: 'Exchanges public_token for permanent access_token',
                requestParams: {
                    public_token: 'string (required) - Temporary token from Plaid Link'
                },
                backendRequest: {
                    public_token: 'public-sandbox-xyz...'
                },
                plaidRequest: {
                    client_id: 'your_client_id',
                    secret: 'your_secret',
                    public_token: 'public-sandbox-xyz...'
                },
                response: {
                    access_token: 'access-sandbox-abc123...',
                    item_id: 'item-xyz',
                    request_id: 'req123'
                },
                notes: 'Exchange public_token immediately after Plaid Link success. Public token is single-use.'
            },
            'Get Accounts': {
                endpoint: 'POST /accounts/get',
                backend: 'POST /api/plaid/accounts',
                description: 'Retrieves all accounts for an Item',
                requestParams: {
                    access_token: 'string (required) - Access token from exchange'
                },
                backendRequest: {
                    access_token: 'access-sandbox-abc123...'
                },
                plaidRequest: {
                    client_id: 'your_client_id',
                    secret: 'your_secret',
                    access_token: 'access-sandbox-abc123...'
                },
                response: {
                    accounts: [
                        {
                            account_id: 'acc123',
                            name: 'Checking',
                            type: 'depository',
                            subtype: 'checking',
                            mask: '0000'
                        }
                    ],
                    item: { item_id: 'item-xyz' },
                    request_id: 'req123'
                },
                notes: 'Returns basic account information without balances or transactions.'
            },
            'Get Balances': {
                endpoint: 'POST /accounts/balance/get',
                backend: 'POST /api/plaid/balances',
                description: 'Retrieves real-time balance information',
                requestParams: {
                    access_token: 'string (required) - Access token from exchange'
                },
                backendRequest: {
                    access_token: 'access-sandbox-abc123...'
                },
                plaidRequest: {
                    client_id: 'your_client_id',
                    secret: 'your_secret',
                    access_token: 'access-sandbox-abc123...'
                },
                response: {
                    accounts: [
                        {
                            account_id: 'acc123',
                            balances: {
                                current: 1000.50,
                                available: 900.00,
                                iso_currency_code: 'USD'
                            }
                        }
                    ],
                    request_id: 'req123'
                },
                notes: 'Returns current and available balances for all accounts.'
            },
            'Get Transactions': {
                endpoint: 'POST /transactions/get',
                backend: 'POST /api/plaid/transactions',
                description: 'Retrieves transactions for a date range',
                requestParams: {
                    access_token: 'string (required) - Access token',
                    start_date: 'string (required) - YYYY-MM-DD format',
                    end_date: 'string (required) - YYYY-MM-DD format'
                },
                backendRequest: {
                    access_token: 'access-sandbox-abc123...',
                    start_date: '2025-01-01',
                    end_date: '2025-01-31'
                },
                plaidRequest: {
                    client_id: 'your_client_id',
                    secret: 'your_secret',
                    access_token: 'access-sandbox-abc123...',
                    start_date: '2025-01-01',
                    end_date: '2025-01-31'
                },
                response: {
                    transactions: [
                        {
                            transaction_id: 'txn123',
                            account_id: 'acc123',
                            amount: 12.50,
                            date: '2025-01-15',
                            name: 'Starbucks',
                            category: ['Food and Drink', 'Restaurants']
                        }
                    ],
                    total_transactions: 50,
                    request_id: 'req123'
                },
                notes: 'Maximum date range is 2 years. Transactions may take 1-2 days to appear.'
            },
            'Get Auth (Account Numbers)': {
                endpoint: 'POST /auth/get',
                backend: 'POST /api/plaid/auth',
                description: 'Retrieves account and routing numbers',
                requestParams: {
                    access_token: 'string (required) - Access token'
                },
                backendRequest: {
                    access_token: 'access-sandbox-abc123...'
                },
                plaidRequest: {
                    client_id: 'your_client_id',
                    secret: 'your_secret',
                    access_token: 'access-sandbox-abc123...'
                },
                response: {
                    accounts: [
                        {
                            account_id: 'acc123',
                            account: '1111222233330000',
                            routing: '011401533',
                            wire_routing: '021000021'
                        }
                    ],
                    numbers: { ach: [{ account: '1111222233330000', routing: '011401533' }] },
                    request_id: 'req123'
                },
                notes: 'Use for ACH transfers. Requires auth product in link token.'
            },
            'Get Institutions': {
                endpoint: 'POST /institutions/get',
                backend: 'POST /api/plaid/institutions',
                description: 'Retrieves list of available institutions',
                requestParams: {
                    country_code: 'string (required) - US, GB, etc.',
                    count: 'number (optional) - Default 100',
                    offset: 'number (optional) - Default 0'
                },
                backendRequest: {
                    country_code: 'US',
                    count: 100,
                    offset: 0
                },
                plaidRequest: {
                    client_id: 'your_client_id',
                    secret: 'your_secret',
                    count: 100,
                    offset: 0,
                    country_codes: ['US'],
                    options: {
                        include_optional_metadata: true,
                        include_payment_initiation_metadata: true
                    }
                },
                response: {
                    institutions: [
                        {
                            institution_id: 'ins_3',
                            name: 'Chase',
                            products: ['auth', 'transactions'],
                            country_codes: ['US'],
                            logo: 'base64...',
                            primary_color: '#004080'
                        }
                    ],
                    request_id: 'req123'
                },
                notes: 'Use for displaying bank logos and metadata. Can filter by country.'
            },
            'Get Payment Recipients': {
                endpoint: 'POST /payment_initiation/recipient/list',
                backend: 'POST /api/plaid/recipients',
                description: 'Lists all payment initiation recipients',
                requestParams: {},
                backendRequest: {},
                plaidRequest: {
                    client_id: 'your_client_id',
                    secret: 'your_secret'
                },
                response: {
                    recipients: [
                        {
                            recipient_id: 'recipient-123',
                            name: 'John Doe',
                            iban: 'GB123456789',
                            address: {
                                street: ['123 Street'],
                                city: 'London',
                                postal_code: 'SW1A 1AA',
                                country: 'GB'
                            }
                        }
                    ],
                    request_id: 'req123'
                },
                notes: 'Payment Initiation is for European markets. Requires special Plaid access.'
            }
        };

        let html = '<div style="max-height: 600px; overflow-y: auto; background: #f7fafc; padding: 20px; border-radius: 10px;">';

        for (const [apiName, details] of Object.entries(apiReference)) {
            html += `
                <div style="background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h3 style="margin-top: 0; color: #f5576c; border-bottom: 2px solid #f5576c; padding-bottom: 10px;">${apiName}</h3>

                    <div style="margin: 15px 0;">
                        <p style="margin: 5px 0;"><strong style="color: #667eea;">Plaid Endpoint:</strong> <code style="background: #edf2f7; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;">${details.endpoint}</code></p>
                        <p style="margin: 5px 0;"><strong style="color: #667eea;">Backend Route:</strong> <code style="background: #edf2f7; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;">${details.backend}</code></p>
                        <p style="margin: 10px 0 5px 0; color: #4a5568;">${details.description}</p>
                    </div>

                    <details style="margin: 15px 0;">
                        <summary style="cursor: pointer; font-weight: 600; color: #00d4aa; padding: 10px; background: #e6fffa; border-radius: 5px;">📋 Request Parameters</summary>
                        <div style="margin-top: 10px; padding: 15px; background: #f7fafc; border-radius: 5px;">
                            ${Object.keys(details.requestParams).length > 0
                                ? Object.entries(details.requestParams).map(([key, desc]) =>
                                    `<p style="margin: 5px 0;"><code style="color: #f093fb; font-weight: 600;">${key}</code>: ${desc}</p>`
                                  ).join('')
                                : '<p style="color: #718096;">No parameters required</p>'
                            }
                        </div>
                    </details>

                    <details style="margin: 15px 0;">
                        <summary style="cursor: pointer; font-weight: 600; color: #764ba2; padding: 10px; background: #faf5ff; border-radius: 5px;">📤 Example Frontend Request</summary>
                        <pre style="margin-top: 10px; background: #2d3748; color: #e2e8f0; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 0.85em;">${JSON.stringify(details.backendRequest, null, 2)}</pre>
                    </details>

                    <details style="margin: 15px 0;">
                        <summary style="cursor: pointer; font-weight: 600; color: #f5576c; padding: 10px; background: #fff5f7; border-radius: 5px;">🔐 Actual Plaid API Request</summary>
                        <pre style="margin-top: 10px; background: #2d3748; color: #e2e8f0; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 0.85em;">${JSON.stringify(details.plaidRequest, null, 2)}</pre>
                    </details>

                    <details style="margin: 15px 0;">
                        <summary style="cursor: pointer; font-weight: 600; color: #00d4aa; padding: 10px; background: #e6fffa; border-radius: 5px;">📥 Example Response</summary>
                        <pre style="margin-top: 10px; background: #2d3748; color: #48bb78; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 0.85em;">${JSON.stringify(details.response, null, 2)}</pre>
                    </details>

                    ${details.notes ? `
                        <div style="margin: 15px 0; padding: 12px; background: #fef6e7; border-left: 4px solid #f6ad55; border-radius: 5px;">
                            <p style="margin: 0; color: #744210;"><strong>💡 Note:</strong> ${details.notes}</p>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        html += `
            <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px; border-radius: 10px; text-align: center;">
                <h3 style="margin: 0 0 10px 0;">📚 Complete Documentation</h3>
                <p style="margin: 0;">For full API documentation, visit: <a href="https://plaid.com/docs/" target="_blank" style="color: #fff; text-decoration: underline;">plaid.com/docs</a></p>
            </div>
        </div>`;

        referenceDiv.innerHTML = html;
    }

    const showPlaidApiRefBtn = document.getElementById('showPlaidApiRefBtn');
    if (showPlaidApiRefBtn) {
        showPlaidApiRefBtn.addEventListener('click', showPlaidApiReference);
    }

    // Add event listener for country select to reload institutions
    if (countrySelect) {
        countrySelect.addEventListener('change', () => {
            if (institutionsList.style.display !== 'none') {
                fetchInstitutions();
            }
        });
    }

    /**
     * Populate Account Filter Checkboxes
     */
    function populateAccountFilterCheckboxes(accounts) {
        console.log('🏦 Populating account filter checkboxes...');

        const container = document.getElementById('accountFilterCheckboxes');
        const selectAllBtn = document.getElementById('selectAllAccountsBtn');
        const deselectAllBtn = document.getElementById('deselectAllAccountsBtn');
        const fetchBalancesBtn = document.getElementById('fetchPlaidBalancesBtn');

        if (!container) return;

        let html = '';
        for (const account of accounts) {
            const accountName = account.name || 'Unknown Account';
            const accountId = account.account_id;
            const mask = account.mask || 'N/A';

            html += `
                <label style="display: flex; align-items: center; padding: 10px; margin-bottom: 8px; background: #f7fafc; border-radius: 5px; cursor: pointer; border: 2px solid transparent; transition: all 0.2s;" onmouseover="this.style.borderColor='#00d4aa'" onmouseout="this.style.borderColor='transparent'">
                    <input
                        type="checkbox"
                        class="account-filter-checkbox"
                        value="${accountId}"
                        checked
                        style="margin-right: 10px; width: 18px; height: 18px; cursor: pointer;"
                    />
                    <span style="flex: 1;">
                        <strong>${accountName}</strong>
                        <br>
                        <small style="color: #718096;">****${mask}</small>
                    </span>
                </label>
            `;
        }

        container.innerHTML = html;

        // Enable buttons
        if (selectAllBtn) selectAllBtn.disabled = false;
        if (deselectAllBtn) deselectAllBtn.disabled = false;
        if (fetchBalancesBtn) fetchBalancesBtn.disabled = false;

        console.log(`✅ ${accounts.length} account checkboxes created`);
    }

    /**
     * Select All Accounts
     */
    function selectAllAccounts() {
        const checkboxes = document.querySelectorAll('.account-filter-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
        });
        console.log('✅ All accounts selected');
    }

    /**
     * Deselect All Accounts
     */
    function deselectAllAccounts() {
        const checkboxes = document.querySelectorAll('.account-filter-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        console.log('❌ All accounts deselected');
    }

    /**
     * Fetch Plaid Balances with Filters
     */
    async function fetchPlaidBalances() {
        console.log('💰 Fetching Plaid Balances with filters...');

        const accessToken = plaidAccessToken || localStorage.getItem('plaid_access_token');

        if (!accessToken) {
            alert('Please connect a bank account first');
            return;
        }

        const fetchBalancesBtn = document.getElementById('fetchPlaidBalancesBtn');
        const balancesList = document.getElementById('plaidBalancesList');

        fetchBalancesBtn.disabled = true;
        fetchBalancesBtn.textContent = '⏳ Loading Balances...';
        balancesList.innerHTML = '<p>Loading balances...</p>';

        try {
            // Get selected account IDs
            const checkboxes = document.querySelectorAll('.account-filter-checkbox:checked');
            const selectedAccountIds = Array.from(checkboxes).map(cb => cb.value);

            // Get minimum last updated datetime
            const minLastUpdatedInput = document.getElementById('minLastUpdatedDatetime');
            const minLastUpdatedDatetime = minLastUpdatedInput.value ? new Date(minLastUpdatedInput.value).toISOString() : null;

            // Build request options
            const requestBody = {
                access_token: accessToken
            };

            // Add options if filters are set
            if (selectedAccountIds.length > 0 || minLastUpdatedDatetime) {
                requestBody.options = {};

                if (selectedAccountIds.length > 0) {
                    requestBody.options.account_ids = selectedAccountIds;
                    console.log(`🔍 Filtering ${selectedAccountIds.length} account(s)`);
                }

                if (minLastUpdatedDatetime) {
                    requestBody.options.min_last_updated_datetime = minLastUpdatedDatetime;
                    console.log(`📅 Min update time: ${minLastUpdatedDatetime}`);
                }
            }

            console.log('📤 Request:', requestBody);

            const response = await fetch('http://localhost:8000/api/plaid/balances', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Failed to fetch balances');
            }

            console.log('💰 Balances Data:', data);

            const accounts = data.accounts || [];

            if (accounts.length > 0) {
                let html = `
                    <div style="background: #e6fffa; padding: 15px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #00d4aa;">
                        <h3 style="margin: 0; color: #00695c;">✅ Balances Retrieved (${accounts.length} account${accounts.length > 1 ? 's' : ''})</h3>
                        ${selectedAccountIds.length > 0 ? `<p style="margin: 10px 0 0 0; color: #00695c;">🔍 Filtered: ${selectedAccountIds.length} account(s) selected</p>` : ''}
                        ${minLastUpdatedDatetime ? `<p style="margin: 5px 0 0 0; color: #00695c;">📅 Min update time: ${new Date(minLastUpdatedDatetime).toLocaleString()}</p>` : ''}
                    </div>
                `;

                for (const account of accounts) {
                    const accountName = account.name || 'Unknown Account';
                    const accountId = account.account_id;
                    const mask = account.mask || 'N/A';
                    const balances = account.balances || {};
                    const current = balances.current !== null && balances.current !== undefined ? balances.current : 'N/A';
                    const available = balances.available !== null && balances.available !== undefined ? balances.available : 'N/A';
                    const limit = balances.limit !== null && balances.limit !== undefined ? balances.limit : 'N/A';
                    const currency = balances.iso_currency_code || balances.unofficial_currency_code || 'USD';

                    html += `
                        <div style="background: #f7fafc; padding: 20px; border-radius: 10px; margin: 15px 0; border-left: 4px solid #f093fb;">
                            <h4 style="margin-top: 0; color: #f5576c;">💳 ${accountName}</h4>
                            <p style="font-size: 0.85em; color: #718096; margin: 5px 0 15px 0;">
                                <strong>Account ID:</strong> <code style="font-size: 0.9em;">${accountId}</code><br>
                                <strong>Mask:</strong> ****${mask}
                            </p>

                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                                <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                    <p style="margin: 0; font-size: 0.85em; color: #718096;">Current Balance</p>
                                    <p style="margin: 5px 0 0 0; font-size: 1.5em; font-weight: 600; color: #2d3748;">
                                        ${currency} ${typeof current === 'number' ? current.toFixed(2) : current}
                                    </p>
                                </div>

                                <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                    <p style="margin: 0; font-size: 0.85em; color: #718096;">Available Balance</p>
                                    <p style="margin: 5px 0 0 0; font-size: 1.5em; font-weight: 600; color: #48bb78;">
                                        ${currency} ${typeof available === 'number' ? available.toFixed(2) : available}
                                    </p>
                                </div>

                                ${limit !== 'N/A' ? `
                                    <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                        <p style="margin: 0; font-size: 0.85em; color: #718096;">Credit Limit</p>
                                        <p style="margin: 5px 0 0 0; font-size: 1.5em; font-weight: 600; color: #667eea;">
                                            ${currency} ${typeof limit === 'number' ? limit.toFixed(2) : limit}
                                        </p>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }

                balancesList.innerHTML = html;
            } else {
                balancesList.innerHTML = `
                    <div style="background: #fff3cd; padding: 20px; border-radius: 10px; text-align: center;">
                        <p style="color: #856404; margin: 0;">⚠️ No balances found</p>
                        <p style="color: #856404; margin: 10px 0 0 0; font-size: 0.9em;">
                            Try adjusting your filters or fetch accounts first.
                        </p>
                    </div>
                `;
            }

            fetchBalancesBtn.disabled = false;
            fetchBalancesBtn.textContent = '💰 Fetch Balances with Filters';

        } catch (error) {
            console.error('❌ Error fetching balances:', error);
            balancesList.innerHTML = `
                <div style="background: #fff5f5; padding: 20px; border-radius: 10px;">
                    <p style="color: #f56565; margin: 0;">❌ Error: ${error.message}</p>
                </div>
            `;
            fetchBalancesBtn.disabled = false;
            fetchBalancesBtn.textContent = '💰 Fetch Balances with Filters';
        }
    }

    // Attach event listeners for balance filtering
    const selectAllAccountsBtn = document.getElementById('selectAllAccountsBtn');
    if (selectAllAccountsBtn) {
        selectAllAccountsBtn.addEventListener('click', selectAllAccounts);
    }

    const deselectAllAccountsBtn = document.getElementById('deselectAllAccountsBtn');
    if (deselectAllAccountsBtn) {
        deselectAllAccountsBtn.addEventListener('click', deselectAllAccounts);
    }

    const fetchPlaidBalancesBtn = document.getElementById('fetchPlaidBalancesBtn');
    if (fetchPlaidBalancesBtn) {
        fetchPlaidBalancesBtn.addEventListener('click', fetchPlaidBalances);
    }

    // Check if Plaid Link script is loaded
    setTimeout(() => {
        if (typeof Plaid === 'undefined') {
            console.error('❌ Plaid Link SDK not loaded');
            if (plaidResultsDiv) {
                plaidResultsDiv.style.display = 'block';
                plaidResultsDiv.innerHTML = `
                    <div class="status-badge status-error">❌ SDK Loading Error</div>
                    <div class="response-item">
                        <strong>Error:</strong> Plaid Link SDK failed to load
                    </div>
                    <div class="help-box">
                        <h4>Possible Solutions:</h4>
                        <ol>
                            <li>Check your internet connection</li>
                            <li>Refresh the page</li>
                            <li>Check if CDN is accessible: https://cdn.plaid.com</li>
                        </ol>
                    </div>
                `;
            }
        } else {
            console.log('✅ Plaid Link SDK loaded successfully');
        }
    }, 1000);
});

/**
 * Load a Plaid connection (Global function)
 */
function loadPlaidConnection(accessToken) {
    console.log('🔄 Loading Plaid connection...');

    // Store in global variables and localStorage
    plaidAccessToken = accessToken;
    localStorage.setItem('plaid_access_token', accessToken);

    // Enable fetch accounts button
    const fetchPlaidAccountsBtn = document.getElementById('fetchPlaidAccountsBtn');
    if (fetchPlaidAccountsBtn) {
        fetchPlaidAccountsBtn.disabled = false;
    }

    // Show accounts card
    const plaidAccountsCard = document.getElementById('plaidAccountsCard');
    if (plaidAccountsCard) {
        plaidAccountsCard.style.display = 'block';
    }

    // Scroll to accounts section
    plaidAccountsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

    alert('✅ Connection loaded! Click "Fetch Accounts" to view your bank accounts.');
}

/**
 * Fetch Plaid Transactions for Account (Global function)
 */
async function fetchPlaidTransactionsFor(accountId, accessToken) {
    const container = document.getElementById(`plaid-account-data-${accountId}`);
    container.innerHTML = '<p>⏳ Loading transactions...</p>';

    try {
        // Get transactions for last 30 days
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const response = await fetch('http://localhost:8000/api/plaid/transactions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                access_token: accessToken,
                start_date: startDate,
                end_date: endDate
            })
        });

        const data = await response.json();

        if (!response.ok || data.error) {
            throw new Error(data.error || 'Failed to fetch transactions');
        }

        console.log('📋 Transactions Data:', data);

        const transactions = data.transactions || [];
        const accountTransactions = transactions.filter(txn => txn.account_id === accountId);

        let html = '<div style="background: #fff5f5; padding: 15px; border-radius: 8px; margin-top: 10px; max-height: 400px; overflow-y: auto;">';
        html += '<h5 style="margin-top: 0; color: #00d4aa;">📋 Recent Transactions</h5>';

        if (accountTransactions.length > 0) {
            for (const txn of accountTransactions.slice(0, 10)) {
                const name = txn.name || 'Transaction';
                const amount = txn.amount || 0;
                const date = txn.date || 'N/A';
                const category = txn.category?.[0] || '';
                const amountColor = amount < 0 ? '#48bb78' : '#c53030';

                html += `
                    <div style="border-bottom: 1px solid #fed7d7; padding: 12px 0;">
                        <p style="margin: 5px 0;"><strong>${name}</strong></p>
                        <p style="margin: 5px 0;">
                            Amount: <strong style="color: ${amountColor};">${amount < 0 ? '+' : '-'}$${Math.abs(amount).toFixed(2)}</strong>
                        </p>
                        ${category ? `<p style="margin: 5px 0; font-size: 0.85em; color: #718096;">Category: ${category}</p>` : ''}
                        <p style="margin: 5px 0; font-size: 0.85em; color: #718096;">Date: ${date}</p>
                    </div>
                `;
            }
            if (accountTransactions.length > 10) {
                html += `<p style="margin-top: 10px; color: #718096;">... and ${accountTransactions.length - 10} more transactions</p>`;
            }
        } else {
            html += '<p style="color: #10b981;">✅ No transactions found for this account</p>';
        }

        html += '</div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('❌ Error fetching transactions:', error);
        container.innerHTML = '<p style="color: #f56565;">❌ Error: ' + error.message + '</p>';
    }
}
