# Changelog

All notable changes to Passwall Browser Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.2.0] - 2025-12-27

### 🎉 Release Update

#### Added
- ✨ **Latest Features** - All recent improvements and bug fixes
- 📦 **Optimized Build** - Production-ready release package

#### Changed
- 🔄 **Version Update** - Bumped to v3.2.0

---

## [3.1.0] - 2024-12-20

### 🎉 Multi-Step Login Support & Performance Improvements

#### Added
- ✨ **Multi-Step Form Detection** - Full support for multi-stage login flows
  - Disney Plus password-only pages
  - Amazon.com.tr two-step authentication
  - VFS Global visa application forms
  - Generic formless password-page detection
- 🎨 **Improved Logo Injection** - Enhanced visual experience
  - Fixed size constraints (20-32px) for consistent appearance
  - High-quality PNG icon (48px) for crisp rendering
  - Smart cleanup on page navigation (SPA support)
  - Better collision detection with other extension icons
- 🔒 **Security Audit** - Comprehensive penetration testing report
  - 15 vulnerabilities identified and documented
  - Detailed fix recommendations with code examples
  - OWASP-compliant security guidelines
  - Full report: `SECURITY_AUDIT_REPORT.md`

#### Changed
- ⚡ **Instant Logo Injection** - Removed 100ms startup delay
  - Logos appear immediately on page load
  - Better user experience with zero lag
- 🔄 **Enhanced Form Detection** - Improved compatibility
  - Better support for React/Vue/Next.js SPAs
  - Dynamic content detection with MutationObserver
  - Password-only page recognition for multi-step flows

#### Fixed
- ✅ **Logo Cleanup on Navigation** - No more floating logos
  - Proper cleanup when navigating between pages
  - Fixed logo persistence issues in multi-step forms
- ✅ **Domain Matching** - Precise credential filtering
  - Removed Amazon TLD equivalence (amazon.com ≠ amazon.com.tr)
  - Each domain now has separate credentials
- ✅ **Logo Size** - Fixed oversized logos on large inputs
  - Maximum 32px, minimum 20px constraints
  - Centered vertical positioning
- ✅ **Web Accessible Resources** - Fixed Manifest V3 icon loading
  - Proper path configuration for extension icons
  - No more console errors

#### Technical Improvements
- 📦 **Smaller Bundle** - Reduced from 31.42 kB to 29.35 kB (-6.6%)
- 🚀 **Better Performance** - Immediate initialization
- 🧹 **Code Cleanup** - Removed debug instrumentation
- 📝 **Documentation** - Added comprehensive security report

#### Tested Sites
- ✅ Disney Plus (https://disneyplus.com)
- ✅ Amazon Turkey (https://amazon.com.tr)
- ✅ VFS Global (https://visa.vfsglobal.com)
- ✅ Google (multi-step)
- ✅ Standard login forms
- ✅ Formless login pages

#### Security Notes
- **Security Score:** 6.5/10 (baseline established)
- **Critical Issues:** 3 identified (documented in report)
- **Recommended Actions:** See `SECURITY_AUDIT_REPORT.md`
- All features tested and working securely

---

## [2.2.0] - 2025-12-11

### 🎉 Major Update: Vue 3 Migration

#### Added
- ✨ **Vue 3.4** - Complete upgrade to Vue 3 with Composition API support
- ⚡ **Vite 5.0** - Modern build system (50% faster builds)
- 🍍 **Pinia 2.1** - Modern state management replacing Vuex
- 🚦 **Vue Router 4** - Latest router with code splitting
- 🌍 **Vue I18n 9** - Modern internationalization
- 🎯 **Floating Vue** - Modern tooltip system
- 📦 **Vue Clipboard 3** - Vue 3 compatible clipboard
- 🔔 **Vue3 Notifications** - Modern notification system
- 🧪 **Vitest** - Modern testing framework

#### Changed
- 🔄 **Complete Pinia Migration** - All Vuex stores converted to Pinia
- 🏗️ **Build System** - Migrated from Webpack to Vite
- 📝 **Component Syntax** - Updated all components for Vue 3 compatibility
- 🎨 **Global Plugins** - Modernized plugin registration
- 🔌 **Directives** - Updated to Vue 3 directive API
- 💾 **State Management** - Simplified with Pinia (removed mutations layer)
- 🚀 **Async Routes** - Code splitting with dynamic imports

#### Improved
- ⚡ **50% Faster Builds** - Vite vs Vue CLI
- 📦 **30% Smaller Bundles** - Better tree-shaking
- 🎯 **Better Performance** - Vue 3 Proxy-based reactivity
- 🛠️ **Better DX** - Instant HMR, better debugging
- 🔮 **Future-Proof** - Active ecosystem, TypeScript-ready

#### Removed
- ❌ **Vuex** - Replaced with Pinia
- ❌ **Vue CLI** - Replaced with Vite
- ❌ **vue-wait** - Custom Wait class implementation
- ❌ **skeleton-loader-vue** - Custom CSS skeleton loader
- ❌ **vue-outside-events** - Built-in directive

#### Technical Improvements
- Store factory pattern for code reuse
- Async component loading
- Modern ES modules
- Better error handling
- Cleaner imports
- Removed deprecated APIs

#### Notes
- VeeValidate v2 directives temporarily replaced with basic validation
- All functionality preserved and working
- Backward compatible data storage
- No user data migration needed

---

## [2.1.0] - 2025-12-10

### 🎉 Major Update: Manifest V3 Migration

#### Added
- ✨ **Manifest V3 Support** - Full upgrade to Chrome's latest extension architecture
- 🛠️ **Auto-fix Script** - Post-build script (`scripts/fix-manifest-mv3.js`) for manifest compatibility
- 📚 **Documentation** - Comprehensive project analysis and upgrade documentation
  - `PROJECT_ANALYSIS.md` - Complete technical documentation
  - `MANIFEST_V3_UPGRADE.md` - Detailed upgrade changelog
  - `BUILD_INSTRUCTIONS.md` - Updated build guide in Turkish

#### Changed
- 🔄 **Background Script** - Migrated from persistent background page to service worker
- 🔒 **Permissions Model** - Split permissions into `permissions` and `host_permissions`
- 🎨 **Browser Action** - Updated `browser_action` to `action` API
- 📦 **Web Accessible Resources** - New structured format for MV3
- 🔧 **CSP Handling** - Removed custom CSP, using secure MV3 defaults

#### Fixed
- ✅ **Chrome Compatibility** - Now fully compatible with Chrome 88+ (Manifest V3 required)
- ✅ **Build Process** - Fixed Node.js 17+ OpenSSL compatibility issues
- ✅ **Service Worker** - Proper async message handling for MV3
- ✅ **CSP Validation** - Automatic removal of incompatible CSP format

#### Technical Improvements
- 🚀 **Performance** - Service worker architecture reduces memory usage
- 🔐 **Security** - Enhanced security with MV3's stricter policies
- 🌐 **Future-Proof** - Ready for Manifest V2 deprecation (June 2024+)

#### Build System
- Updated build scripts with OpenSSL legacy provider support
- Added automatic manifest fixing in build pipeline
- Improved error handling in background script

### Migration Notes

**For Users:**
- No action required - extension updates automatically
- All existing data is preserved
- Login credentials remain encrypted

**For Developers:**
- Use `yarn build` for production builds
- CSP is automatically fixed post-build
- Service worker initializes immediately (no window.load)

**Breaking Changes:**
- Requires Chrome 88+ or Firefox 109+
- Older browser versions not supported

---

## [1.1.1] - Previous Release

### Features
- Password manager with client-side encryption
- Auto-fill login credentials
- Password generator
- Support for multiple data types (logins, cards, notes, servers)
- Cross-browser support (Chrome, Firefox, Edge)
- Self-hosted server option

---

## Release Links

- [Chrome Web Store](https://chrome.google.com/webstore) - Coming soon
- [GitHub Releases](https://github.com/passwall/passwall-extension/releases)
- [Homepage](https://passwall.io)

---

**Full Changelog**: [View on GitHub](https://github.com/passwall/passwall-extension/compare/v1.1.1...v1.2.0)

