# WalletConnect Setup Guide

This guide will help you set up WalletConnect integration to allow users to connect ANY crypto wallet (MetaMask Mobile, Trust Wallet, Rainbow, Coinbase Wallet, and 100+ others) to your application.

## 🔑 Getting Your Project ID

WalletConnect requires a free Project ID to function. Here's how to get one:

### Step 1: Create a WalletConnect Account

1. Go to [https://cloud.walletconnect.com](https://cloud.walletconnect.com)
2. Click **"Sign Up"** in the top right corner
3. Create an account using:
   - Email + Password
   - GitHub
   - Google
   - Or Discord

### Step 2: Create a New Project

1. Once logged in, click **"Create New Project"**
2. Fill in the project details:
   - **Project Name**: `Lean SDK Integration` (or your preferred name)
   - **Homepage URL**: `http://localhost:8000` (for development)
   - **Project Description**: Brief description of your app
3. Click **"Create Project"**

### Step 3: Copy Your Project ID

1. You'll be taken to your project dashboard
2. Find the **"Project ID"** field
3. Copy the Project ID (it looks like: `c27a1e4b4a7b0c3e5d1f2g3h4i5j6k7l`)

### Step 4: Update Your Code

Open `crypto-wallet-app.js` and locate line 555:

```javascript
const projectId = 'c27a1e4b4a7b0c3e5d1f2g3h4i5j6k7l'; // TODO: Replace with your project ID
```

Replace the placeholder with your actual Project ID:

```javascript
const projectId = 'YOUR_ACTUAL_PROJECT_ID_HERE';
```

Save the file and restart your server.

## 🎯 Testing WalletConnect

### Supported Wallets

WalletConnect works with **100+ mobile wallet apps**, including:

- **MetaMask Mobile** - Most popular Ethereum wallet
- **Trust Wallet** - Multi-chain wallet by Binance
- **Rainbow Wallet** - Beautiful Ethereum wallet
- **Coinbase Wallet** - Self-custody wallet by Coinbase
- **Argent** - Smart contract wallet
- **Crypto.com DeFi Wallet**
- **Zerion** - Multi-chain portfolio tracker
- **TokenPocket** - Multi-chain wallet
- **imToken** - Secure digital wallet
- **And many more...**

### How to Test

1. **Install a Wallet App** on your mobile device (e.g., MetaMask Mobile from App Store/Play Store)
2. **Create/Import a Wallet** in the app
3. **Open Your Application** at `http://localhost:8000`
4. **Navigate to** the "🔐 Crypto Wallets" tab
5. **Select** "WalletConnect - Universal wallet connector" from the dropdown
6. **Click** "🔗 Connect Wallet"
7. **Scan the QR code** with your wallet app
8. **Approve** the connection in your wallet app
9. **View your wallet details** - address, network, balance displayed
10. **Sign a message** to verify ownership

## 🌐 Supported Networks

The integration supports multiple blockchain networks:

### Default Network
- **Ethereum Mainnet** (Chain ID: 1)

### Additional Networks (Auto-configured)
- **Polygon** (Chain ID: 137)
- **Binance Smart Chain** (Chain ID: 56)
- **Optimism** (Chain ID: 10)
- **Arbitrum** (Chain ID: 42161)

Your wallet app will automatically connect on the network it's currently set to.

## 🔒 Security Features

WalletConnect provides secure wallet connections through:

- ✅ **End-to-End Encryption** - All communication is encrypted
- ✅ **QR Code Authentication** - Secure pairing via QR scan
- ✅ **User Approval Required** - Every action requires user confirmation
- ✅ **Read-Only by Default** - Only requests data, never private keys
- ✅ **Session Management** - Users can disconnect anytime
- ✅ **Event Listeners** - Detects disconnection, account changes, network switches

## 📱 How It Works

### 1. Connection Flow

```
User → Select WalletConnect → QR Code Displayed →
User Scans with Wallet App → Approves Connection →
Wallet Connected → Address & Balance Fetched
```

### 2. Message Signing Flow

```
User → Click "Verify Ownership" →
Message Generated → Sent to Wallet App →
User Approves Signature → Signature Returned →
Backend Verifies → Connection Saved
```

### 3. Disconnection Flow

```
User → Click "Disconnect" OR User Disconnects in App →
Session Terminated → Data Cleared
```

## 🛠️ Troubleshooting

### QR Code Not Appearing
- **Check Console** - Look for errors in browser console
- **Verify Project ID** - Make sure you've set a valid Project ID
- **Check Internet** - WalletConnect requires internet connection
- **Refresh Page** - Try refreshing the browser

### Connection Rejected
- **Check Wallet App** - Make sure wallet app is open and active
- **Try Again** - Sometimes the first attempt fails, try reconnecting
- **Check Network** - Ensure both devices are on stable internet

### Balance Shows 0
- **Network Mismatch** - Make sure wallet is on correct network (e.g., Ethereum Mainnet)
- **Empty Wallet** - Wallet may actually have 0 balance
- **RPC Error** - Try switching networks in wallet app and back

### Signature Fails
- **Approve in Wallet** - Make sure you approved the signature request
- **Check Wallet App** - Open wallet app if it's in background
- **Timeout** - Signature requests timeout after 2 minutes

### 404 Error on registry.walletconnect.com (Fixed)
- **What it was** - WalletConnect v1 library tried to fetch wallet metadata from deprecated v2 registry endpoint
- **Impact** - Cosmetic only, didn't affect QR code or wallet connections
- **Resolution** - Error is now automatically suppressed in console (see index.html:77-97)
- **Note** - QR code still works perfectly, connections successful, this was just visual noise

## 🚀 Production Deployment

When deploying to production:

1. **Update Homepage URL** in WalletConnect Dashboard
   - Replace `http://localhost:8000` with your production domain
   - Example: `https://yourapp.com`

2. **Verify CSP Headers**
   - Content Security Policy already configured for WalletConnect
   - No additional changes needed

3. **Test on Mobile**
   - Test with multiple wallet apps
   - Verify QR code scanning works
   - Check different mobile browsers

4. **Monitor Usage**
   - Check WalletConnect Dashboard for analytics
   - Monitor connection success rates
   - Track which wallets users prefer

## 📊 Free Tier Limits

WalletConnect Cloud free tier includes:

- ✅ **Unlimited Projects**
- ✅ **10,000 requests/month**
- ✅ **Basic Analytics**
- ✅ **Community Support**

For higher volume, check [WalletConnect Pricing](https://cloud.walletconnect.com/pricing).

## 📚 Additional Resources

- **WalletConnect Documentation**: [https://docs.walletconnect.com](https://docs.walletconnect.com)
- **Reown Documentation**: [https://docs.reown.com](https://docs.reown.com)
- **WalletConnect Explorer**: [https://walletconnect.com/explorer](https://walletconnect.com/explorer) - Browse supported wallets
- **GitHub Examples**: [https://github.com/WalletConnect](https://github.com/WalletConnect)

## ✅ Verification Checklist

Before deploying, verify:

- [ ] Project ID is set in `crypto-wallet-app.js`
- [ ] Server is running on port 8000
- [ ] Navigate to Crypto Wallets tab
- [ ] Select WalletConnect from dropdown
- [ ] QR code appears when clicking Connect
- [ ] Can scan QR with mobile wallet app
- [ ] Connection succeeds
- [ ] Address and balance display correctly
- [ ] Can sign message for verification
- [ ] Can disconnect successfully

## 🎉 Success!

Once everything is working, you'll be able to connect to ANY mobile wallet app through WalletConnect's universal protocol. This gives your users the freedom to use their preferred wallet while maintaining security and ease of use.

---

**Need Help?**

- Check the browser console for error messages
- Review the troubleshooting section above
- Visit [WalletConnect Support](https://support.walletconnect.com)
- Open an issue on GitHub
