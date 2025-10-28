# 🗑️ Bank Account Disconnect Guide

This guide explains how to disconnect bank accounts for both Lean SDK and Plaid SDK.

## ✅ Already Implemented Features

Both SDKs have **fully functional** disconnect/delete capabilities:

---

## 🔵 Plaid SDK - Disconnect Bank Connection

### Overview
Permanently removes a Plaid Item (bank connection) and invalidates the access token.

### Backend Implementation
**File:** `server.js:611-630`
**Endpoint:** `POST /api/plaid/remove-item`

```javascript
async function removePlaidItem(accessToken) {
    // Calls Plaid's /item/remove API
    // Permanently invalidates access_token
    // Cannot be undone
}
```

### Frontend Implementation
**File:** `plaid-app.js:914-948`
**Function:** `removePlaidItem(accessToken, itemId, institutionName)`

```javascript
async function removePlaidItem(accessToken, itemId, institutionName) {
    // Shows confirmation dialog
    // Calls backend API
    // Refreshes connections list
    // Shows success/error alerts
}
```

### How to Use in UI

1. **Navigate to Plaid Tab**
   - Click on "🔵 Plaid SDK (US)" tab at the top

2. **Go to Connections Section**
   - Scroll down to "Step 5: View All Connections"
   - Click "📋 View All Connections" button

3. **Find Your Connection**
   - You'll see all your Plaid bank connections listed
   - Each connection shows:
     - 🏦 Institution name (e.g., "Chase", "Bank of America")
     - Item ID
     - Access Token (truncated)
     - Number of accounts
     - Connection timestamp

4. **Disconnect**
   - Click the **🗑️ Disconnect** button (red button on the right)
   - Confirm the action in the popup dialog
   - Connection will be permanently removed from Plaid
   - The list will refresh automatically

### What Happens When You Disconnect

✅ **Immediate Effects:**
- Access token is permanently invalidated
- Bank connection removed from Plaid's system
- Cannot fetch accounts, balances, or transactions anymore

⚠️ **Important:**
- **Cannot be undone** - user must reconnect to restore access
- **Local data preserved** - Connection history remains in local files
- **Requires reconnection** - User must go through Plaid Link again

### API Request/Response

**Request:**
```json
POST /api/plaid/remove-item
{
  "access_token": "access-sandbox-abc123..."
}
```

**Response:**
```json
{
  "request_id": "xyz789"
}
```

---

## 🟣 Lean SDK - Delete Consent

### Overview
Deletes a specific consent for data access permissions granted to a Lean entity.

### Backend Implementation
**File:** `server.js:389-418`
**Endpoint:** `POST /api/consents/delete`

```javascript
async function deleteConsent(customerId, entityId, consentId, reason) {
    // Calls Lean's DELETE /consents API
    // Removes specific consent
    // Reason codes: USER_REQUESTED, EXPIRED, etc.
}
```

### Frontend Implementation
**File:** `app.js:975-1007`
**Function:** `deleteConsent(consentId)`

```javascript
async function deleteConsent(consentId) {
    // Shows confirmation dialog
    // Calls backend API with customer_id, entity_id, consent_id
    // Refreshes consents list
    // Shows success/error alerts
}
```

### How to Use in UI

1. **Navigate to Lean Tab**
   - Click on "🔗 Lean SDK (Saudi Arabia)" tab at the top

2. **Connect a Bank Account First**
   - Complete Steps 1 & 2 to create a connection
   - You'll be redirected back after successful connection

3. **Go to Consent Management**
   - Scroll down to "Step 3: Manage Consents"
   - Customer ID and Entity ID should be pre-filled
   - Click "📋 List Consents" button

4. **View Your Consents**
   - You'll see all active consents listed
   - Each consent shows:
     - Consent ID
     - Status (ACTIVE, EXPIRED, etc.)
     - Creation date
     - Expiration date
     - Permissions granted

5. **Delete a Consent**
   - Click the **🗑️ Delete Consent** button for the consent you want to remove
   - Confirm the action in the popup dialog
   - Consent will be permanently deleted
   - The list will refresh automatically

### What Happens When You Delete

✅ **Immediate Effects:**
- Specific consent is revoked
- Data access for that consent is removed
- Lean entity can no longer access data under that consent

⚠️ **Important:**
- **Other consents remain** - Only deletes the specific consent selected
- **Can create new consent** - User can reconnect anytime
- **Reason recorded** - Deletion reason (USER_REQUESTED) is logged

### API Request/Response

**Request:**
```json
POST /api/consents/delete
{
  "customer_id": "82e518a0-19fe-4561-ae2a-988b5056d5af",
  "entity_id": "a7ac9fac-1cf2-409d-9c1c-9c9d8252701c",
  "consent_id": "03d61d06-53b7-4aaf-bc35-4a44d052cfee",
  "reason": "USER_REQUESTED"
}
```

**Response:**
```json
{
  "success": true
}
```

---

## 🔄 Comparison: Plaid vs Lean Disconnect

| Feature | Plaid (Remove Item) | Lean (Delete Consent) |
|---------|---------------------|----------------------|
| **What it removes** | Entire bank connection | Specific data access consent |
| **Scope** | All accounts in the Item | Single consent instance |
| **Reversible?** | ❌ No - must reconnect | ✅ Can create new consent |
| **Access token** | Permanently invalidated | Other consents remain valid |
| **Reason tracking** | Not required | Required (USER_REQUESTED, etc.) |
| **UI Location** | Step 5: View All Connections | Step 3: Manage Consents |
| **Button Color** | 🔴 Red | 🔴 Red |

---

## 📍 Quick Navigation

### To Disconnect Plaid:
```
http://localhost:8000
→ Plaid Tab
→ Step 5: View All Connections
→ 📋 View All Connections
→ 🗑️ Disconnect (red button)
```

### To Delete Lean Consent:
```
http://localhost:8000
→ Lean Tab
→ Connect a bank (Steps 1-2)
→ Step 3: Manage Consents
→ 📋 List Consents
→ 🗑️ Delete Consent (red button)
```

---

## 🛡️ Security Notes

### Plaid
- **Secure**: Access tokens are invalidated at Plaid's servers
- **Immediate**: Effect is instant across all systems
- **Audit trail**: Plaid logs all item removals

### Lean
- **Secure**: Consents are revoked in Lean's system
- **Granular**: Can remove specific consents without affecting others
- **Reason tracking**: All deletions include reason codes
- **Audit trail**: Lean logs all consent deletions with reasons

---

## 🚨 Common Issues

### Plaid Disconnect Fails
**Symptoms:** Error when clicking Disconnect
**Solutions:**
- Verify server is running on port 8000
- Check Plaid credentials in .env
- Ensure access_token is still valid
- Check browser console for errors

### Lean Delete Consent Fails
**Symptoms:** Error when clicking Delete Consent
**Solutions:**
- Verify Customer ID and Entity ID are correct
- Check Lean credentials in .env
- Ensure consent exists and is valid
- Check browser console for errors

### Disconnect Button Not Visible
**Symptoms:** Can't find the disconnect button
**Solutions:**
- **Plaid**: Make sure you've connected at least one bank account first
- **Lean**: Complete the connection flow first (Steps 1-2)
- Refresh the page if recently connected
- Check that you're in the correct tab (Plaid or Lean)

---

## 💡 Best Practices

### When to Disconnect/Delete

**Recommended:**
- User explicitly requests to disconnect
- Security concerns (compromised credentials)
- User no longer uses the service
- Testing/development cleanup

**Not Recommended:**
- During active transactions
- Without user confirmation
- For troubleshooting connection issues
- To force reconnection (use refresh instead)

### User Communication

Always inform users that:
- **Plaid**: Disconnect is permanent and requires full reconnection
- **Lean**: Consent deletion revokes specific permissions only
- **Both**: Local data may remain in connection logs (git-ignored)
- **Both**: Action requires confirmation and cannot be easily undone

---

## 📚 Related Documentation

- **Plaid Docs**: https://plaid.com/docs/api/items/#itemremove
- **Lean Docs**: https://docs.leantech.me/docs/delete-consent
- **Backend Code**: `server.js` lines 389-418 (Lean), 611-630 (Plaid)
- **Frontend Code**: `app.js` line 975 (Lean), `plaid-app.js` line 914 (Plaid)
- **API Endpoints**: See CLAUDE.md for complete API reference

---

## ✅ Summary

Both Plaid and Lean SDKs have **fully implemented** disconnect/delete functionality:

- ✅ Backend API endpoints working
- ✅ Frontend UI buttons present
- ✅ Confirmation dialogs included
- ✅ Error handling implemented
- ✅ Success/failure feedback provided
- ✅ Automatic list refresh after action
- ✅ Comprehensive logging

**You're all set!** The disconnect features are ready to use. 🎉
