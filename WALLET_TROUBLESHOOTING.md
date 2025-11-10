# 🔧 Crypto Wallet Integration - Troubleshooting Guide

## ✅ Step-by-Step Installation & Testing

### **Step 1: Install MetaMask**

1. **Open your browser** (Chrome, Firefox, Brave, or Edge)

2. **Visit MetaMask download page:**
   - Go to: https://metamask.io/download/
   - Click **"Install MetaMask for [Your Browser]"**

3. **Install the extension:**
   - Click "Add to [Browser]" button
   - Confirm the installation
   - Wait for installation to complete

4. **Setup MetaMask:**
   - Click "Get Started"
   - Choose "Create a new wallet" (or import existing)
   - Create a password
   - **IMPORTANT:** Save your Secret Recovery Phrase securely (write it down!)
   - Complete the setup wizard

5. **Verify MetaMask is installed:**
   - Look for the MetaMask fox icon in your browser toolbar
   - If you don't see it, click the puzzle piece icon and pin MetaMask
   - Make sure MetaMask is **UNLOCKED** (enter your password if needed)

### **Step 2: Test Wallet Detection**

1. **Open the test page:**
   ```
   http://localhost:8000/test-wallet.html
   ```

2. **Check detection results:**
   - You should see: ✅ **Ethereum Wallet Detected - Type: MetaMask**
   - If you see ❌ error, MetaMask is not properly installed

3. **Click "Connect MetaMask" button:**
   - MetaMask popup should appear
   - Click "Next" then "Connect"
   - You should see your wallet address and balance

4. **If the test page works, MetaMask is installed correctly!**

### **Step 3: Use the Main Application**

1. **Open the main app:**
   ```
   http://localhost:8000
   ```

2. **Hard refresh the page** (important!):
   - **Windows/Linux:** Press `Ctrl + Shift + R`
   - **Mac:** Press `Cmd + Shift + R`
   - This clears the browser cache and loads the latest version

3. **Click on the "🔐 Crypto Wallets" tab**

4. **Check wallet detection status:**
   - Under "Detecting Available Wallets" you should see:
     - ✅ **MetaMask - Ready to connect**

5. **Select wallet provider:**
   - From the dropdown, select "MetaMask - Most popular Ethereum wallet"

6. **Click "Connect Wallet" button:**
   - MetaMask popup will appear
   - Click "Next" then "Connect"
   - Wait for connection to complete

7. **You should see:**
   - ✅ Connected to MetaMask!
   - Your wallet address
   - Network name (e.g., Ethereum Mainnet)
   - Wallet details with balance

## 🐛 Common Issues & Solutions

### Issue 1: "MetaMask is not installed"

**Symptoms:**
- Error message: "MetaMask is not installed"
- Wallet detection shows: ❌ MetaMask - Not installed

**Solutions:**
1. Install MetaMask from https://metamask.io/download/
2. Make sure you're using a supported browser (Chrome, Firefox, Brave, Edge)
3. After installing, **refresh the page** (Ctrl/Cmd + Shift + R)
4. Make sure MetaMask extension is **enabled** in your browser extensions

### Issue 2: "Connection not working after MetaMask is installed"

**Symptoms:**
- MetaMask is installed but clicking "Connect Wallet" does nothing
- No MetaMask popup appears

**Solutions:**
1. **Hard refresh the browser:**
   - Windows/Linux: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

2. **Clear browser cache:**
   - Chrome: Settings → Privacy → Clear browsing data
   - Select "Cached images and files"
   - Click "Clear data"

3. **Restart your browser:**
   - Close all browser windows completely
   - Open browser again
   - Navigate to http://localhost:8000

4. **Check MetaMask is unlocked:**
   - Click the MetaMask icon in toolbar
   - If it asks for password, enter it
   - Make sure you see your account and balance

5. **Check browser console for errors:**
   - Press `F12` to open DevTools
   - Click "Console" tab
   - Look for red error messages
   - Share these errors if you need help

### Issue 3: "MetaMask popup doesn't appear"

**Symptoms:**
- Clicking "Connect Wallet" shows loading state
- MetaMask popup never appears
- Button returns to normal without connecting

**Solutions:**
1. **Check popup blockers:**
   - Look for a blocked popup icon in address bar
   - Click it and allow popups from localhost
   - Try connecting again

2. **Manually open MetaMask:**
   - Click MetaMask icon in toolbar
   - Click "Connected sites"
   - Add http://localhost:8000

3. **Reset MetaMask permissions:**
   - Click MetaMask icon → Settings → Connected sites
   - Disconnect localhost if connected
   - Try connecting again from the app

### Issue 4: "Wrong network" or "Balance shows 0"

**Symptoms:**
- Connected but balance shows 0
- Network shows testnet instead of mainnet

**Solutions:**
1. **Switch network in MetaMask:**
   - Click MetaMask icon
   - Click network dropdown (top of popup)
   - Select "Ethereum Mainnet"
   - Refresh the page and reconnect

2. **Get test ETH for testnets:**
   - If you're on Goerli/Sepolia testnet
   - Visit a faucet: https://faucets.chain.link/
   - Request test ETH

### Issue 5: "User rejected the request"

**Symptoms:**
- Error: "User rejected the connection request"
- Connection fails after MetaMask popup appears

**Solution:**
- This is normal - you clicked "Cancel" or "Reject" in MetaMask
- Try again and click "Next" → "Connect" in MetaMask popup

### Issue 6: "404 Error on registry.walletconnect.com" (FIXED)

**Symptoms:**
- Console shows: `GET https://registry.walletconnect.com/api/v2/wallets 404 Not Found`
- Error appears when using WalletConnect
- QR code still displays and works fine

**What happened:**
- WalletConnect v1 library tries to fetch wallet metadata from deprecated v2 registry endpoint
- This is a cosmetic error that doesn't affect functionality
- QR code works, wallet connections work, signature verification works

**Resolution:**
- ✅ **Already fixed** - Error is now automatically suppressed (index.html:77-97)
- The suppression script filters out this specific 404 error from console
- All other important errors still display normally
- No action needed from you!

**Technical details:**
- WalletConnect v1 uses bridge protocol (works without the registry)
- The registry was only for showing wallet logos/names in UI
- Your QR code connects directly to wallet apps via encrypted bridge
- See WALLETCONNECT_SETUP.md for full WalletConnect documentation

## 🎮 Using Demo Mode (No MetaMask Required)

If you can't install MetaMask or just want to test the feature:

1. **Select MetaMask** from dropdown
2. **Click "Connect Wallet"**
3. **Click the "🎮 Run Demo Mode" button**
4. You'll see simulated wallet data:
   - Demo address
   - Demo balance (1.2345 ETH)
   - Demo network
5. Click "Simulate Signature Verification" to see how signing works

**Note:** Demo mode data is NOT saved and is only for testing the UI.

## 🔍 Debug Mode

Enable debug mode for detailed console logging:

1. Scroll down to the "Debug Mode" section
2. Check the "🐛 Debug Mode" checkbox
3. Open browser console (F12 → Console tab)
4. Try connecting again
5. You'll see detailed logs of every step

## 📊 Verification Checklist

Before asking for help, verify:

- [ ] MetaMask extension is installed
- [ ] MetaMask is unlocked (you can see your account)
- [ ] You hard-refreshed the page (Ctrl/Cmd + Shift + R)
- [ ] Test page works: http://localhost:8000/test-wallet.html
- [ ] Server is running: `node server.js`
- [ ] No popup blockers active
- [ ] Using supported browser (Chrome/Firefox/Brave/Edge)
- [ ] Checked browser console for errors (F12)

## 🆘 Still Not Working?

If you've tried all the above and it still doesn't work:

1. **Test page first:**
   - Open http://localhost:8000/test-wallet.html
   - Does it work there? If yes, it's a cache issue
   - If no, MetaMask installation has a problem

2. **Restart everything:**
   ```bash
   # Stop server
   lsof -ti:8000 | xargs kill

   # Start server
   node server.js

   # Hard refresh browser (Ctrl/Cmd + Shift + R)
   ```

3. **Check browser console:**
   - Open DevTools (F12)
   - Go to Console tab
   - Try connecting
   - Copy any error messages

4. **Share debug info:**
   - Browser name and version
   - MetaMask version
   - Console error messages
   - Whether test page works or not

## ✅ Success Indicators

You know it's working when you see:

1. **Wallet Detection:**
   - ✅ MetaMask - Ready to connect

2. **After Clicking Connect:**
   - MetaMask popup appears
   - Shows connection request

3. **After Approving:**
   - ✅ Connected to MetaMask!
   - Your real wallet address displayed
   - Real network name shown
   - Real balance displayed

4. **After Signature:**
   - Signature verification successful
   - Connection saved to backend
   - Can see it in "View Connected Wallets"
