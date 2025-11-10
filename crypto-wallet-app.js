// Crypto Wallet Integration with WalletConnect v2 (Reown AppKit)
// IMPORTANT: WalletConnect libraries are loaded dynamically to prevent interference with MetaMask/Phantom
// Do NOT add static imports for @reown/appkit, @reown/appkit-adapter-ethers, or @reown/appkit/networks

// Global state
let connectedWallet = null;
let currentProvider = null;
let debugMode = false;
let appKit = null; // WalletConnect v2 AppKit instance

// Debug logging function
function debugLog(...args) {
if (debugMode) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] 🔐 CRYPTO:`, ...args);
}
}

// ES Module - runs after DOM is loaded automatically
console.log('='.repeat(50));
console.log('🔐 Crypto Wallet Integration Initialized (WalletConnect v2)');
console.log('='.repeat(50));

// Get UI elements
const walletProviderSelect = document.getElementById('walletProvider');
const connectWalletBtn = document.getElementById('connectWalletBtn');
const verifyOwnershipBtn = document.getElementById('verifyOwnershipBtn');
const loadWalletsBtn = document.getElementById('loadWalletsBtn');
const cryptoDebugCheckbox = document.getElementById('cryptoDebugMode');
const detectedWalletsDiv = document.getElementById('detectedWallets');

// Detect available wallets on page load
detectAvailableWallets();

const cryptoResults = document.getElementById('cryptoResults');
const walletDetails = document.getElementById('walletDetails');
const signatureResults = document.getElementById('signatureResults');
const walletsList = document.getElementById('walletsList');

const cryptoResultsCard = document.getElementById('cryptoResultsCard');
const walletDetailsCard = document.getElementById('walletDetailsCard');
const signatureCard = document.getElementById('signatureCard');
const walletsListCard = document.getElementById('walletsListCard');

// WalletConnect v2 (Reown AppKit) Configuration
// IMPORTANT: Only initialize when user selects WalletConnect to avoid interfering with direct wallet connections
const projectId = '5d7ffd6c63b8e2292d9579f958621e89'; // Your Project ID

const metadata = {
name: 'Lean SDK Integration',
description: 'Multi-platform financial integration with Lean, Plaid, and Crypto Wallets',
url: window.location.origin,
icons: ['https://avatars.githubusercontent.com/u/37784886']
};

// Do NOT initialize AppKit on page load - it interferes with MetaMask/Phantom
// AppKit will be initialized lazily when user selects WalletConnect
console.log('⚠️ WalletConnect v2 will be initialized only when selected (prevents interference with MetaMask)');

// Debug mode toggle
cryptoDebugCheckbox.addEventListener('change', function() {
    debugMode = this.checked;
    if (debugMode) {
        console.log('🐛 Debug mode enabled');
    } else {
        console.log('🐛 Debug mode disabled');
    }
});

// Enable connect button when provider is selected
walletProviderSelect.addEventListener('change', function() {
    connectWalletBtn.disabled = !this.value;
    if (this.value) {
        debugLog('Selected provider:', this.value);
    }
});

// Connect Wallet button
connectWalletBtn.addEventListener('click', async function() {
    console.log('🔗 Connect Wallet button clicked');

    const provider = walletProviderSelect.value;
    console.log('   Selected provider:', provider);

    if (!provider) {
        alert('Please select a wallet provider');
        console.error('❌ No provider selected');
        return;
    }

    // Log wallet availability
    console.log('   window.ethereum exists?', typeof window.ethereum !== 'undefined');
    console.log('   window.solana exists?', typeof window.solana !== 'undefined');

    debugLog('Initiating connection to:', provider);
    connectWalletBtn.disabled = true;
    connectWalletBtn.textContent = '⏳ Connecting...';

    try {
        console.log('   Calling connectWallet() function...');
        await connectWallet(provider);
        console.log('✅ connectWallet() completed successfully');
    } catch (error) {
        console.error('❌ Connection failed:', error);
        console.error('   Error details:', {
            message: error.message,
            code: error.code,
            stack: error.stack
        });

        cryptoResults.innerHTML = `
            <div class="status-badge status-error">❌ Connection Failed</div>
            <div class="response-item">
                <strong>Error:</strong>
                <pre>${error.message}</pre>
            </div>
            <div class="response-item">
                <strong>Debug Info:</strong>
                <pre>window.ethereum: ${typeof window.ethereum !== 'undefined' ? 'Available' : 'Not available'}
window.solana: ${typeof window.solana !== 'undefined' ? 'Available' : 'Not available'}
Selected provider: ${provider}</pre>
            </div>
        `;
        cryptoResultsCard.style.display = 'block';
    } finally {
        connectWalletBtn.disabled = false;
        connectWalletBtn.textContent = '🔗 Connect Wallet';
        console.log('   Button state restored');
    }
});

// Verify Ownership button
verifyOwnershipBtn.addEventListener('click', async function() {
    if (!connectedWallet) {
        alert('No wallet connected');
        return;
    }

    debugLog('Initiating signature verification');
    verifyOwnershipBtn.disabled = true;
    verifyOwnershipBtn.textContent = '⏳ Signing...';

    try {
        await verifyOwnership();
    } catch (error) {
        console.error('❌ Verification failed:', error);
        signatureResults.innerHTML = `
            <div class="status-badge status-error">❌ Verification Failed</div>
            <div class="response-item">
                <strong>Error:</strong>
                <pre>${error.message}</pre>
            </div>
        `;
        signatureCard.style.display = 'block';
    } finally {
        verifyOwnershipBtn.disabled = false;
        verifyOwnershipBtn.textContent = '✍️ Verify Ownership (Sign Message)';
    }
});

// Load Wallets button
loadWalletsBtn.addEventListener('click', async function() {
    debugLog('Loading connected wallets');
    loadWalletsBtn.disabled = true;
    loadWalletsBtn.textContent = '⏳ Loading...';

    try {
        await loadConnectedWallets();
    } catch (error) {
        console.error('❌ Failed to load wallets:', error);
        walletsList.innerHTML = `
            <div class="status-badge status-error">❌ Failed to Load</div>
            <div class="response-item">
                <strong>Error:</strong>
                <pre>${error.message}</pre>
            </div>
        `;
        walletsListCard.style.display = 'block';
    } finally {
        loadWalletsBtn.disabled = false;
        loadWalletsBtn.textContent = '🔄 Load Connected Wallets';
    }
});

/**
 * Detect available wallets in the browser
 */
function detectAvailableWallets() {
    if (!detectedWalletsDiv) return;

    console.log('🔍 Detecting available wallets...');

    const available = [];
    const unavailable = [];

    // Check MetaMask
    if (typeof window.ethereum !== 'undefined') {
        if (window.ethereum.isMetaMask) {
            available.push('✅ MetaMask - Ready to connect');
        } else if (window.ethereum.isCoinbaseWallet) {
            available.push('✅ Coinbase Wallet - Ready to connect');
        } else if (window.ethereum.isTrust) {
            available.push('✅ Trust Wallet - Ready to connect');
        } else {
            available.push('✅ Ethereum Wallet - Ready to connect');
        }
    } else {
        unavailable.push('❌ MetaMask - Not installed');
    }

    // Check Phantom (Solana)
    if (typeof window.solana !== 'undefined' && window.solana.isPhantom) {
        available.push('✅ Phantom - Ready to connect');
    } else {
        unavailable.push('❌ Phantom - Not installed');
    }

    // Build detection HTML
    let html = '';

    if (available.length > 0) {
        html += '<div style="color: #2e7d32; margin-bottom: 10px;"><strong>Available Wallets:</strong></div>';
        html += '<ul style="margin: 5px 0; padding-left: 25px;">';
        available.forEach(wallet => {
            html += `<li>${wallet}</li>`;
        });
        html += '</ul>';
    }

    if (unavailable.length > 0) {
        html += '<div style="color: #d32f2f; margin-top: 10px; margin-bottom: 10px;"><strong>Not Installed:</strong></div>';
        html += '<ul style="margin: 5px 0; padding-left: 25px;">';
        unavailable.forEach(wallet => {
            html += `<li>${wallet}</li>`;
        });
        html += '</ul>';
    }

    if (available.length === 0) {
        html += `
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 10px;">
                <strong>⚠️ No Wallets Detected</strong>
                <p style="margin: 10px 0 0 0;">
                    No crypto wallet extensions are currently installed.
                    <br>You can:
                    <br>• Install <a href="https://metamask.io/download/" target="_blank" style="color: #f7931a;">MetaMask</a> for Ethereum
                    <br>• Install <a href="https://phantom.app/" target="_blank" style="color: #f7931a;">Phantom</a> for Solana
                    <br>• Use Demo Mode to test the feature
                </p>
            </div>
        `;
    }

    detectedWalletsDiv.innerHTML = html;
    console.log(`✅ Detection complete: ${available.length} available, ${unavailable.length} unavailable`);
}

/**
 * Connect to wallet based on provider
 */
async function connectWallet(provider) {
    debugLog('Connecting to provider:', provider);

    switch (provider) {
        case 'metamask':
            await connectMetaMask();
            break;
        case 'coinbase':
            await connectCoinbaseWallet();
            break;
        case 'trust':
            await connectTrustWallet();
            break;
        case 'phantom':
            await connectPhantom();
            break;
        case 'walletconnect':
            await connectWalletConnect();
            break;
        case 'binance':
        case 'kraken':
        case 'bitstamp':
            await connectExchange(provider);
            break;
        case 'ledger':
        case 'trezor':
            await connectHardwareWallet(provider);
            break;
        default:
            throw new Error('Unsupported wallet provider');
    }
}

/**
 * Connect to MetaMask
 */
async function connectMetaMask() {
    console.log('📝 connectMetaMask() function called');
    console.log('   Checking window.ethereum...');
    console.log('   typeof window.ethereum =', typeof window.ethereum);

    debugLog('Checking for MetaMask...');

    if (typeof window.ethereum === 'undefined') {
        console.log('❌ window.ethereum is undefined - MetaMask not detected');

        // Show detailed installation instructions
        cryptoResults.innerHTML = `
            <div class="status-badge status-error">❌ MetaMask Not Detected</div>
            <div class="response-item">
                <strong>Installation Required:</strong>
                <p>MetaMask wallet extension is not installed in your browser.</p>
            </div>
            <div class="info-box" style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 15px;">
                <strong>📥 How to Install MetaMask:</strong>
                <ol style="margin: 10px 0 0 20px;">
                    <li>Visit <a href="https://metamask.io/download/" target="_blank" style="color: #f7931a; font-weight: bold;">metamask.io/download</a></li>
                    <li>Click "Install MetaMask for Chrome/Firefox/Brave"</li>
                    <li>Follow the installation wizard</li>
                    <li>Create a new wallet or import existing one</li>
                    <li>Return to this page and try again</li>
                </ol>
                <p style="margin-top: 15px;"><strong>Alternative:</strong> You can also try the demo mode below to see how it works without installing MetaMask.</p>
            </div>
            <button class="connect-btn" style="margin-top: 15px; background: linear-gradient(135deg, #667eea, #764ba2);" onclick="runMetaMaskDemo()">
                🎮 Run Demo Mode (No MetaMask Required)
            </button>
        `;
        cryptoResultsCard.style.display = 'block';
        throw new Error('MetaMask is not installed. Please install MetaMask extension from metamask.io');
    }

    console.log('✅ window.ethereum exists! - MetaMask detected!');
    debugLog('MetaMask detected, requesting accounts...');

    try {
        console.log('   Requesting eth_requestAccounts...');
        console.log('   About to call window.ethereum.request()...');

        // Request account access
        console.log('   Calling window.ethereum.request with method: eth_requestAccounts');
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        }).catch(err => {
            console.error('❌ window.ethereum.request() threw an error:', err);
            throw err;
        });

        console.log('✅ Accounts received:', accounts);

        const address = accounts[0];
        console.log('   Using address:', address);
        debugLog('Connected to address:', address);

        // Get network info
        const chainId = await window.ethereum.request({
            method: 'eth_chainId'
        });

        const networkName = getNetworkName(chainId);
        debugLog('Network:', networkName, chainId);

        // Get balance
        const balance = await window.ethereum.request({
            method: 'eth_getBalance',
            params: [address, 'latest']
        });

        const ethBalance = parseInt(balance, 16) / Math.pow(10, 18);
        debugLog('Balance:', ethBalance, 'ETH');

        // Store connection
        connectedWallet = {
            provider: 'MetaMask',
            address: address,
            network: networkName,
            chainId: chainId,
            balance: ethBalance,
            balanceUnit: 'ETH'
        };

        currentProvider = window.ethereum;

        // Display results
        cryptoResults.innerHTML = `
            <div class="status-badge status-success">✅ Connected to MetaMask!</div>
            <div class="response-item">
                <strong>Provider:</strong>
                <pre>MetaMask (Ethereum)</pre>
            </div>
            <div class="response-item">
                <strong>Wallet Address:</strong>
                <pre>${address}</pre>
            </div>
            <div class="response-item">
                <strong>Network:</strong>
                <pre>${networkName} (Chain ID: ${chainId})</pre>
            </div>
        `;

        cryptoResultsCard.style.display = 'block';

        // Display wallet details
        walletDetails.innerHTML = `
            <div class="response-item">
                <strong>💰 Balance:</strong>
                <pre>${ethBalance.toFixed(4)} ETH</pre>
            </div>
            <div class="response-item">
                <strong>🔗 Network:</strong>
                <pre>${networkName}</pre>
            </div>
            <div class="response-item">
                <strong>📧 Address:</strong>
                <pre>${address}</pre>
            </div>
            <div class="info-box" style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-top: 15px;">
                <strong>✅ Connection Successful!</strong>
                <p style="margin: 10px 0 0 0;">Click the button below to verify ownership by signing a message.</p>
            </div>
        `;

        walletDetailsCard.style.display = 'block';
        verifyOwnershipBtn.style.display = 'block';

        console.log('✅ MetaMask connected successfully');

    } catch (error) {
        if (error.code === 4001) {
            throw new Error('User rejected the connection request');
        }
        throw error;
    }
}

/**
 * Connect to Coinbase Wallet
 */
async function connectCoinbaseWallet() {
    debugLog('Checking for Coinbase Wallet...');

    // Check for Coinbase Wallet
    if (window.ethereum && window.ethereum.isCoinbaseWallet) {
        debugLog('Coinbase Wallet detected');
        // Use same method as MetaMask (EIP-1193 provider)
        await connectMetaMask(); // Reuse MetaMask logic
        connectedWallet.provider = 'Coinbase Wallet';
    } else {
        throw new Error('Coinbase Wallet is not installed. Please install Coinbase Wallet extension.');
    }
}

/**
 * Connect to Trust Wallet
 */
async function connectTrustWallet() {
    debugLog('Checking for Trust Wallet...');

    if (window.ethereum && window.ethereum.isTrust) {
        debugLog('Trust Wallet detected');
        await connectMetaMask(); // Reuse MetaMask logic
        connectedWallet.provider = 'Trust Wallet';
    } else {
        throw new Error('Trust Wallet is not detected. Please use WalletConnect for mobile connection.');
    }
}

/**
 * Connect to Phantom (Solana)
 */
async function connectPhantom() {
    debugLog('Checking for Phantom...');

    if (typeof window.solana === 'undefined' || !window.solana.isPhantom) {
        throw new Error('Phantom wallet is not installed. Please install Phantom extension.');
    }

    debugLog('Phantom detected, connecting...');

    try {
        const resp = await window.solana.connect();
        const address = resp.publicKey.toString();
        debugLog('Connected to Phantom:', address);

        // Get balance
        const connection = new window.solanaWeb3.Connection(
            window.solanaWeb3.clusterApiUrl('mainnet-beta')
        );
        const balance = await connection.getBalance(resp.publicKey);
        const solBalance = balance / Math.pow(10, 9); // Convert lamports to SOL

        debugLog('Balance:', solBalance, 'SOL');

        connectedWallet = {
            provider: 'Phantom',
            address: address,
            network: 'Solana Mainnet',
            chainId: 'solana-mainnet',
            balance: solBalance,
            balanceUnit: 'SOL'
        };

        currentProvider = window.solana;

        cryptoResults.innerHTML = `
            <div class="status-badge status-success">✅ Connected to Phantom!</div>
            <div class="response-item">
                <strong>Provider:</strong>
                <pre>Phantom (Solana)</pre>
            </div>
            <div class="response-item">
                <strong>Wallet Address:</strong>
                <pre>${address}</pre>
            </div>
            <div class="response-item">
                <strong>Network:</strong>
                <pre>Solana Mainnet</pre>
            </div>
        `;

        cryptoResultsCard.style.display = 'block';

        walletDetails.innerHTML = `
            <div class="response-item">
                <strong>💰 Balance:</strong>
                <pre>${solBalance.toFixed(4)} SOL</pre>
            </div>
            <div class="response-item">
                <strong>🔗 Network:</strong>
                <pre>Solana Mainnet</pre>
            </div>
            <div class="response-item">
                <strong>📧 Address:</strong>
                <pre>${address}</pre>
            </div>
        `;

        walletDetailsCard.style.display = 'block';
        verifyOwnershipBtn.style.display = 'block';

        console.log('✅ Phantom connected successfully');

    } catch (error) {
        if (error.code === 4001) {
            throw new Error('User rejected the connection request');
        }
        throw error;
    }
}

/**
 * Connect via WalletConnect v2 (Reown AppKit)
 */
async function connectWalletConnect() {
    console.log('📝 connectWalletConnect() v2 function called');
    debugLog('Opening WalletConnect v2 (Reown AppKit)...');

    // Lazy initialization - dynamically import and create AppKit only when user selects WalletConnect
    if (!appKit) {
        console.log('🔧 Dynamically loading WalletConnect v2 libraries...');

        try {
            // Dynamic imports to prevent interference with MetaMask/Phantom
            const { createAppKit } = await import('@reown/appkit');
            const { EthersAdapter } = await import('@reown/appkit-adapter-ethers');
            const { mainnet, polygon, bsc, optimism, arbitrum } = await import('@reown/appkit/networks');

            console.log('✅ WalletConnect libraries loaded');
            console.log('🔧 Initializing WalletConnect v2 (Reown AppKit)...');

            appKit = createAppKit({
                adapters: [new EthersAdapter()],
                networks: [mainnet, polygon, bsc, optimism, arbitrum],
                metadata,
                projectId,
                features: {
                    analytics: true,
                    email: false,       // ❌ Disable Email login
                    socials: []         // ❌ Disable all social logins
                },
                featuredWalletIds: [
                    'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
                    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
                    '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369', // Rainbow
                    '163d2cf19babf05eb8962e9748f9ebe613ed52ebf9c8107c9a0f104bfcf161b3'  // Phantom
                ]
            });
            console.log('✅ WalletConnect v2 (Reown AppKit) initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize WalletConnect v2:', error);
            cryptoResults.innerHTML = `
                <div class="status-badge status-error">❌ WalletConnect Initialization Failed</div>
                <div class="response-item">
                    <strong>Error:</strong>
                    <pre>${error.message}</pre>
                </div>
            `;
            cryptoResultsCard.style.display = 'block';
            throw new Error('WalletConnect v2 initialization failed: ' + error.message);
        }
    }

    try {
        debugLog('Opening AppKit modal...');

        // Show connecting status
        cryptoResults.innerHTML = `
            <div class="status-badge status-info">⏳ Opening WalletConnect...</div>
            <div class="response-item">
                <strong>Status:</strong>
                <pre>WalletConnect v2 modal opening... Select your wallet to connect.</pre>
            </div>
            <div class="info-box" style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-top: 15px;">
                <strong>📱 WalletConnect v2 Features:</strong>
                <p style="margin: 10px 0 0 0;">
                    • Beautiful wallet selection grid
                    <br>• QR code scanning for mobile wallets
                    <br>• Support for 350+ wallets
                    <br>• Multi-chain support
                    <br>• Secure end-to-end encryption
                </p>
            </div>
        `;
        cryptoResultsCard.style.display = 'block';

        // Open the AppKit modal
        await appKit.open();

        // Subscribe to account changes
        appKit.subscribeAccount(async (account) => {
            if (account.isConnected && account.address) {
                console.log('✅ WalletConnect v2 connected:', account);

                const address = account.address;
                const chainId = account.chainId || 1;
                const networkName = getNetworkName('0x' + chainId.toString(16));

                debugLog('Connected to address:', address);
                debugLog('Chain ID:', chainId);
                debugLog('Network:', networkName);

                // Get balance using ethers (dynamic import)
                try {
                    const { ethers } = await import('ethers');
                    const provider = new ethers.BrowserProvider(window.ethereum);
                    const balance = await provider.getBalance(address);
                    const ethBalance = parseFloat(ethers.formatEther(balance));
                    debugLog('Balance:', ethBalance, 'ETH');

                    // Store connection
                    connectedWallet = {
                        provider: 'WalletConnect',
                        address: address,
                        network: networkName,
                        chainId: '0x' + chainId.toString(16),
                        balance: ethBalance,
                        balanceUnit: 'ETH'
                    };

                    currentProvider = appKit;

                    // Display results
                    cryptoResults.innerHTML = `
                        <div class="status-badge status-success">✅ Connected via WalletConnect v2!</div>
                        <div class="response-item">
                            <strong>Provider:</strong>
                            <pre>WalletConnect v2 (Reown AppKit)</pre>
                        </div>
                        <div class="response-item">
                            <strong>Wallet Address:</strong>
                            <pre>${address}</pre>
                        </div>
                        <div class="response-item">
                            <strong>Network:</strong>
                            <pre>${networkName} (Chain ID: ${chainId})</pre>
                        </div>
                        <div class="info-box" style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-top: 15px;">
                            <strong>✅ Wallet Connected!</strong>
                            <p style="margin: 10px 0 0 0;">Your wallet is now connected via WalletConnect v2 protocol.</p>
                        </div>
                    `;

                    cryptoResultsCard.style.display = 'block';

                    // Display wallet details
                    walletDetails.innerHTML = `
                        <div class="response-item">
                            <strong>💰 Balance:</strong>
                            <pre>${ethBalance.toFixed(4)} ETH</pre>
                    </div>
                    <div class="response-item">
                        <strong>🔗 Network:</strong>
                        <pre>${networkName}</pre>
                    </div>
                    <div class="response-item">
                        <strong>📧 Address:</strong>
                        <pre>${address}</pre>
                    </div>
                    <div class="info-box" style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-top: 15px;">
                        <strong>✅ Connection Successful!</strong>
                        <p style="margin: 10px 0 0 0;">Click the button below to verify ownership by signing a message.</p>
                    </div>
                    <button class="connect-btn" style="margin-top: 15px; background: linear-gradient(135deg, #e53935, #d32f2f);" onclick="disconnectWalletConnect()">
                        🔌 Disconnect WalletConnect
                    </button>
                `;

                walletDetailsCard.style.display = 'block';
                verifyOwnershipBtn.style.display = 'block';

                console.log('✅ WalletConnect connected successfully');
            } catch (balanceError) {
                console.warn('⚠️ Could not fetch balance:', balanceError);

                // Store connection anyway (balance fetch is not critical)
                connectedWallet = {
                    provider: 'WalletConnect',
                    address: address,
                    network: networkName,
                    chainId: '0x' + chainId.toString(16),
                    balance: 0,
                    balanceUnit: 'ETH'
                };

                currentProvider = appKit;

                cryptoResults.innerHTML = `
                    <div class="status-badge status-success">✅ Connected via WalletConnect v2!</div>
                    <div class="response-item">
                        <strong>Wallet Address:</strong>
                        <pre>${address}</pre>
                    </div>
                    <div class="response-item">
                        <strong>Network:</strong>
                        <pre>${networkName}</pre>
                    </div>
                    <div class="info-box" style="background: #fff9e6; padding: 15px; border-radius: 8px; margin-top: 15px;">
                        <strong>⚠️ Balance Not Available</strong>
                        <p style="margin: 10px 0 0 0;">Connected successfully but could not fetch balance. You can still verify ownership.</p>
                    </div>
                `;

                walletDetailsCard.style.display = 'block';
                verifyOwnershipBtn.style.display = 'block';
            }
        }
    });

    debugLog('AppKit modal opened, waiting for user to connect...');

    } catch (error) {
        console.error('❌ WalletConnect error:', error);

        if (error.message && (error.message.includes('User rejected') || error.message.includes('User closed modal'))) {
            cryptoResults.innerHTML = `
                <div class="status-badge status-error">❌ Connection Rejected</div>
                <div class="response-item">
                    <strong>Error:</strong>
                    <pre>User rejected the connection request or closed the modal</pre>
                </div>
            `;
        } else {
            cryptoResults.innerHTML = `
                <div class="status-badge status-error">❌ Connection Failed</div>
                <div class="response-item">
                    <strong>Error:</strong>
                    <pre>${error.message || 'Unknown error occurred'}</pre>
                </div>
                <div class="info-box" style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 15px;">
                    <strong>💡 Troubleshooting:</strong>
                    <p style="margin: 10px 0 0 0;">
                        • Make sure you have a wallet app installed on your phone
                        <br>• Check that you scanned the QR code correctly
                        <br>• Try refreshing the page and connecting again
                        <br>• Verify your internet connection
                        <br>• Open browser console (F12) for more details
                    </p>
                </div>
            `;
        }
        cryptoResultsCard.style.display = 'block';
        throw error;
    }
}

/**
 * Disconnect WalletConnect
 */
window.disconnectWalletConnect = async function() {
    if (!currentProvider) {
        console.warn('⚠️ No WalletConnect session to disconnect');
        return;
    }

    try {
        await currentProvider.killSession();
        console.log('✅ WalletConnect disconnected');

        connectedWallet = null;
        currentProvider = null;

        cryptoResults.innerHTML = `
            <div class="status-badge status-success">✅ Disconnected Successfully</div>
            <div class="response-item">
                <strong>Status:</strong>
                <pre>WalletConnect session ended</pre>
            </div>
        `;

        walletDetails.innerHTML = '';
        walletDetailsCard.style.display = 'none';
        verifyOwnershipBtn.style.display = 'none';

    } catch (error) {
        console.error('❌ Disconnect error:', error);
        alert('Failed to disconnect: ' + error.message);
    }
};

/**
 * Connect to Exchange (OAuth)
 */
async function connectExchange(exchange) {
    const exchangeName = exchange.charAt(0).toUpperCase() + exchange.slice(1);

    cryptoResults.innerHTML = `
        <div class="status-badge status-info">ℹ️ ${exchangeName} Exchange Connection</div>
        <div class="response-item">
            <strong>Status:</strong>
            <pre>${exchangeName} exchange integration requires API keys</pre>
        </div>
        <div class="info-box" style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 15px;">
            <strong>🔑 API Setup Required:</strong>
            <p style="margin: 10px 0 0 0;">
                To connect to ${exchangeName}:
                <br>1. Log in to your ${exchangeName} account
                <br>2. Generate API keys (Read-only recommended)
                <br>3. Configure keys in your backend
                <br>4. Use ${exchangeName} API to fetch balances
                <br><br>For security, exchange connections require backend implementation.
            </p>
        </div>
    `;
    cryptoResultsCard.style.display = 'block';
    throw new Error(`${exchangeName} exchange requires API key configuration`);
}

/**
 * Connect to Hardware Wallet
 */
async function connectHardwareWallet(wallet) {
    const walletName = wallet.charAt(0).toUpperCase() + wallet.slice(1);

    cryptoResults.innerHTML = `
        <div class="status-badge status-info">ℹ️ ${walletName} Hardware Wallet</div>
        <div class="response-item">
            <strong>Status:</strong>
            <pre>${walletName} requires desktop application</pre>
        </div>
        <div class="info-box" style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 15px;">
            <strong>🔐 ${walletName} Setup:</strong>
            <p style="margin: 10px 0 0 0;">
                To connect ${walletName}:
                <br>1. Install ${walletName} ${wallet === 'ledger' ? 'Live' : 'Suite'} desktop app
                <br>2. Connect your ${walletName} device via USB
                <br>3. Unlock the device
                <br>4. Use ${walletName} ${wallet === 'ledger' ? 'Live' : 'Suite'} to access wallet
                <br><br>Alternatively, you can connect via MetaMask using ${walletName} as the signer.
            </p>
        </div>
    `;
    cryptoResultsCard.style.display = 'block';
    throw new Error(`${walletName} requires hardware device and desktop application`);
}

/**
 * Verify ownership by signing a message
 */
async function verifyOwnership() {
    if (!connectedWallet || !currentProvider) {
        throw new Error('No wallet connected');
    }

    const message = `Verify wallet ownership at ${new Date().toISOString()}\n\nWallet: ${connectedWallet.address}\nNetwork: ${connectedWallet.network}\n\nThis signature proves you own this wallet.`;

    debugLog('Requesting signature for message:', message);

    try {
        let signature;

        if (connectedWallet.provider === 'Phantom') {
            // Solana signature
            const encodedMessage = new TextEncoder().encode(message);
            const signedMessage = await window.solana.signMessage(encodedMessage, 'utf8');
            signature = signedMessage.signature.toString();
        } else if (connectedWallet.provider === 'WalletConnect') {
            // WalletConnect v2 signature via ethereum provider
            signature = await window.ethereum.request({
                method: 'personal_sign',
                params: [message, connectedWallet.address]
            });
        } else {
            // Ethereum signature (MetaMask, Coinbase, Trust)
            signature = await currentProvider.request({
                method: 'personal_sign',
                params: [message, connectedWallet.address]
            });
        }

        debugLog('Signature received:', signature);

        // Verify signature on backend
        const response = await fetch('http://localhost:8000/api/crypto/verify-signature', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                address: connectedWallet.address,
                signature: signature,
                message: message
            })
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Signature verification failed');
        }

        debugLog('Signature verified successfully');

        // Display verification results
        signatureResults.innerHTML = `
            <div class="status-badge status-success">✅ Ownership Verified!</div>
            <div class="response-item">
                <strong>Wallet Address:</strong>
                <pre>${connectedWallet.address}</pre>
            </div>
            <div class="response-item">
                <strong>Signature:</strong>
                <pre>${signature.substring(0, 50)}...${signature.substring(signature.length - 10)}</pre>
            </div>
            <div class="response-item">
                <strong>Message:</strong>
                <pre>${message}</pre>
            </div>
            <div class="response-item">
                <strong>Verified:</strong>
                <pre>✅ ${new Date().toLocaleString()}</pre>
            </div>
            <div class="info-box" style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-top: 15px;">
                <strong>✅ Verification Complete!</strong>
                <p style="margin: 10px 0 0 0;">Ownership has been verified. Connection will be saved.</p>
            </div>
        `;

        signatureCard.style.display = 'block';

        // Save connection
        await saveConnection(signature, message);

        console.log('✅ Ownership verified and connection saved');

    } catch (error) {
        if (error.code === 4001) {
            throw new Error('User rejected the signature request');
        }
        throw error;
    }
}

/**
 * Save wallet connection
 */
async function saveConnection(signature, message) {
    debugLog('Saving wallet connection...');

    const connectionData = {
        provider: connectedWallet.provider,
        address: connectedWallet.address,
        network: connectedWallet.network,
        chainId: connectedWallet.chainId,
        balance: connectedWallet.balance,
        balanceUnit: connectedWallet.balanceUnit,
        signature: signature,
        message: message,
        verified_at: new Date().toISOString()
    };

    try {
        const response = await fetch('http://localhost:8000/api/crypto/save-connection', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(connectionData)
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Failed to save connection');
        }

        debugLog('Connection saved:', result.filename);
        console.log('✅ Wallet connection saved to:', result.filename);

    } catch (error) {
        console.error('❌ Failed to save connection:', error);
        // Don't throw - connection is still valid even if save fails
    }
}

/**
 * Load connected wallets
 */
async function loadConnectedWallets() {
    debugLog('Fetching connected wallets from backend...');

    try {
        const response = await fetch('http://localhost:8000/api/crypto/connections');
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Failed to load connections');
        }

        debugLog('Loaded', result.count, 'wallet connections');

        if (result.count === 0) {
            walletsList.innerHTML = `
                <div class="info-box" style="background: #e3f2fd; padding: 20px; border-radius: 8px; text-align: center;">
                    <h3 style="margin-top: 0;">No Wallets Connected</h3>
                    <p>Connect a wallet above to see it listed here.</p>
                </div>
            `;
        } else {
            let html = `<h3>📊 Connected Wallets (${result.count})</h3>`;

            result.connections.forEach((conn, index) => {
                html += `
                    <div class="response-item" style="border-left: 4px solid #f7931a; padding-left: 15px; margin-bottom: 20px;">
                        <strong>#${index + 1} - ${conn.provider}</strong>
                        <div style="margin-top: 10px;">
                            <p><strong>Address:</strong> <code>${conn.address}</code></p>
                            <p><strong>Network:</strong> ${conn.network}</p>
                            <p><strong>Balance:</strong> ${conn.balance} ${conn.balanceUnit}</p>
                            <p><strong>Connected:</strong> ${new Date(conn.connected_at).toLocaleString()}</p>
                            ${conn.verified_at ? `<p><strong>Verified:</strong> ✅ ${new Date(conn.verified_at).toLocaleString()}</p>` : ''}
                        </div>
                        <button class="connect-btn" style="margin-top: 10px; background: linear-gradient(135deg, #e53935, #d32f2f);" onclick="disconnectWallet('${conn.address}')">
                            🗑️ Disconnect Wallet
                        </button>
                    </div>
                `;
            });

            walletsList.innerHTML = html;
        }

        walletsListCard.style.display = 'block';
        console.log(`✅ Loaded ${result.count} wallet connections`);

    } catch (error) {
        console.error('❌ Failed to load wallets:', error);
        throw error;
    }
}

/**
 * Disconnect wallet
 */
window.disconnectWallet = async function(address) {
    if (!confirm(`Are you sure you want to disconnect wallet ${address}?`)) {
        return;
    }

    debugLog('Disconnecting wallet:', address);

    try {
        const response = await fetch('http://localhost:8000/api/crypto/disconnect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ address: address })
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Failed to disconnect wallet');
        }

        console.log('✅ Wallet disconnected:', address);
        alert('Wallet disconnected successfully!');

        // Reload wallets list
        await loadConnectedWallets();

    } catch (error) {
        console.error('❌ Failed to disconnect wallet:', error);
        alert('Failed to disconnect wallet: ' + error.message);
    }
};

/**
 * Get network name from chain ID
 */
function getNetworkName(chainId) {
    const networks = {
        '0x1': 'Ethereum Mainnet',
        '0x3': 'Ropsten Testnet',
        '0x4': 'Rinkeby Testnet',
        '0x5': 'Goerli Testnet',
        '0x2a': 'Kovan Testnet',
        '0x38': 'Binance Smart Chain',
        '0x61': 'BSC Testnet',
        '0x89': 'Polygon Mainnet',
        '0x13881': 'Mumbai Testnet',
        '0xa': 'Optimism',
        '0xa4b1': 'Arbitrum One',
        '0xa4ba': 'Arbitrum Nova',
        '0xfa': 'Fantom Opera',
        '0x19': 'Cronos Mainnet'
    };

    return networks[chainId] || `Unknown Network (${chainId})`;
}

/**
 * Demo Mode - Simulate wallet connection without MetaMask
 * Allows testing the feature without installing browser extension
 */
window.runMetaMaskDemo = async function() {
    console.log('🎮 Running MetaMask demo mode...');

    // Simulate wallet connection
    const demoAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
    const demoChainId = '0x1';
    const demoBalance = 1.2345;

    cryptoResults.innerHTML = `
        <div class="status-badge status-success">✅ Connected to MetaMask (Demo Mode)!</div>
        <div class="info-box" style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <strong>🎮 Demo Mode Active</strong>
            <p style="margin: 10px 0 0 0;">This is a simulated connection for demonstration purposes. Install MetaMask for real wallet connections.</p>
        </div>
        <div class="response-item">
            <strong>Provider:</strong>
            <pre>MetaMask (Ethereum) - DEMO</pre>
        </div>
        <div class="response-item">
            <strong>Wallet Address:</strong>
            <pre>${demoAddress}</pre>
        </div>
        <div class="response-item">
            <strong>Network:</strong>
            <pre>Ethereum Mainnet (Chain ID: ${demoChainId})</pre>
        </div>
    `;

    cryptoResultsCard.style.display = 'block';

    // Display wallet details
    walletDetails.innerHTML = `
        <div class="info-box" style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <strong>🎮 Demo Mode</strong>
        </div>
        <div class="response-item">
            <strong>💰 Balance:</strong>
            <pre>${demoBalance.toFixed(4)} ETH</pre>
        </div>
        <div class="response-item">
            <strong>🔗 Network:</strong>
            <pre>Ethereum Mainnet</pre>
        </div>
        <div class="response-item">
            <strong>📧 Address:</strong>
            <pre>${demoAddress}</pre>
        </div>
        <div class="info-box" style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 15px;">
            <strong>ℹ️ Note:</strong>
            <p style="margin: 10px 0 0 0;">This is simulated data. To connect a real wallet and sign messages, please install MetaMask from <a href="https://metamask.io" target="_blank" style="color: #f7931a;">metamask.io</a></p>
        </div>
    `;

    walletDetailsCard.style.display = 'block';

    // Store demo connection
    connectedWallet = {
        provider: 'MetaMask (Demo)',
        address: demoAddress,
        network: 'Ethereum Mainnet',
        chainId: demoChainId,
        balance: demoBalance,
        balanceUnit: 'ETH',
        demo: true
    };

    console.log('✅ Demo mode connection created');

    // Show demo signature button
    const demoSignBtn = document.createElement('button');
    demoSignBtn.className = 'connect-btn';
    demoSignBtn.style.marginTop = '15px';
    demoSignBtn.textContent = '✍️ Simulate Signature Verification (Demo)';
    demoSignBtn.onclick = simulateDemoSignature;
    walletDetails.appendChild(demoSignBtn);
};

/**
 * Simulate signature verification in demo mode
 */
window.simulateDemoSignature = async function() {
    console.log('🎮 Simulating signature verification...');

    const message = `Verify wallet ownership at ${new Date().toISOString()}\n\nWallet: ${connectedWallet.address}\nNetwork: ${connectedWallet.network}\n\nThis signature proves you own this wallet.`;
    const demoSignature = '0xabcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234567890ab1b';

    signatureResults.innerHTML = `
        <div class="status-badge status-success">✅ Ownership Verified (Demo Mode)!</div>
        <div class="info-box" style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <strong>🎮 Demo Signature</strong>
            <p style="margin: 10px 0 0 0;">This is a simulated signature. Real signatures require MetaMask to be installed.</p>
        </div>
        <div class="response-item">
            <strong>Wallet Address:</strong>
            <pre>${connectedWallet.address}</pre>
        </div>
        <div class="response-item">
            <strong>Signature:</strong>
            <pre>${demoSignature.substring(0, 50)}...${demoSignature.substring(demoSignature.length - 10)}</pre>
        </div>
        <div class="response-item">
            <strong>Message:</strong>
            <pre>${message}</pre>
        </div>
        <div class="response-item">
            <strong>Verified:</strong>
            <pre>✅ ${new Date().toLocaleString()} (DEMO)</pre>
        </div>
        <div class="info-box" style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 15px;">
            <strong>ℹ️ Demo Mode:</strong>
            <p style="margin: 10px 0 0 0;">This connection will NOT be saved. Install MetaMask for real wallet connections and signature verification.</p>
        </div>
    `;

    signatureCard.style.display = 'block';
    console.log('✅ Demo signature simulated');
};

console.log('✅ Crypto Wallet Integration Ready');
