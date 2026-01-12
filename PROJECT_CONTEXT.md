# PassWall Extension - Project Context

**Version:** 3.4.0  
**Last Updated:** January 2026  
**Status:** Production Ready  
**Framework:** Vue 3 + Manifest V3

---

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [Technology Stack](#-technology-stack)
3. [Project Structure](#-project-structure)
4. [Architecture Overview](#-architecture-overview)
5. [Zero-Knowledge Encryption](#-zero-knowledge-encryption)
6. [Extension Components](#-extension-components)
7. [Content Scripts & Auto-fill](#-content-scripts--auto-fill)
8. [Background Scripts](#-background-scripts)
9. [State Management](#-state-management)
10. [Development Workflow](#-development-workflow)
11. [Security Considerations](#-security-considerations)
12. [Best Practices](#-best-practices)
13. [Common Tasks](#-common-tasks)

---

## 🎯 Project Overview

**PassWall Extension** is the official browser extension for PassWall Password Manager. Built with Vue 3 and Manifest V3, it provides seamless password management directly in your browser.

### Key Features

- 🔐 **Zero-Knowledge Encryption** - Client-side encryption, server never sees plaintext
- 🔑 **Password Management** - Store, organize, and autofill passwords
- 🎯 **Auto-fill** - Smart form detection and filling
- 📝 **Multiple Item Types** - Passwords, cards, bank accounts, notes, addresses
- 🔒 **TOTP 2FA** - Built-in authenticator
- 🚀 **Cross-Browser** - Chrome, Firefox, Edge, Brave
- 🌐 **Multi-language** - i18n support
- 🎨 **Modern UI** - Clean, responsive interface

### Core Principles

1. **Security First** - Zero-knowledge architecture, client-side encryption
2. **User Experience** - Intuitive, fast, non-intrusive
3. **Privacy** - No tracking, no analytics without consent
4. **Cross-Platform** - Works on all major browsers
5. **Open Source** - Transparent, auditable code

---

## 🛠 Technology Stack

### Core Framework

- **Frontend:** Vue 3.4+ (Composition API)
- **Build Tool:** Vite 5.0+ (@crxjs/vite-plugin)
- **Manifest:** Manifest V3 (latest Chrome/Firefox standard)
- **Language:** JavaScript ES6+ (with JSDoc types)

### State Management

- **Store:** Pinia 2.1+ (replaces Vuex)
- **Persistence:** localforage (IndexedDB wrapper)
- **Browser Storage:** chrome.storage.local

### UI & Styling

- **Router:** Vue Router 4.2+
- **Forms:** VeeValidate 4.12+ with Yup validation
- **Styling:** SCSS with BEM methodology
- **Components:** Custom Vue components
- **Icons:** Custom SVG icon system
- **Notifications:** @kyvg/vue3-notification
- **Tooltips:** Floating Vue 5.2+

### Cryptography

- **Library:** CryptoJS 4.2 (will migrate to WebCrypto API)
- **KDF:** PBKDF2-SHA256 (600K iterations)
- **Encryption:** AES-256-CBC + HMAC-SHA256
- **Key Stretching:** HKDF-SHA256
- **TOTP:** @otplib/preset-browser 12.0

### API & Network

- **HTTP Client:** Axios 1.6+
- **Polyfills:** webextension-polyfill 0.11
- **Buffer:** buffer 6.0 (Node.js Buffer polyfill)

### Development Tools

- **Testing:** Vitest 1.2+ with JSDOM
- **Linting:** ESLint 8.56+ with Vue plugin
- **Package Manager:** yarn (preferred)

---

## 📁 Project Structure

```
passwall-extension/
├── public/                             # Static assets
│   ├── _locales/                       # i18n translations
│   │   └── en/
│   │       └── messages.json
│   ├── icons/                          # Extension icons
│   │   ├── 16.png
│   │   ├── 48.png
│   │   └── 128.png
│   ├── css/
│   │   └── content-script.css          # Content script styles
│   ├── fonts/                          # Web fonts
│   └── js/
│       └── jquery.js                   # Legacy jQuery for form detection
├── src/
│   ├── manifest.json                   # Extension manifest (Manifest V3)
│   ├── background-scripts/             # Service worker
│   │   └── background-script.js        # Background service worker
│   ├── content-scripts/                # Content scripts (injected)
│   │   ├── content-script.js           # Main content script
│   │   ├── LoginAsPopup.js             # Auto-fill popup
│   │   └── PasswallLogo.js             # Brand icon for forms
│   ├── popup/                          # Extension popup
│   │   ├── index.html                  # Popup HTML
│   │   ├── main.js                     # Popup entry point
│   │   ├── App.vue                     # Popup root component
│   │   ├── router/                     # Popup routes
│   │   │   ├── index.js
│   │   │   ├── auth-check.js           # Auth guard
│   │   │   └── clear-search.js         # Search reset
│   │   ├── store/                      # Popup store
│   │   │   └── index.js
│   │   └── views/                      # Popup pages
│   │       ├── Auth/
│   │       │   └── Login.vue           # Login page
│   │       ├── Home/                   # Dashboard/home
│   │       │   ├── index.vue
│   │       │   ├── store.js
│   │       │   └── tabs.vue
│   │       ├── Logins/                 # Password management
│   │       │   ├── index.vue           # List
│   │       │   ├── create.vue          # Create
│   │       │   ├── detail.vue          # View/edit
│   │       │   └── store.js
│   │       ├── CreditCards/            # Credit card vault
│   │       ├── BankAccounts/           # Bank account vault
│   │       ├── Notes/                  # Secure notes
│   │       ├── Addresses/              # Address storage
│   │       ├── Generator/              # Password generator
│   │       │   └── index.vue
│   │       └── ChangeMasterPassword/   # Change master password
│   ├── options/                        # Options/settings page
│   │   ├── index.html
│   │   ├── main.js
│   │   └── App.vue
│   ├── stores/                         # Pinia stores
│   │   ├── auth.js                     # Authentication store
│   │   ├── items.js                    # Vault items store
│   │   ├── changeMasterPassword.js     # Password change store
│   │   ├── factory.js                  # Store factory
│   │   └── index.js
│   ├── api/                            # API client
│   │   ├── HTTPClient.js               # Axios wrapper
│   │   └── services/                   # API services
│   │       ├── Auth.js
│   │       ├── Logins.js
│   │       ├── CreditCards.js
│   │       ├── BankAccounts.js
│   │       ├── Notes.js
│   │       └── ...
│   ├── components/                     # Shared Vue components
│   │   ├── VButton.vue
│   │   ├── VIcon.vue
│   │   ├── VFormText.vue
│   │   ├── VFormSearch.vue
│   │   ├── ListItem.vue
│   │   ├── Header.vue
│   │   ├── GeneratePassword.vue
│   │   ├── TOTPCounter.vue
│   │   ├── CheckPassword.vue           # Password strength
│   │   └── ...
│   ├── utils/                          # Utilities
│   │   ├── crypto.js                   # Cryptography service
│   │   ├── storage.js                  # Browser storage wrapper
│   │   ├── helpers.js                  # General helpers
│   │   ├── constants.js                # App constants
│   │   ├── totp.js                     # TOTP/2FA generation
│   │   ├── totp-capture.js             # TOTP auto-capture
│   │   ├── security-checks.js          # Security validations
│   │   ├── platform-rules.js           # Platform-specific rules
│   │   └── waiters.js                  # Async helpers
│   ├── styles/                         # SCSS styles
│   │   ├── app.scss                    # Main stylesheet
│   │   ├── config/                     # SCSS configuration
│   │   │   ├── variables.scss
│   │   │   ├── font-face.scss
│   │   │   └── formalize.scss
│   │   ├── utilities/                  # Utility classes
│   │   │   ├── colors.scss
│   │   │   ├── flexbox.scss
│   │   │   ├── space.scss
│   │   │   └── typography.scss
│   │   └── plugins/                    # Plugin overrides
│   ├── i18n/                           # Internationalization
│   │   ├── index.js
│   │   └── langs/
│   │       └── en.js
│   ├── config/
│   │   └── env.js                      # Environment config
│   └── App.vue                         # Root component
├── docs/                               # Documentation
│   ├── SECURITY_AUDIT_REPORT.md
│   ├── BUILD_INSTRUCTIONS.md
│   ├── ENVIRONMENT_CONFIG.md
│   └── MULTI_STEP_FORM_ANALYSIS.md
├── scripts/
│   └── fix-manifest-mv3.js             # Build post-processing
├── __tests__/                          # Integration tests
│   └── integration/
│       └── App.test.js
├── dist/                               # Build output
├── vite.config.js                      # Vite configuration
├── vitest.config.js                    # Vitest configuration
├── package.json                        # Dependencies
└── yarn.lock                           # Dependency lock
```

---

## 🏗 Architecture Overview

### Extension Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Extension                        │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        v                   v                   v
┌───────────────┐  ┌─────────────────┐  ┌──────────────────┐
│   Popup UI    │  │ Content Scripts │  │ Background Script│
│  (Vue 3 SPA)  │  │  (Injected JS)  │  │ (Service Worker) │
└───────────────┘  └─────────────────┘  └──────────────────┘
        │                   │                   │
        v                   v                   v
┌───────────────────────────────────────────────────────────┐
│              Chrome Extension APIs                        │
│  (storage, runtime, tabs, webNavigation, etc.)          │
└───────────────────────────────────────────────────────────┘
                            │
                            v
┌───────────────────────────────────────────────────────────┐
│                   PassWall Server API                     │
│         (Authentication, Encrypted Vault Data)            │
└───────────────────────────────────────────────────────────┘
```

### Component Interaction

```
User Action (Popup)
    ↓
Pinia Store (State Update)
    ↓
API Service (HTTP Request)
    ↓
Background Script (Intercept/Process)
    ↓
Server API
    ↓
Response
    ↓
Store Update (Cache)
    ↓
Component Re-render
```

### Content Script Interaction

```
Page Load
    ↓
Content Script Injected
    ↓
Detect Login Forms
    ↓
Show PassWall Icon
    ↓
User Clicks Icon
    ↓
Popup Overlay Opens
    ↓
User Selects Credential
    ↓
Auto-fill Form Fields
    ↓
Trigger Events (input, change)
```

---

## 🔐 Zero-Knowledge Encryption

### Encryption Architecture

**Core Principle:** Server NEVER sees plaintext data

```
Master Password (User Input)
    ↓ PBKDF2-SHA256 (600K iterations)
Master Key (256-bit, client-side only)
    ↓ HKDF("auth")
Auth Key → Server (bcrypt authentication)
    ↓ HKDF("enc" + "mac")
Stretched Master Key (512-bit)
    ↓ AES-256-CBC + HMAC
User Key (512-bit random)
    ↓ Encrypt with Stretched Master Key
Protected User Key → Server Storage
    ↓
User Key decrypts all vault items
```

### Crypto Service

**Location:** `src/utils/crypto.js`

**Key Functions:**

```javascript
// Key Derivation
CryptoUtils.pbkdf2Encrypt(password, salt, iterations)
CryptoUtils.hkdfExpand(masterKey, info, length)

// User Key Management
CryptoUtils.makeUserKey() // Generate 512-bit random key
CryptoUtils.protectUserKey(userKey, masterKey)
CryptoUtils.unwrapUserKey(protectedKey, masterKey)

// Encryption/Decryption
CryptoUtils.encrypt(plaintext, key) → EncString
CryptoUtils.decrypt(encString, key) → plaintext

// Field-level Encryption
CryptoUtils.encryptFields(item, fieldNames)
CryptoUtils.decryptFields(item, fieldNames)

// EncString Format
"2.iv|ciphertext|mac"
- 2 = Version (AES-256-CBC + HMAC-SHA256)
- iv = Base64 IV (16 bytes)
- ciphertext = Base64 encrypted data
- mac = Base64 HMAC (32 bytes)
```

### Security Features

- ✅ **PBKDF2** - 600,000 iterations (OWASP 2023 standard)
- ✅ **HKDF** - Key stretching and derivation
- ✅ **AES-256-CBC** - Symmetric encryption
- ✅ **HMAC-SHA256** - Message authentication
- ✅ **Encrypt-then-MAC** - Tamper protection
- ✅ **Per-user Salt** - Rainbow table protection
- ✅ **Field-level Encryption** - Granular security

---

## 🧩 Extension Components

### Popup (Main UI)

**Entry Point:** `src/popup/index.html`

**Features:**

- Vue 3 Single Page Application
- Vue Router for navigation
- Pinia for state management
- Authenticated by default
- 400px × 600px viewport

**Key Pages:**

- Login - Email/password authentication
- Home - Dashboard with search
- Logins - Password list
- Password Detail - View/edit/delete
- Create Password - Add new credential
- Generator - Password generator
- Settings - Preferences
- About - Version info

### Content Scripts

**Entry Point:** `src/content-scripts/content-script.js`

**Injection:**

```json
{
  "matches": ["<all_urls>"],
  "js": ["src/content-scripts/content-script.js"],
  "css": ["public/css/content-script.css"],
  "run_at": "document_idle"
}
```

**Features:**

- Form detection (login, registration, password reset)
- PassWall icon injection next to password fields
- Auto-fill popup overlay
- TOTP auto-capture
- Security checks (HTTPS only for auto-fill)

**Components:**

- `LoginAsPopup.js` - Auto-fill overlay UI
- `PasswallLogo.js` - Brand icon component

### Background Script (Service Worker)

**Entry Point:** `src/background-scripts/background-script.js`

**Responsibilities:**

- Message passing between components
- API request interception
- Session management
- Data encryption/decryption
- Badge updates
- Context menu handling

**Manifest V3 Service Worker:**

```json
{
  "background": {
    "service_worker": "src/background-scripts/background-script.js",
    "type": "module"
  }
}
```

### Options Page

**Entry Point:** `src/options/index.html`

**Features:**

- Full-page settings interface
- API URL configuration
- Theme preferences
- Language selection
- Advanced options

---

## 📝 Content Scripts & Auto-fill

### Form Detection

**Detection Rules:**

```javascript
// Password field detection
const passwordFields = document.querySelectorAll('input[type="password"]')

// Username field detection (heuristics)
const usernameFields = document.querySelectorAll(`
  input[type="email"],
  input[type="text"][name*="user"],
  input[type="text"][name*="email"],
  input[type="text"][name*="login"]
`)

// Form detection
const form = passwordField.closest('form')
```

### Platform-Specific Rules

**Location:** `src/utils/platform-rules.js`

**Supported Platforms:**

- Generic login forms
- Gmail/Google
- Facebook
- Twitter/X
- GitHub
- LinkedIn
- Amazon
- Netflix
- And many more...

**Rule Structure:**

```javascript
{
  domain: 'github.com',
  selectors: {
    username: '#login_field',
    password: '#password',
    submit: 'input[type="submit"]'
  },
  events: ['input', 'change', 'blur']
}
```

### Auto-fill Flow

```javascript
// 1. Detect form
detectLoginForm()

// 2. Show PassWall icon
injectPasswallIcon(passwordField)

// 3. User clicks icon
showLoginAsPopup()

// 4. User selects credential
selectedLogin = selectLogin()

// 5. Fill fields
fillUsernameField(selectedLogin.username)
fillPasswordField(selectedLogin.password)

// 6. Trigger events
triggerInputEvent(usernameField)
triggerChangeEvent(passwordField)

// 7. Optional: Auto-submit
if (autoSubmit) {
  form.submit()
}
```

### Security Checks

```javascript
// Only auto-fill on HTTPS
if (window.location.protocol !== 'https:') {
  console.warn('Auto-fill disabled: Not HTTPS')
  return
}

// Check domain match
if (!urlMatch(savedUrl, currentUrl)) {
  showWarning('Domain mismatch')
  return
}

// User confirmation for sensitive actions
if (requireConfirmation) {
  const confirmed = await showConfirmDialog()
  if (!confirmed) return
}
```

---

## 🔄 Background Scripts

### Message Passing

**From Popup to Background:**

```javascript
// popup
chrome.runtime.sendMessage(
  {
    action: 'getLogins',
    url: currentUrl
  },
  (response) => {
    console.log('Received logins:', response)
  }
)

// background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getLogins') {
    const logins = getMatchingLogins(request.url)
    sendResponse(logins)
  }
})
```

**From Content Script to Background:**

```javascript
// content-script
chrome.runtime.sendMessage({
  action: 'captureTotp',
  code: totpCode
})

// background
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'captureTotp') {
    storeTotpCode(request.code)
  }
})
```

### API Request Handling

```javascript
// Background script intercepts and adds auth
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const token = getAuthToken()
    details.requestHeaders.push({
      name: 'Authorization',
      value: `Bearer ${token}`
    })
    return { requestHeaders: details.requestHeaders }
  },
  { urls: ['https://vault.passwall.io/*'] },
  ['blocking', 'requestHeaders']
)
```

### Badge Updates

```javascript
// Update extension icon badge
function updateBadge(count) {
  chrome.action.setBadgeText({ text: count.toString() })
  chrome.action.setBadgeBackgroundColor({ color: '#5707FF' })
}

// Show notification
chrome.action.setTitle({ title: `${count} passwords available` })
```

---

## 🗄 State Management

### Auth Store

**Location:** `src/stores/auth.js`

**State:**

```javascript
{
  isAuthenticated: false,
  user: null,
  accessToken: null,
  refreshToken: null,
  masterKey: null,      // In-memory only
  userKey: null,        // In-memory only
  protectedUserKey: null, // From server
  kdfConfig: null
}
```

**Actions:**

```javascript
// Sign up
signUp(name, email, password)

// Sign in
signIn(email, password)

// Sign out
signOut()

// Lock vault (clear userKey)
lock()

// Unlock vault (re-derive keys)
unlock(password)

// Change master password
changeMasterPassword(currentPassword, newPassword)
```

### Items Store

**Location:** `src/stores/items.js`

**State:**

```javascript
{
  logins: [],
  creditCards: [],
  bankAccounts: [],
  notes: [],
  addresses: [],
  searchQuery: '',
  selectedFolder: null,
  isLoading: false
}
```

**Actions:**

```javascript
// Fetch items
fetchLogins()
fetchCreditCards()
fetchBankAccounts()

// CRUD operations
createLogin(data)
updateLogin(id, data)
deleteLogin(id)

// Search
searchItems(query)
filterByFolder(folderId)

// Encryption
encryptFields(item)
decryptFields(item)
```

---

## 💻 Development Workflow

### Setup

```bash
# Clone repository
git clone https://github.com/passwall/passwall-extension.git
cd passwall-extension

# Install dependencies
yarn install

# Start development server
yarn dev

# Build for production
yarn build

# Run tests
yarn test

# Package for distribution
yarn package
```

### Loading Extension

**Chrome:**

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `dist/` folder

**Firefox:**

1. Open `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select `dist/manifest.json`

### Hot Reload

```bash
yarn dev --watch
```

Changes automatically rebuild and reload the extension.

### Environment Configuration

```javascript
// src/config/env.js
export default {
  API_URL: process.env.VITE_API_URL || 'https://vault.passwall.io',
  ENV: process.env.NODE_ENV || 'development',
  VERSION: process.env.npm_package_version
}
```

---

## 🔒 Security Considerations

### Critical Security Issues (from Audit)

**⚠️ High Priority Fixes:**

1. **API Endpoint Validation**

   - Whitelist allowed API domains
   - Enforce HTTPS
   - Prevent MITM attacks

2. **postMessage Origin Validation**

   - Replace wildcard `'*'` with specific origin
   - Validate message sender

3. **Master Key Memory Protection**

   - Use WeakMap for key storage
   - Auto-clear after timeout
   - Minimize memory exposure

4. **PBKDF2 Iterations**

   - Increase from 100K to 600K
   - Follow NIST 2023 standard

5. **Storage Encryption**
   - Use chrome.storage.session
   - Add additional encryption layer

### Best Practices

- ✅ **Never log sensitive data** - Master Key, passwords, keys
- ✅ **Clear keys on logout** - Zero out memory
- ✅ **Validate all inputs** - Prevent injection attacks
- ✅ **HTTPS only auto-fill** - Security requirement
- ✅ **Domain matching** - Prevent phishing
- ✅ **CSP headers** - Content Security Policy
- ✅ **Minimal permissions** - Request only what's needed

---

## ✅ Best Practices

### Code Style

1. **Vue 3 Composition API** - Use `<script setup>`
2. **Component Naming** - PascalCase for files, kebab-case in templates
3. **Props Validation** - Define prop types
4. **Event Naming** - Use kebab-case for custom events
5. **Async/Await** - Prefer over promises

### Performance

1. **Lazy Loading** - Dynamic imports for routes
2. **Virtual Scrolling** - For long lists
3. **Debounce Search** - Avoid excessive API calls
4. **Cache API Responses** - Reduce network requests
5. **Optimize Images** - Compress icons and screenshots

### Security

1. **Input Sanitization** - Clean all user input
2. **XSS Prevention** - Use v-text, not v-html
3. **CSRF Protection** - Token validation
4. **Rate Limiting** - API request throttling
5. **Security Headers** - CSP, X-Frame-Options

### Testing

1. **Unit Tests** - Test crypto functions
2. **Integration Tests** - Test API calls
3. **E2E Tests** - Test user flows
4. **Security Tests** - Penetration testing
5. **Cross-Browser Tests** - Chrome, Firefox, Edge

---

## 🎯 Common Tasks

### Add New Vault Item Type

1. **Create API Service** in `src/api/services/`
2. **Create Pinia Store** in `src/stores/`
3. **Create Views** in `src/popup/views/`
   - List view
   - Create view
   - Detail view
4. **Add Routes** in `src/popup/router/index.js`
5. **Update Navigation** in Home component
6. **Add Encryption** for sensitive fields

### Add Content Script Feature

1. **Modify** `src/content-scripts/content-script.js`
2. **Add Platform Rule** in `src/utils/platform-rules.js`
3. **Test** on target website
4. **Add Security Checks**
5. **Update Documentation**

### Update Cryptography

1. **Modify** `src/utils/crypto.js`
2. **Update Key Derivation** (if needed)
3. **Add Migration Script** for existing data
4. **Run Security Audit**
5. **Update Tests**

### Add Localization

1. **Create Language File** in `src/i18n/langs/`
2. **Add to** `public/_locales/`
3. **Update** `src/i18n/index.js`
4. **Use** `$t('key')` in components
5. **Test** all UI strings

### Package Extension

```bash
# Build
yarn build

# Create ZIP
yarn package

# Output: passwall-extension-v3.4.0.zip
```

---

## 📞 Support & Resources

### Documentation

- **Chrome Extensions:** https://developer.chrome.com/docs/extensions/
- **Vue 3:** https://vuejs.org/guide/
- **Pinia:** https://pinia.vuejs.org/
- **Vite:** https://vitejs.dev/guide/
- **CRX.js:** https://crxjs.dev/vite-plugin/

### Internal Resources

- **Security Audit:** `/docs/SECURITY_AUDIT_REPORT.md`
- **Build Instructions:** `/docs/BUILD_INSTRUCTIONS.md`
- **Encryption Guide:** `/MODERN_ENCRYPTION_README.md`

---

**Last Updated:** January 2026  
**Maintained By:** PassWall Team  
**License:** MIT

---

**Remember:** This is a browser extension with elevated privileges. Security is paramount:

1. ✅ Validate all user input
2. ✅ Minimize permissions
3. ✅ Clear sensitive data
4. ✅ Follow Manifest V3 best practices
5. ✅ Regular security audits

**Happy coding! 🔐**

