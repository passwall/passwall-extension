import browser from 'webextension-polyfill'
import { EVENT_TYPES } from '@/utils/constants'
import Storage from '@/utils/storage'
import SessionStorage, { SESSION_KEYS } from '@/utils/session-storage'
import HTTPClient from '@/api/HTTPClient'
import CryptoUtils, { cryptoService, SymmetricKey } from '@/utils/crypto'
import { unwrapOrgKeyWithUserKey, encryptWithOrgKey, decryptWithOrgKey } from '@/utils/crypto'
import OrganizationsService from '@/api/services/Organizations'
import { RequestError, getDomain, getHostName, toSafeError } from '@/utils/helpers'
import { isHostnameBlacklisted, getEquivalentDomains } from '@/utils/platform-rules'
import { ItemType } from '@/stores/items'

// Build-time injected dev flag (guarded for tests)
const DEV_MODE = typeof __DEV_MODE__ !== 'undefined' ? __DEV_MODE__ : false
const log = {
  info: (...args) => DEV_MODE && console.log('[Background]', ...args),
  warn: (...args) => DEV_MODE && console.warn('[Background]', ...args),
  error: (...args) => console.error('[Background]', ...args)
}
const LOGIN_USAGE_STORAGE_KEY = 'login_usage_v1'

/**
 * Background Script Agent
 * Manages authentication state and orchestrates communication between
 * popup UI, content scripts, and API services
 */
class BackgroundAgent {
  constructor() {
    this.isAuthenticated = false
    this.userKey = null // Modern encryption user key
    this.initPromise = null // Track initialization state
    this.pendingSaveByTab = new Map() // tabId -> { username, password, url, domain, title, action, loginId, expiresAt }
    this.pendingTotpByTab = new Map() // tabId -> { itemId, totpSecret, domain, expiresAt }
    this.lastSecretFetchByTab = new Map() // tabId -> timestamp (rate limiting)
    this.lastSeenUsernameByTab = new Map() // tabId -> { domain, username, expiresAt }
    this.lastLoginUiOpenAt = 0 // Rate-limit opening login UI

    // Organization state
    this.organizations = [] // [{ id, name, encrypted_org_key, ... }]
    this.orgKeyCache = new Map() // orgId -> SymmetricKey (decrypted org keys, never persisted)

    // Cache candidate logins per domain to avoid hammering the API when pages
    // continuously mutate and trigger rescans (some SPAs do this).
    this.loginsByDomainCache = new Map() // domain -> { at: number, data: Array }
    this.loginsByDomainInFlight = new Map() // domain -> Promise<Array>
    this.loginsByDomainCacheTtlMs = 10_000

    // Track form submissions via webRequest API
    this.pendingFormSubmissions = new Map() // requestId -> { tabId, url, method, at }
    this.formSubmissionResults = new Map() // tabId -> { success: boolean, statusCode: number, at: number }

    this.initPromise = this.init()
  }

  /**
   * Initialize background script
   * Sets up message listeners and restores authentication state
   */
  async init() {
    // Best-effort hardening: ensure extension-only access to session storage where supported.
    try {
      await SessionStorage.setAccessLevelTrustedContexts()
    } catch {
      // ignore
    }

    await this.restoreAuthState()

    this.setupMessageListeners()
    this.setupTabListeners()
    this.setupWebRequestListeners()
  }

  /**
   * Restore authentication state from storage
   * Configures HTTP client and crypto utilities if authenticated
   */
  async restoreAuthState() {
    try {
      const [accessToken, masterHash, server] = await Promise.all([
        Storage.getItem('access_token'),
        Storage.getItem('master_hash'),
        Storage.getItem('server')
      ])
      log.info('Restoring auth state', {
        hasAccessToken: !!accessToken,
        hasMasterHash: !!masterHash,
        hasServer: !!server
      })

      // Ensure HTTPClient baseURL is set in background context too.
      // Popup/store sets this, but background/service worker has its own module instance.
      if (server) {
        try {
          HTTPClient.setBaseURL(server)
        } catch (e) {
          // ignore
        }
      }

      if (!accessToken) {
        log.warn('Missing access token, not authenticated')
        this.isAuthenticated = false
        return
      }

      // For modern encryption users, master_hash might not exist
      // They use userKey from session storage instead
      if (masterHash) {
        // Legacy encryption user
        CryptoUtils.encryptKey = masterHash
      }

      HTTPClient.setHeader('Authorization', `Bearer ${accessToken}`)

      // Try to restore modern encryption keys from session storage
      try {
        await SessionStorage.setAccessLevelTrustedContexts()
        const userKeyBase64 = await SessionStorage.getItem(SESSION_KEYS.userKey)
        log.info('UserKey from session', { hasUserKey: !!userKeyBase64 })

        if (userKeyBase64) {
          const userKeyBytes = cryptoService.base64ToArray(userKeyBase64)
          this.userKey = SymmetricKey.fromBytes(userKeyBytes)
          log.info('Modern encryption keys restored successfully')
        } else {
          log.warn('UserKey not found in session storage')
        }
      } catch (error) {
        log.warn('Failed to restore modern keys, using legacy', toSafeError(error))
      }

      this.isAuthenticated = true
      log.info('Authentication state restored', {
        isAuthenticated: this.isAuthenticated,
        hasUserKey: !!this.userKey
      })

      // Fetch organizations in background (non-blocking for auth restore)
      this.fetchOrganizations().catch((err) => {
        log.warn('Failed to fetch organizations during auth restore', toSafeError(err))
      })
    } catch (error) {
      log.error('Failed to restore auth state', toSafeError(error))
      this.isAuthenticated = false
    }
  }

  /**
   * Fetch user's organizations from server and cache them
   */
  async fetchOrganizations() {
    try {
      const { data } = await OrganizationsService.GetAll()
      this.organizations = data || []
      log.info(`Fetched ${this.organizations.length} organizations`)

      // Persist org list to storage for faster restores
      await Storage.setItem('organizations', this.organizations)
    } catch (error) {
      log.warn('Failed to fetch organizations, trying storage fallback', toSafeError(error))
      const stored = await Storage.getItem('organizations')
      if (Array.isArray(stored) && stored.length > 0) {
        this.organizations = stored
      }
    }
  }

  /**
   * Get the default organization ID
   * @returns {number|null}
   */
  getDefaultOrgId() {
    if (this.organizations.length === 0) return null
    const defaultOrg = this.organizations.find((o) => o.is_default)
    return defaultOrg?.id || this.organizations[0]?.id || null
  }

  /**
   * Resolve and cache a decrypted org key
   * @param {number} orgId - Organization ID
   * @returns {Promise<SymmetricKey>}
   */
  async resolveOrgKey(orgId) {
    // Check cache first
    const cached = this.orgKeyCache.get(orgId)
    if (cached) return cached

    if (!this.userKey) {
      throw new Error('User key not available for org key decryption')
    }

    // Ensure organizations are loaded (handles service worker restart race)
    if (this.organizations.length === 0) {
      await this.fetchOrganizations()
    }

    const org = this.organizations.find((o) => o.id === orgId)
    if (!org?.encrypted_org_key) {
      throw new Error(`Organization ${orgId} not found or missing encrypted key`)
    }

    const orgKey = await unwrapOrgKeyWithUserKey(org.encrypted_org_key, this.userKey)
    this.orgKeyCache.set(orgId, orgKey)
    return orgKey
  }

  async getLoginUsageMap() {
    const usage = await Storage.getItem(LOGIN_USAGE_STORAGE_KEY)
    return usage && typeof usage === 'object' ? usage : {}
  }

  async setLoginUsageMap(map) {
    await Storage.setItem(LOGIN_USAGE_STORAGE_KEY, map || {})
  }

  /**
   * Setup message listeners for popup and content scripts
   * @private
   */
  setupMessageListeners() {
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
      // Best-effort: allow content scripts to request opening the extension UI.
      // This is used by in-page notifications (user click) and auth-expired flows.
      if (request?.type === 'OPEN_POPUP') {
        this.initPromise
          .then(() => this.openExtensionUI(request?.payload))
          .then(() => sendResponse({ ok: true }))
          .catch((err) => {
            log.error('OPEN_POPUP error', toSafeError(err))
            sendResponse({ ok: false, error: err?.message || 'OPEN_POPUP failed' })
          })
        return true
      }

      // Content script messages require async responses
      if (request.who === 'content-script') {
        // Wait for initialization to complete before processing message
        this.initPromise
          .then(() => this.handleContentScriptMessage(request, sender))
          .then((data) => sendResponse(data))
          .catch((err) => {
            log.error('Content script message error', toSafeError(err))
            sendResponse({
              error: err.message,
              errorType: err.type || 'UNKNOWN',
              errorName: err.name
            })
          })
        return true // Keep channel open for async response
      }

      // Popup messages are fire-and-forget
      if (request.who === 'popup') {
        this.initPromise
          .then(() => this.handlePopupMessage(request))
          .catch((err) => {
            log.error('Popup message error', toSafeError(err))
          })
        return false
      }

      // Handle token refresh from HTTPClient
      if (request.who === 'api' && request.type === 'TOKEN_REFRESHED') {
        // Token refreshed by API, updating background state
        this.restoreAuthState().catch((err) => {
          log.error('Failed to restore auth after token refresh', toSafeError(err))
        })
        return false
      }

      // Handle auth errors from HTTPClient
      if (request.who === 'api' && request.type === 'AUTH_ERROR') {
        const reason = request.payload?.reason
        if (reason === 'refresh_failed') {
          log.warn('Token refresh failed, locking session (preserving PIN)...')
        } else {
          log.warn('Auth error from API, locking session (preserving PIN)...')
        }
        // Use handleSessionLock instead of handleLogout to preserve PIN data
        // This allows users with PIN to unlock instead of full re-login
        this.handleSessionLock().catch((err) => {
          log.error('Session lock after auth error failed', toSafeError(err))
        })
        return false
      }

      return false
    })
  }

  /**
   * Setup tab update listeners
   * @private
   */
  setupTabListeners() {
    browser.tabs.onUpdated.addListener((tabId, changeInfo, tabInfo) => {
      // Notify content scripts to re-scan for login forms
      browser.tabs
        .sendMessage(tabId, {
          type: EVENT_TYPES.TAB_UPDATE,
          payload: {}
        })
        .catch(() => {}) // Ignore if content script not ready
    })

    // Clean up form submission tracking when tab is closed
    browser.tabs.onRemoved.addListener((tabId) => {
      this.formSubmissionResults.delete(tabId)
      this.pendingSaveByTab.delete(tabId)
      this.pendingTotpByTab.delete(tabId)
      this.lastSecretFetchByTab.delete(tabId)
      this.lastSeenUsernameByTab.delete(tabId)
    })
  }

  /**
   * Setup webRequest listeners for form submission detection
   * Monitors POST/PUT/PATCH requests to detect successful form submissions
   * @private
   */
  setupWebRequestListeners() {
    // Only set up if webRequest API is available (Manifest V2 or V3 with permissions)
    if (!browser.webRequest?.onBeforeRequest) {
      log.info('webRequest API not available, skipping form submission monitoring')
      return
    }

    // Monitor outgoing POST/PUT/PATCH requests (potential form submissions)
    browser.webRequest.onBeforeRequest.addListener(
      (details) => this.handleWebRequestBeforeRequest(details),
      { urls: ['<all_urls>'], types: ['main_frame', 'sub_frame', 'xmlhttprequest'] },
      []
    )

    // Monitor completed requests to check response status
    browser.webRequest.onCompleted.addListener(
      (details) => this.handleWebRequestCompleted(details),
      { urls: ['<all_urls>'], types: ['main_frame', 'sub_frame', 'xmlhttprequest'] }
    )

    // Monitor redirects - login forms commonly reply with 302/303 redirects
    // onCompleted does NOT fire for the original POST when it redirects;
    // instead onBeforeRedirect fires. We treat 3xx redirects as success.
    if (browser.webRequest.onBeforeRedirect) {
      browser.webRequest.onBeforeRedirect.addListener(
        (details) => this.handleWebRequestRedirect(details),
        { urls: ['<all_urls>'], types: ['main_frame', 'sub_frame', 'xmlhttprequest'] }
      )
    }

    // Monitor errored requests
    browser.webRequest.onErrorOccurred.addListener(
      (details) => this.handleWebRequestError(details),
      { urls: ['<all_urls>'], types: ['main_frame', 'sub_frame', 'xmlhttprequest'] }
    )

    log.info('webRequest listeners setup complete')
  }

  /**
   * Handle webRequest before request - track potential form submissions
   * @param {Object} details - Request details
   * @private
   */
  handleWebRequestBeforeRequest(details) {
    const { requestId, tabId, url, method } = details

    // Only track POST/PUT/PATCH requests (form submissions)
    if (!['POST', 'PUT', 'PATCH'].includes(method)) {
      return
    }

    // Ignore requests without a tab (background requests)
    if (tabId < 0) {
      return
    }

    // Track this request
    this.pendingFormSubmissions.set(requestId, {
      tabId,
      url,
      method,
      at: Date.now()
    })

    // Clean up old entries (older than 30 seconds)
    const cutoff = Date.now() - 30000
    for (const [id, entry] of this.pendingFormSubmissions) {
      if (entry.at < cutoff) {
        this.pendingFormSubmissions.delete(id)
      }
    }
  }

  /**
   * Handle webRequest completed - validate response status
   * @param {Object} details - Request details
   * @private
   */
  handleWebRequestCompleted(details) {
    const { requestId, tabId, statusCode, url } = details

    // Check if this was a tracked form submission
    const pendingRequest = this.pendingFormSubmissions.get(requestId)
    if (!pendingRequest) {
      return
    }

    this.pendingFormSubmissions.delete(requestId)

    // 2xx and 3xx are both considered successful for login forms
    // Login flows often return 302/303 redirects to the dashboard page
    const isSuccessful = statusCode >= 200 && statusCode < 400

    // Store the result for this tab
    this.formSubmissionResults.set(tabId, {
      success: isSuccessful,
      statusCode,
      url,
      at: Date.now()
    })

    log.info(
      `Form submission result for tab ${tabId}: ${statusCode} (${
        isSuccessful ? 'success' : 'failed'
      })`
    )

    // If successful, notify content script to potentially show save notification
    if (isSuccessful) {
      browser.tabs
        .sendMessage(tabId, {
          type: 'FORM_SUBMISSION_SUCCESS',
          payload: { statusCode, url }
        })
        .catch(() => {}) // Ignore if content script not ready
    }
  }

  /**
   * Handle webRequest redirect - treat 3xx redirects on tracked POST requests as success.
   * When a POST request returns 302/303, onBeforeRedirect fires instead of onCompleted.
   * Login forms commonly use redirects, so this is a key signal.
   * @param {Object} details - Request details
   * @private
   */
  handleWebRequestRedirect(details) {
    const { requestId, tabId, statusCode, redirectUrl } = details

    // Check if this was a tracked form submission
    const pendingRequest = this.pendingFormSubmissions.get(requestId)
    if (!pendingRequest) {
      return
    }

    // Don't delete from pendingFormSubmissions yet - the redirect chain
    // may have more hops. But DO store a success result immediately.
    // If onCompleted fires later with the same requestId, it will overwrite.

    this.formSubmissionResults.set(tabId, {
      success: true,
      statusCode,
      url: pendingRequest.url,
      redirectUrl,
      at: Date.now()
    })

    log.info(
      `Form submission redirect for tab ${tabId}: ${statusCode} → ${redirectUrl} (treated as success)`
    )

    // Notify content script - the redirect means the form submission was accepted
    browser.tabs
      .sendMessage(tabId, {
        type: 'FORM_SUBMISSION_SUCCESS',
        payload: { statusCode, url: pendingRequest.url, redirectUrl }
      })
      .catch(() => {}) // Ignore if content script not ready (page may be navigating)
  }

  /**
   * Handle webRequest error - mark submission as failed
   * @param {Object} details - Request details
   * @private
   */
  handleWebRequestError(details) {
    const { requestId, tabId, error } = details

    const pendingRequest = this.pendingFormSubmissions.get(requestId)
    if (!pendingRequest) {
      return
    }

    this.pendingFormSubmissions.delete(requestId)

    // Store failure result
    this.formSubmissionResults.set(tabId, {
      success: false,
      statusCode: 0,
      error,
      at: Date.now()
    })

    log.info(`Form submission error for tab ${tabId}: ${error}`)
  }

  /**
   * Check if recent form submission was successful for a tab
   * @param {number} tabId
   * @returns {Object|null} - { success, statusCode, at } or null if no recent submission
   */
  getFormSubmissionResult(tabId) {
    const result = this.formSubmissionResults.get(tabId)
    if (!result) {
      return null
    }

    // Results older than 5 seconds are stale
    if (Date.now() - result.at > 5000) {
      this.formSubmissionResults.delete(tabId)
      return null
    }

    return result
  }

  /**
   * Handle messages from popup UI
   * @param {Object} request - Message request object
   * @returns {Promise<void>}
   * @private
   */
  async handlePopupMessage(request) {
    switch (request.type) {
      case EVENT_TYPES.LOGIN:
      case EVENT_TYPES.REFRESH_TOKENS:
        await this.handleAuthRefresh()
        break

      case EVENT_TYPES.LOGOUT:
        await this.handleLogout()
        break
    }
  }

  /**
   * Handle messages from content scripts
   * @param {Object} request - Message request object
   * @param {Object} sender - webextension sender (includes tab.id)
   * @returns {Promise<any>}
   * @private
   */
  async handleContentScriptMessage(request, sender) {
    switch (request.type) {
      case EVENT_TYPES.REQUEST_PASSWORDS:
        return await this.fetchLoginsByDomain(request.payload)

      case EVENT_TYPES.GET_FILL_SECRET:
        return await this.getFillSecret(request.payload, sender)

      case EVENT_TYPES.GET_AUTOFILL_SECRET:
        return await this.getAutofillSecret(request.payload, sender)

      case EVENT_TYPES.SAVE_CREDENTIALS:
        return await this.saveCredentials(request.payload)

      case EVENT_TYPES.CHECK_PASSWORD_MATCH:
        return await this.checkPasswordMatch(request.payload)

      case EVENT_TYPES.SET_PENDING_SAVE:
        return await this.setPendingSave(request.payload, sender)

      case EVENT_TYPES.CHECK_PENDING_SAVE:
        return await this.checkPendingSave(request.payload, sender)

      case EVENT_TYPES.CONFIRM_PENDING_SAVE:
        return await this.confirmPendingSave(request.payload, sender)

      case EVENT_TYPES.DISMISS_PENDING_SAVE:
        return await this.dismissPendingSave(sender)

      case EVENT_TYPES.SET_LAST_SEEN_USERNAME:
        return await this.setLastSeenUsername(request.payload, sender)

      case EVENT_TYPES.GET_LAST_SEEN_USERNAME:
        return await this.getLastSeenUsername(request.payload, sender)

      case EVENT_TYPES.UPDATE_LOGIN_USAGE:
        return await this.updateLoginUsage(request.payload, sender)

      case EVENT_TYPES.SET_PENDING_TOTP:
        return await this.setPendingTotp(request.payload, sender)

      case EVENT_TYPES.GET_PENDING_TOTP:
        return await this.getPendingTotp(request.payload, sender)

      case EVENT_TYPES.CLEAR_PENDING_TOTP:
        return await this.clearPendingTotp(sender)

      // Get form submission result for validation
      case EVENT_TYPES.GET_FORM_SUBMISSION_RESULT:
        return this.getFormSubmissionResult(sender?.tab?.id)

      // Legacy/custom message type used by content scripts to open the popup UI
      // (e.g. "Authentication Required" in-page notification).
      case 'OPEN_POPUP':
        return { ok: await this.openExtensionUI() }

      default:
        return null
    }
  }

  /**
   * Best-effort: open the extension action popup.
   *
   * Important: We intentionally do NOT open a new tab to the extension URL.
   * Opening `chrome-extension://.../src/popup/index.html#/login` in a normal tab
   * is a poor UX and was causing full-page redirects.
   */
  async openExtensionUI() {
    const now = Date.now()
    // Avoid spamming openPopup attempts.
    if (now - (this.lastLoginUiOpenAt || 0) < 30_000) {
      return false
    }
    this.lastLoginUiOpenAt = now

    try {
      if (browser.action?.openPopup) {
        await browser.action.openPopup()
        return true
      }
      return false
    } catch {
      return false
    }
  }

  /**
   * Refresh authentication state and notify active tab
   * Called after user logs in or token is refreshed
   * @private
   */
  async handleAuthRefresh() {
    try {
      await this.restoreAuthState()
      await this.notifyActiveTab(EVENT_TYPES.REFRESH_TOKENS)
    } catch (error) {
      log.error('Auth refresh failed', toSafeError(error))
    }
  }

  /**
   * Handle session lock (token expired but preserve PIN data)
   * Clears session keys but preserves PIN data for unlock capability
   * @private
   */
  async handleSessionLock() {
    try {
      this.isAuthenticated = false
      this.userKey = null
      CryptoUtils.encryptKey = null
      HTTPClient.setHeader('Authorization', '')
      this.pendingSaveByTab.clear()
      this.pendingTotpByTab.clear()
      this.lastSecretFetchByTab.clear()
      this.lastSeenUsernameByTab.clear()
      this.loginsByDomainCache.clear()
      this.loginsByDomainInFlight.clear()
      this.orgKeyCache.clear()
      this.organizations = []

      // Clear session keys but preserve PIN data in storage
      try {
        await SessionStorage.removeItems([SESSION_KEYS.userKey, SESSION_KEYS.masterKey])
      } catch {
        // ignore
      }

      log.info('Session locked, PIN data preserved for unlock')
    } catch (error) {
      log.error('Session lock failed', toSafeError(error))
    }
  }

  /**
   * Handle logout and notify active tab
   * Clears ALL authentication state including PIN data (full logout)
   * @private
   */
  async handleLogout() {
    try {
      this.isAuthenticated = false
      this.userKey = null
      CryptoUtils.encryptKey = null
      HTTPClient.setHeader('Authorization', '')
      this.pendingSaveByTab.clear()
      this.pendingTotpByTab.clear()
      this.lastSecretFetchByTab.clear()
      this.lastSeenUsernameByTab.clear()
      this.loginsByDomainCache.clear()
      this.loginsByDomainInFlight.clear()
      this.orgKeyCache.clear()
      this.organizations = []

      // Ensure decrypted keys are cleared from extension session storage (defense in depth).
      try {
        await SessionStorage.removeItems([SESSION_KEYS.userKey, SESSION_KEYS.masterKey])
      } catch {
        // ignore (popup store also clears)
      }

      await this.notifyActiveTab(EVENT_TYPES.LOGOUT)
    } catch (error) {
      log.error('Logout notification failed', toSafeError(error))
    }
  }

  /**
   * Send message to active tab's content script
   * @param {string} type - Event type
   * @param {Object} payload - Optional payload
   * @private
   */
  async notifyActiveTab(type, payload = {}) {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true })
      if (tabs[0]) {
        await browser.tabs.sendMessage(tabs[0].id, { type, payload }).catch(() => {}) // Ignore if content script not ready
      }
    } catch (error) {
      log.error(`Failed to notify tab for ${type}`, toSafeError(error))
    }
  }

  /**
   * Fetch and decrypt logins for a specific domain from ALL organizations
   * @param {string} domain - Domain to filter logins by
   * @returns {Promise<Array>} Filtered and decrypted login items
   * @throws {RequestError} If not authenticated or no logins found
   */
  async fetchLoginsByDomain(domain) {
    if (!this.isAuthenticated) {
      throw new RequestError('Please login to Passwall extension to continue', 'NO_AUTH')
    }

    try {
      // Resolve base domain + equivalent domains for filtering.
      const currentDomain = getDomain(`https://${domain}`)
      if (!currentDomain) {
        throw new RequestError(`Invalid domain: ${domain}`, 'VALIDATION_ERROR')
      }
      const isBlacklisted = isHostnameBlacklisted(domain, currentDomain)
      if (isBlacklisted) {
        throw new RequestError(`No passwords found for ${domain}`, 'NO_LOGINS')
      }

      // Fast path: cached result (prevents repeated API calls on DOM churn)
      const cacheKey = String(currentDomain).toLowerCase()
      const cached = this.loginsByDomainCache.get(cacheKey)
      if (cached && Date.now() - cached.at < this.loginsByDomainCacheTtlMs) {
        return cached.data || []
      }
      const inFlight = this.loginsByDomainInFlight.get(cacheKey)
      if (inFlight) {
        return await inFlight
      }

      // Fetch from ALL organizations in parallel
      const promise = (async () => {
        // Ensure orgs are loaded
        if (this.organizations.length === 0) {
          await this.fetchOrganizations()
        }
        if (this.organizations.length === 0) {
          throw new RequestError('No organizations found', 'NO_ORGS')
        }

        const currentEquivalents = getEquivalentDomains(currentDomain)
        const uriHints =
          currentEquivalents && currentEquivalents.size > 0
            ? [...currentEquivalents]
            : [currentDomain]
        if (!uriHints.includes(currentDomain)) {
          uriHints.push(currentDomain)
        }

        // Query each org's items in parallel
        const orgResults = await Promise.allSettled(
          this.organizations.map(async (org) => {
            const { data } = await OrganizationsService.ListItems(org.id, {
              type: ItemType.Password,
              per_page: 5000,
              uri_hints: uriHints
            })
            const items = data.items || data || []
            return { orgId: org.id, orgName: org.name, items }
          })
        )

        // Flatten items from all orgs, noting which org they belong to
        const allItems = []
        for (const result of orgResults) {
          if (result.status === 'fulfilled') {
            for (const item of result.value.items) {
              allItems.push({ ...item, _orgId: result.value.orgId, _orgName: result.value.orgName })
            }
          }
        }

        // Defense-in-depth: local uri_hint filtering
        const allowedHints = uriHints.map((h) => String(h || '').toLowerCase()).filter(Boolean)
        const candidateItems = allItems.filter((item) => {
          const raw = item?.metadata?.uri_hint
          if (!raw) return false
          const s = String(raw).trim().toLowerCase()
          if (!s) return false

          let host = s
          try {
            if (host.includes('://')) {
              host = getHostName(host) || host
            } else {
              host = host.split('/')[0].split('?')[0].split('#')[0]
            }
            host = host.split(':')[0]
          } catch {
            // ignore
          }

          return allowedHints.some((hint) => host === hint || host.endsWith(`.${hint}`))
        })

        const usageMap = await this.getLoginUsageMap()

        // Decrypt candidate items using org keys
        const decryptedCandidates = await Promise.all(
          candidateItems.map(async (item) => {
            try {
              if (!this.userKey || !item.data) return null

              const orgKey = await this.resolveOrgKey(item._orgId)
              const decryptedData = await decryptWithOrgKey(item.data, orgKey)

              const usageEntry = usageMap?.[item.id] || {}
              const autoFill = typeof item.auto_fill === 'boolean' ? item.auto_fill : true
              const autoLogin = typeof item.auto_login === 'boolean' ? item.auto_login : false

              return {
                id: item.id,
                title: item.metadata?.name || item.title || 'Untitled',
                username: decryptedData.username || '',
                url: decryptedData.uris?.[0]?.uri || item.metadata?.uri_hint || '',
                item_type: item.item_type,
                auto_fill: autoFill,
                auto_login: autoLogin,
                _orgId: item._orgId,
                _orgName: item._orgName,
                last_used_at:
                  typeof usageEntry?.lastUsedAt === 'number' ? usageEntry.lastUsedAt : null,
                last_launched_at:
                  typeof usageEntry?.lastLaunchedAt === 'number' ? usageEntry.lastLaunchedAt : null
              }
            } catch (error) {
              log.error(`Failed to decrypt item ${item.id}`, toSafeError(error))
              return null
            }
          })
        )

        const validCandidates = decryptedCandidates.filter(Boolean)

        if (validCandidates.length === 0) {
          throw new RequestError(`No passwords found for ${domain}`, 'NO_LOGINS')
        }

        this.loginsByDomainCache.set(cacheKey, { at: Date.now(), data: validCandidates })
        return validCandidates
      })()

      this.loginsByDomainInFlight.set(cacheKey, promise)
      try {
        return await promise
      } finally {
        this.loginsByDomainInFlight.delete(cacheKey)
      }
    } catch (error) {
      // Re-throw RequestErrors as-is
      if (error instanceof RequestError) {
        throw error
      }

      // Check if it's an authentication error
      const status = error.response?.status
      if (status === 401 || status === 403) {
        log.warn('Session expired or unauthorized, clearing auth state...')
        this.isAuthenticated = false
        throw new RequestError(
          'Session expired. Please login again to Passwall extension.',
          'AUTH_EXPIRED'
        )
      }

      // Network or other errors
      log.error('Failed to fetch logins', toSafeError(error))
      const errorMessage = error.message || 'Failed to fetch logins from server'
      throw new RequestError(errorMessage, 'FETCH_ERROR')
    }
  }

  /**
   * Check if login item matches domain (smart domain matching)
   * Supports: base domain matching, equivalent domains, blacklist exclusions
   *
   * Examples:
   *   Current: signin.aws.amazon.com → amazon.com
   *   Saved: www.amazon.com → amazon.com
   *   Result: ✅ MATCH!
   *
   *   Current: youtube.com → google.com (equivalent!)
   *   Saved: www.google.com → google.com
   *   Result: ✅ MATCH! (equivalent domains)
   *
   *   Current: script.google.com → google.com (blacklisted!)
   *   Saved: www.google.com → google.com
   *   Result: ❌ NO MATCH (blacklisted subdomain)
   *
   * @param {Object} item - Login item with URL field
   * @param {string} currentHostname - Current page hostname (e.g., signin.aws.amazon.com)
   * @returns {boolean}
   * @private
   */
  loginMatchesDomain(item, currentHostname) {
    try {
      // Extract base domain from current URL
      const currentDomain = getDomain(`https://${currentHostname}`)
      if (!currentDomain) {
        return false
      }

      // Extract base domain from saved login URL
      const savedUrl = item.url || item.URL || ''
      const savedDomain = getDomain(savedUrl)
      if (!savedDomain) {
        return false
      }

      // Get equivalent domains for both current and saved domains
      const currentEquivalents = getEquivalentDomains(currentDomain)
      const savedEquivalents = getEquivalentDomains(savedDomain)

      // Check if domains are in the same equivalent group
      // Example: youtube.com and google.com are equivalent
      const hasEquivalentMatch = [...currentEquivalents].some((domain) =>
        savedEquivalents.has(domain)
      )

      if (!hasEquivalentMatch) {
        // Not equivalent and not exact match
        return false
      }

      // Domain blacklist check
      // Even if domains match/equivalent, exclude certain subdomains
      if (isHostnameBlacklisted(currentHostname, currentDomain)) {
        return false
      }

      return true
    } catch (error) {
      log.error('Error matching domain', toSafeError(error))
      return false
    }
  }

  /**
   * Save or update credentials (organization-based encryption)
   * @param {Object} payload - Credentials to save
   * @param {string} payload.username - Username
   * @param {string} payload.password - Password
   * @param {string} payload.url - URL
   * @param {string} payload.domain - Domain
   * @param {string} payload.action - 'add' or 'update'
   * @param {string} payload.loginId - Login ID (for update)
   * @returns {Promise<Object>}
   * @private
   */
  async saveCredentials(payload) {
    if (!this.isAuthenticated) {
      throw new RequestError('Please login to Passwall extension to continue', 'NO_AUTH')
    }

    if (!this.userKey) {
      throw new RequestError('User key not found. Please login again.', 'NO_USER_KEY')
    }

    const {
      username,
      password,
      url,
      domain,
      action,
      loginId,
      title: providedTitle,
      folder_id,
      auto_fill,
      auto_login,
      reprompt
    } = payload

    // Validate required fields
    if (!username || !password) {
      throw new RequestError('Username and password are required', 'VALIDATION_ERROR')
    }

    try {
      let result
      const title = providedTitle || domain || getHostName(url) || 'Untitled'
      const uriHint = domain || getHostName(url) || ''

      // Invalidate domain cache so next request sees the new/updated credential.
      try {
        if (this.loginsByDomainCache?.clear) this.loginsByDomainCache.clear()
        if (this.loginsByDomainInFlight?.clear) this.loginsByDomainInFlight.clear()
      } catch {
        // ignore
      }

      // Ensure orgs are loaded
      if (this.organizations.length === 0) {
        await this.fetchOrganizations()
      }

      const targetOrgId = this.getDefaultOrgId()
      if (!targetOrgId) {
        throw new RequestError('No organization available', 'NO_ORG')
      }

      const orgKey = await this.resolveOrgKey(targetOrgId)

      if (action === 'update' && loginId) {
        // UPDATE: Fetch existing item to preserve metadata
        try {
          const { data: existingItem } = await OrganizationsService.GetItem(loginId)

          const itemData = {
            username,
            password,
            uris: url ? [{ uri: url, match: null }] : []
          }

          const encryptedData = await encryptWithOrgKey(JSON.stringify(itemData), orgKey)

          const resolvedAutoFill =
            typeof auto_fill === 'boolean' ? auto_fill : (existingItem.auto_fill ?? true)
          const resolvedAutoLogin =
            typeof auto_login === 'boolean' ? auto_login : (existingItem.auto_login ?? false)
          const resolvedReprompt =
            typeof reprompt === 'boolean' ? reprompt : (existingItem.reprompt ?? false)
          const resolvedFolderId =
            folder_id !== undefined ? folder_id : (existingItem.folder_id ?? null)

          result = await OrganizationsService.UpdateItem(loginId, {
            data: encryptedData,
            metadata: {
              name: existingItem.metadata?.name || title,
              uri_hint: uriHint || existingItem.metadata?.uri_hint
            },
            folder_id: resolvedFolderId,
            auto_fill: resolvedAutoFill,
            auto_login: resolvedAutoLogin,
            reprompt: resolvedReprompt
          })
        } catch (fetchError) {
          log.warn('Failed to fetch existing item, creating new instead', toSafeError(fetchError))

          const itemData = {
            username,
            password,
            uris: url ? [{ uri: url, match: null }] : []
          }

          const encryptedData = await encryptWithOrgKey(JSON.stringify(itemData), orgKey)

          result = await OrganizationsService.CreateItem(targetOrgId, {
            item_type: ItemType.Password,
            data: encryptedData,
            metadata: {
              name: title,
              uri_hint: uriHint
            },
            folder_id: folder_id ?? null,
            auto_fill: typeof auto_fill === 'boolean' ? auto_fill : true,
            auto_login: typeof auto_login === 'boolean' ? auto_login : false,
            reprompt: typeof reprompt === 'boolean' ? reprompt : false
          })
        }
      } else {
        // CREATE new password item in default organization
        const itemData = {
          username,
          password,
          uris: url ? [{ uri: url, match: null }] : []
        }

        const encryptedData = await encryptWithOrgKey(JSON.stringify(itemData), orgKey)

        result = await OrganizationsService.CreateItem(targetOrgId, {
          item_type: ItemType.Password,
          data: encryptedData,
          metadata: {
            name: title,
            uri_hint: uriHint
          },
          folder_id: folder_id ?? null,
          auto_fill: typeof auto_fill === 'boolean' ? auto_fill : true,
          auto_login: typeof auto_login === 'boolean' ? auto_login : false,
          reprompt: typeof reprompt === 'boolean' ? reprompt : false
        })
      }

      return { success: true, data: result.data }
    } catch (error) {
      // Check if it's an authentication error
      const status = error.response?.status
      if (status === 401 || status === 403) {
        log.warn('Session expired during save, clearing auth state...')
        this.isAuthenticated = false
        throw new RequestError(
          'Session expired. Please login again to Passwall extension.',
          'AUTH_EXPIRED'
        )
      }

      // IMPORTANT: avoid logging raw error objects (may contain Authorization header)
      log.error('Failed to save credentials', toSafeError(error))

      const errorMessage =
        error.response?.data?.message || error.message || 'Failed to save credentials'
      throw new RequestError(errorMessage, 'SAVE_ERROR')
    }
  }

  /**
   * Fetch and decrypt a single secret for autofill (requires user gesture).
   * Never returns bulk secrets; only one item at a time.
   * Uses org-based decryption via org key.
   * @private
   */
  async getFillSecret(payload, sender) {
    if (!this.isAuthenticated) {
      throw new RequestError('Please login to Passwall extension to continue', 'NO_AUTH')
    }
    if (!this.userKey) {
      throw new RequestError('User key not found. Please login again.', 'NO_USER_KEY')
    }

    const tabId = sender?.tab?.id
    if (tabId == null) {
      throw new RequestError('Tab context missing', 'NO_TAB')
    }

    const itemId = payload?.itemId
    if (!itemId) {
      throw new RequestError('Item id is required', 'VALIDATION_ERROR')
    }

    // Basic user-gesture gating + rate limit
    if (payload?.userGesture !== true) {
      throw new RequestError('User gesture required', 'USER_GESTURE_REQUIRED')
    }

    const now = Date.now()
    const last = this.lastSecretFetchByTab.get(tabId) || 0
    if (now - last < 300) {
      throw new RequestError('Too many requests', 'RATE_LIMITED')
    }
    this.lastSecretFetchByTab.set(tabId, now)

    const { data: item } = await OrganizationsService.GetItem(itemId)
    if (!item?.data) {
      throw new RequestError('Item data missing', 'NOT_FOUND')
    }

    const orgId = item.organization_id || payload?._orgId
    if (!orgId) {
      throw new RequestError('Organization ID missing for item', 'NO_ORG')
    }

    const orgKey = await this.resolveOrgKey(orgId)
    const decryptedData = await decryptWithOrgKey(item.data, orgKey)

    return {
      username: decryptedData.username || '',
      password: decryptedData.password || '',
      totp_secret: decryptedData.totp_secret || ''
    }
  }

  isItemAllowedForDomain(item, domain) {
    const host = String(domain || '').trim()
    if (!host) {
      return false
    }

    const currentDomain = getDomain(`https://${host}`)
    if (!currentDomain) {
      return false
    }

    const rawHint = item?.metadata?.uri_hint || ''
    const hintUrl = rawHint.includes('://') ? rawHint : `https://${rawHint}`
    const savedDomain = getDomain(hintUrl)
    if (!savedDomain) {
      return false
    }

    const currentEquivalents = getEquivalentDomains(currentDomain)
    const savedEquivalents = getEquivalentDomains(savedDomain)
    const hasEquivalentMatch = [...currentEquivalents].some((d) => savedEquivalents.has(d))
    if (!hasEquivalentMatch) {
      return false
    }

    if (isHostnameBlacklisted(host, currentDomain)) {
      return false
    }

    return true
  }

  async getAutofillSecret(payload, sender) {
    if (!this.isAuthenticated) {
      throw new RequestError('Please login to Passwall extension to continue', 'NO_AUTH')
    }
    if (!this.userKey) {
      throw new RequestError('User key not found. Please login again.', 'NO_USER_KEY')
    }

    const tabId = sender?.tab?.id
    if (tabId == null) {
      throw new RequestError('Tab context missing', 'NO_TAB')
    }

    const itemId = payload?.itemId
    const domain = payload?.domain
    if (!itemId || !domain) {
      throw new RequestError('Item id and domain are required', 'VALIDATION_ERROR')
    }

    const now = Date.now()
    const last = this.lastSecretFetchByTab.get(tabId) || 0
    if (now - last < 300) {
      throw new RequestError('Too many requests', 'RATE_LIMITED')
    }
    this.lastSecretFetchByTab.set(tabId, now)

    const { data: item } = await OrganizationsService.GetItem(itemId)
    if (!item?.data) {
      throw new RequestError('Item data missing', 'NOT_FOUND')
    }

    const autoFill = typeof item.auto_fill === 'boolean' ? item.auto_fill : true
    if (!autoFill) {
      throw new RequestError('Autofill disabled for this item', 'AUTOFILL_DISABLED')
    }

    if (!this.isItemAllowedForDomain(item, domain)) {
      throw new RequestError('Item does not match domain', 'DOMAIN_MISMATCH')
    }

    const orgId = item.organization_id || payload?._orgId
    if (!orgId) {
      throw new RequestError('Organization ID missing for item', 'NO_ORG')
    }

    const orgKey = await this.resolveOrgKey(orgId)
    const decryptedData = await decryptWithOrgKey(item.data, orgKey)

    return {
      username: decryptedData.username || '',
      password: decryptedData.password || ''
    }
  }

  async updateLoginUsage(payload) {
    const itemId = payload?.itemId
    if (!itemId) {
      return { ok: false }
    }

    const usageMap = await this.getLoginUsageMap()
    const key = String(itemId)
    const entry = usageMap[key] || {}
    const now = Date.now()
    const action = payload?.action

    if (action === 'launch') {
      entry.lastLaunchedAt = now
    } else {
      entry.lastUsedAt = now
    }

    if (payload?.domain) {
      entry.domain = payload.domain
    }

    usageMap[key] = entry
    await this.setLoginUsageMap(usageMap)

    return { ok: true }
  }

  purgeExpiredPendingSaves() {
    const now = Date.now()
    for (const [tabId, entry] of this.pendingSaveByTab.entries()) {
      if (!entry || entry.expiresAt <= now) {
        this.pendingSaveByTab.delete(tabId)
      }
    }
  }

  purgeExpiredLastSeenUsernames() {
    const now = Date.now()
    for (const [tabId, entry] of this.lastSeenUsernameByTab.entries()) {
      if (!entry || entry.expiresAt <= now) {
        this.lastSeenUsernameByTab.delete(tabId)
      }
    }
  }

  /**
   * Check if a submitted password matches the stored password for an item.
   * Returns { match: boolean } — never exposes the stored password.
   * @param {Object} payload - { itemId, password, _orgId? }
   * @returns {Promise<{match: boolean}>}
   */
  async checkPasswordMatch(payload) {
    if (!this.isAuthenticated || !this.userKey) {
      return { match: false }
    }

    const { itemId, password, _orgId } = payload || {}
    if (!itemId || !password) {
      return { match: false }
    }

    try {
      const { data: item } = await OrganizationsService.GetItem(itemId)
      if (!item?.data) {
        log.warn('checkPasswordMatch: item has no encrypted data, itemId=', itemId)
        return { match: false }
      }

      const orgId = item.organization_id || _orgId
      if (!orgId) {
        log.warn('checkPasswordMatch: no orgId for itemId=', itemId)
        return { match: false }
      }

      const orgKey = await this.resolveOrgKey(orgId)
      const decryptedData = await decryptWithOrgKey(item.data, orgKey)

      const storedPassword = decryptedData.password || ''
      const match = storedPassword === password
      if (!match) {
        log.info('checkPasswordMatch: password differs (stored length:', storedPassword.length, ', submitted length:', password.length, ')')
      }
      return { match }
    } catch (error) {
      log.error('checkPasswordMatch failed (will return match:false):', toSafeError(error))
      return { match: false }
    }
  }

  async setPendingSave(payload, sender) {
    const tabId = sender?.tab?.id
    if (tabId == null) {
      throw new RequestError('Tab context missing', 'NO_TAB')
    }
    const {
      username,
      password,
      url,
      domain,
      title,
      action,
      loginId,
      folder_id,
      auto_fill,
      auto_login,
      reprompt,
      manual
    } = payload || {}
    const existing = this.pendingSaveByTab.get(tabId)
    const finalUsername = username || existing?.username
    const finalPassword = password || existing?.password
    if (!finalUsername || !finalPassword) {
      if (!manual) {
        throw new RequestError('Username and password are required', 'VALIDATION_ERROR')
      }
    }

    let resolvedAction = action ?? existing?.action ?? 'add'
    let resolvedLoginId = loginId ?? existing?.loginId ?? null
    let resolvedTitle = title ?? existing?.title ?? ''
    const resolvedFolderId = folder_id !== undefined ? folder_id : (existing?.folder_id ?? null)
    const resolvedAutoFill =
      typeof auto_fill === 'boolean'
        ? auto_fill
        : typeof existing?.auto_fill === 'boolean'
          ? existing.auto_fill
          : true
    const resolvedAutoLogin =
      typeof auto_login === 'boolean'
        ? auto_login
        : typeof existing?.auto_login === 'boolean'
          ? existing.auto_login
          : false
    const resolvedReprompt =
      typeof reprompt === 'boolean'
        ? reprompt
        : typeof existing?.reprompt === 'boolean'
          ? existing.reprompt
          : false

    // If action is "add", try to resolve to "update" based on existing candidates for domain.
    if (resolvedAction === 'add' && domain && finalUsername) {
      try {
        const candidates = await this.fetchLoginsByDomain(domain)
        const norm = String(finalUsername).trim().toLowerCase()
        const match = candidates.find(
          (c) =>
            String(c.username || '')
              .trim()
              .toLowerCase() === norm
        )
        if (match?.id) {
          resolvedAction = 'update'
          resolvedLoginId = match.id
          resolvedTitle = match.title || resolvedTitle
        }
      } catch (e) {
        // If no candidates / auth issues, keep as add.
      }
    }

    this.purgeExpiredPendingSaves()
    this.pendingSaveByTab.set(tabId, {
      username: finalUsername,
      password: finalPassword,
      url: url ?? existing?.url ?? '',
      domain: domain ?? existing?.domain ?? '',
      title: resolvedTitle,
      action: resolvedAction,
      loginId: resolvedLoginId,
      folder_id: resolvedFolderId,
      auto_fill: resolvedAutoFill,
      auto_login: resolvedAutoLogin,
      reprompt: resolvedReprompt,
      expiresAt: Date.now() + 60_000
    })

    return { pending: true }
  }

  async checkPendingSave(_payload, sender) {
    const tabId = sender?.tab?.id
    if (tabId == null) {
      return { pending: false }
    }

    this.purgeExpiredPendingSaves()
    const entry = this.pendingSaveByTab.get(tabId)
    if (!entry) {
      return { pending: false }
    }

    return {
      pending: true,
      username: entry.username || '',
      password: entry.password || '',
      url: entry.url || '',
      domain: entry.domain || '',
      title: entry.title || '',
      action: entry.action || 'add',
      loginId: entry.loginId || null,
      folder_id: entry.folder_id ?? null,
      auto_fill: typeof entry.auto_fill === 'boolean' ? entry.auto_fill : true,
      auto_login: typeof entry.auto_login === 'boolean' ? entry.auto_login : false,
      reprompt: typeof entry.reprompt === 'boolean' ? entry.reprompt : false
    }
  }

  async confirmPendingSave(payload, sender) {
    const tabId = sender?.tab?.id
    if (tabId == null) {
      throw new RequestError('Tab context missing', 'NO_TAB')
    }

    this.purgeExpiredPendingSaves()
    const entry = this.pendingSaveByTab.get(tabId)
    if (!entry) {
      throw new RequestError('No pending save', 'NO_PENDING_SAVE')
    }

    // Allow safe overrides from UI (password override only if explicitly provided)
    const overrides = payload || {}
    const finalPayload = {
      username: overrides.username || entry.username,
      password: overrides.password ? overrides.password : entry.password,
      url: overrides.url || entry.url,
      domain: overrides.domain || entry.domain,
      title: overrides.title || entry.title,
      action: overrides.action || entry.action,
      loginId: overrides.loginId || entry.loginId,
      folder_id:
        overrides.folder_id !== undefined ? overrides.folder_id : (entry.folder_id ?? null),
      auto_fill:
        typeof overrides.auto_fill === 'boolean'
          ? overrides.auto_fill
          : typeof entry.auto_fill === 'boolean'
            ? entry.auto_fill
            : true,
      auto_login:
        typeof overrides.auto_login === 'boolean'
          ? overrides.auto_login
          : typeof entry.auto_login === 'boolean'
            ? entry.auto_login
            : false,
      reprompt:
        typeof overrides.reprompt === 'boolean'
          ? overrides.reprompt
          : typeof entry.reprompt === 'boolean'
            ? entry.reprompt
            : false
    }

    const result = await this.saveCredentials(finalPayload)
    this.pendingSaveByTab.delete(tabId)
    return result
  }

  async dismissPendingSave(sender) {
    const tabId = sender?.tab?.id
    if (tabId != null) {
      this.pendingSaveByTab.delete(tabId)
    }
    return { pending: false }
  }

  async setPendingTotp(payload, sender) {
    const tabId = sender?.tab?.id
    if (tabId == null) {
      throw new RequestError('Tab context missing', 'NO_TAB')
    }

    const totpSecret = payload?.totp_secret || payload?.totpSecret || payload?.totp || ''
    const itemId = payload?.itemId || null
    const domain = payload?.domain || ''
    if (!totpSecret || !itemId) {
      return { ok: false }
    }

    this.pendingTotpByTab.set(tabId, {
      itemId,
      totpSecret,
      domain,
      expiresAt: Date.now() + 5 * 60_000
    })

    return { ok: true }
  }

  async getPendingTotp(payload, sender) {
    const tabId = sender?.tab?.id
    if (tabId == null) {
      return null
    }

    const entry = this.pendingTotpByTab.get(tabId)
    if (!entry) {
      return null
    }

    const now = Date.now()
    if (entry.expiresAt <= now) {
      this.pendingTotpByTab.delete(tabId)
      return null
    }

    const requestedDomain = payload?.domain || ''
    if (requestedDomain && entry.domain && requestedDomain !== entry.domain) {
      this.pendingTotpByTab.delete(tabId)
      return null
    }

    return {
      itemId: entry.itemId,
      totp_secret: entry.totpSecret
    }
  }

  async clearPendingTotp(sender) {
    const tabId = sender?.tab?.id
    if (tabId != null) {
      this.pendingTotpByTab.delete(tabId)
    }
    return { ok: true }
  }

  async setLastSeenUsername(payload, sender) {
    const tabId = sender?.tab?.id
    if (tabId == null) {
      return { ok: false }
    }

    const { domain, username } = payload || {}
    const normalized = String(username || '').trim()
    if (!domain || !normalized) {
      return { ok: false }
    }

    this.purgeExpiredLastSeenUsernames()
    this.lastSeenUsernameByTab.set(tabId, {
      domain,
      username: normalized,
      expiresAt: Date.now() + 5 * 60_000
    })

    return { ok: true }
  }

  async getLastSeenUsername(payload, sender) {
    const tabId = sender?.tab?.id
    if (tabId == null) {
      return { username: '' }
    }

    const domain = payload?.domain
    this.purgeExpiredLastSeenUsernames()
    const entry = this.lastSeenUsernameByTab.get(tabId)
    if (!entry || !domain || entry.domain !== domain) {
      return { username: '' }
    }

    return { username: entry.username || '' }
  }
}

// Initialize agent
const agent = new BackgroundAgent()
