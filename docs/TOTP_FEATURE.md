# TOTP (2FA) Feature

## Overview

Passwall extension now supports TOTP (Time-based One-Time Password) authentication codes - no phone required! You can capture QR codes directly from websites and generate 6-digit codes.

## How It Works

1. **QR Code Capture**: Click camera button → Extension screenshots active tab → Reads QR code automatically
2. **TOTP Generation**: Generates 6-digit codes every 30 seconds
3. **Secure Storage**: TOTP secrets are encrypted in the backend (like passwords)

## Usage

### Creating a Login with TOTP

1. Visit a website's 2FA setup page (e.g., Google Account → Security → 2-Step Verification)
2. When the QR code appears, open Passwall extension
3. Create new login or edit existing
4. In the "Authenticator Key (TOTP)" field:
   - Click the **camera icon** 📷 to scan QR code from page
   - OR manually paste the secret key (if website provides text format)
5. Click "Show TOTP Code" to verify it's working
6. Save the login

### Using TOTP Codes

1. Open a login that has TOTP configured
2. Click "Show TOTP Code" button
3. See the 6-digit code with countdown timer
4. Click copy icon to copy to clipboard
5. Paste into website's 2FA prompt

## Technical Details

### New Files

- `src/polyfills.js` - Buffer polyfill for @otplib
- `src/utils/totp-capture.js` - QR code scanning service
- `src/utils/totp.js` - TOTP code generation
- `src/components/TOTPCounter.vue` - Live TOTP display component

### Updated Files

- `src/popup/main.js` - Imports polyfills first
- `src/stores/logins.js` - Added `totp_secret` to encrypted fields
- `src/popup/views/Logins/create.vue` - TOTP input + camera button
- `src/popup/views/Logins/detail.vue` - TOTP display + edit
- `vite.config.js` - Node polyfills plugin
- `package.json` - New dependencies

### Dependencies

```json
{
  "@otplib/preset-browser": "^12.0.1",
  "buffer": "^6.0.3",
  "qr-scanner": "^1.4.2",
  "vite-plugin-node-polyfills": "^0.24.0"
}
```

### Browser Permissions

Already available in manifest.json:
- `"activeTab"` - For screenshot capture
- `"<all_urls>"` - For tab capture API

## Security

- ✅ TOTP secrets are encrypted before storage (same as passwords)
- ✅ QR code scanning only when user clicks camera button
- ✅ No external API calls - everything happens locally
- ✅ Secrets never logged in plaintext

## Backend

The backend already supports `totp_secret` field in the Login model (`passwall-server/model/login.go`), so no backend changes were needed!

## Troubleshooting

**QR Code not detected?**
- Ensure QR code is fully visible on screen
- Try zooming in/out to make QR code larger
- Some QR codes may be too small or blurry

**"Buffer is not defined" error?**
- Make sure all dependencies are installed: `yarn install`
- Rebuild extension: `yarn build`
- Reload extension in browser

**TOTP codes don't match?**
- Check system time is accurate
- Verify the secret was captured correctly
- Try re-scanning the QR code

