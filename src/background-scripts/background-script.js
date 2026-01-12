import browser from 'webextension-polyfill'
import { EVENT_TYPES } from '@/utils/constants'
import Storage from '@/utils/storage'
import SessionStorage, { SESSION_KEYS } from '@/utils/session-storage'
import HTTPClient from '@/api/HTTPClient'
import CryptoUtils, { cryptoService, SymmetricKey } from '@/utils/crypto'
import { RequestError, getDomain, getHostName } from '@/utils/helpers'
import { isHostnameBlacklisted, getEquivalentDomains } from '@/utils/platform-rules'
import { ItemType } from '@/stores/items'

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
    this.lastSecretFetchByTab = new Map() // tabId -> timestamp (rate limiting)
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
  }

  /**
   * Restore authentication state from storage
   * Configures HTTP client and crypto utilities if authenticated
   */
  async restoreAuthState() {
    try {
      console.log('[Background] Restoring auth state...')

      const [accessToken, masterHash] = await Promise.all([
        Storage.getItem('access_token'),
        Storage.getItem('master_hash')
      ])

      console.log('[Background] Access token:', accessToken ? 'EXISTS' : 'MISSING')
      console.log('[Background] Master hash:', masterHash ? 'EXISTS' : 'MISSING')

      if (!accessToken) {
        console.warn('[Background] Missing access token, not authenticated')
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

        console.log('[Background] UserKey from session:', userKeyBase64 ? 'EXISTS' : 'MISSING')

        if (userKeyBase64) {
          const userKeyBytes = cryptoService.base64ToArray(userKeyBase64)
          this.userKey = SymmetricKey.fromBytes(userKeyBytes)
          console.log('✅ [Background] Modern encryption keys restored successfully')
        } else {
          console.warn('[Background] UserKey not found in session storage')
        }
      } catch (error) {
        console.warn('[Background] Failed to restore modern keys, using legacy:', error)
      }

      this.isAuthenticated = true
      console.log(
        '✅ [Background] Authentication state restored, isAuthenticated:',
        this.isAuthenticated
      )
      console.log('[Background] UserKey available:', !!this.userKey)
    } catch (error) {
      console.error('[Background] Failed to restore auth state:', error)
      this.isAuthenticated = false
    }
  }

  /**
   * Setup message listeners for popup and content scripts
   * @private
   */
  setupMessageListeners() {
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
      // Content script messages require async responses
      if (request.who === 'content-script') {
        // Wait for initialization to complete before processing message
        this.initPromise
          .then(() => this.handleContentScriptMessage(request, sender))
          .then((data) => sendResponse(data))
          .catch((err) => {
            console.error('Content script message error:', err)
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
            console.error('Popup message error:', err)
          })
        return false
      }

      // Handle token refresh from HTTPClient
      if (request.who === 'api' && request.type === 'TOKEN_REFRESHED') {
        // Token refreshed by API, updating background state
        this.restoreAuthState().catch((err) => {
          console.error('Failed to restore auth after token refresh:', err)
        })
        return false
      }

      // Handle auth errors from HTTPClient
      if (request.who === 'api' && request.type === 'AUTH_ERROR') {
        const reason = request.payload?.reason
        if (reason === 'refresh_failed') {
          console.warn('🔐 Token refresh failed, logging out...')
        } else {
          console.warn('🔐 Auth error from API, logging out...')
        }
        this.handleLogout().catch((err) => {
          console.error('Logout after auth error failed:', err)
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

      case EVENT_TYPES.SAVE_CREDENTIALS:
        return await this.saveCredentials(request.payload)

      case EVENT_TYPES.SET_PENDING_SAVE:
        return await this.setPendingSave(request.payload, sender)

      case EVENT_TYPES.CHECK_PENDING_SAVE:
        return await this.checkPendingSave(request.payload, sender)

      case EVENT_TYPES.CONFIRM_PENDING_SAVE:
        return await this.confirmPendingSave(request.payload, sender)

      case EVENT_TYPES.DISMISS_PENDING_SAVE:
        return await this.dismissPendingSave(sender)

      default:
        return null
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
      console.error('Auth refresh failed:', error)
    }
  }

  /**
   * Handle logout and notify active tab
   * Clears authentication state and crypto keys
   * @private
   */
  async handleLogout() {
    try {
      this.isAuthenticated = false
      this.userKey = null
      CryptoUtils.encryptKey = null
      HTTPClient.setHeader('Authorization', '')
      this.pendingSaveByTab.clear()
      this.lastSecretFetchByTab.clear()

      // Ensure decrypted keys are cleared from extension session storage (defense in depth).
      try {
        await SessionStorage.removeItems([SESSION_KEYS.userKey, SESSION_KEYS.masterKey])
      } catch {
        // ignore (popup store also clears)
      }

      await this.notifyActiveTab(EVENT_TYPES.LOGOUT)
    } catch (error) {
      console.error('Logout notification failed:', error)
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
      console.error(`Failed to notify tab for ${type}:`, error)
    }
  }

  /**
   * Fetch and decrypt logins for a specific domain
   * @param {string} domain - Domain to filter logins by
   * @returns {Promise<Array>} Filtered and decrypted login items
   * @throws {RequestError} If not authenticated or no logins found
   */
  async fetchLoginsByDomain(domain) {
    if (!this.isAuthenticated) {
      throw new RequestError('Please login to Passwall extension to continue', 'NO_AUTH')
    }

    try {
      // Resolve base domain + equivalent domains for filtering (Bitwarden-style).
      const currentDomain = getDomain(`https://${domain}`)
      if (!currentDomain) {
        throw new RequestError(`Invalid domain: ${domain}`, 'VALIDATION_ERROR')
      }
      const isBlacklisted = isHostnameBlacklisted(domain, currentDomain)
      if (isBlacklisted) {
        throw new RequestError(`No passwords found for ${domain}`, 'NO_LOGINS')
      }

      // Use modern /api/items endpoint with server-side filtering by uri_hint.
      const params = new URLSearchParams()
      params.append('type', ItemType.Password)
      params.append('per_page', '10000') // Server clamps; should still be small per-domain.

      const currentEquivalents = getEquivalentDomains(currentDomain)
      const uriHints =
        currentEquivalents && currentEquivalents.size > 0
          ? [...currentEquivalents]
          : [currentDomain]
      if (!uriHints.includes(currentDomain)) {
        uriHints.push(currentDomain)
      }
      uriHints.forEach((hint) => params.append('uri_hint', hint))

      const { data } = await HTTPClient.get(`/api/items?${params}`)
      const items = data.items || data

      // Defense-in-depth: if server-side filtering isn't available yet, apply local uri_hint filtering
      // to avoid showing unrelated items in the popup.
      const allowedHints = uriHints.map((h) => String(h || '').toLowerCase()).filter(Boolean)
      const candidateItems = (items || []).filter((item) => {
        const raw = item?.metadata?.uri_hint
        if (!raw) return false
        const s = String(raw).trim().toLowerCase()
        if (!s) return false

        // Normalize: allow either "domain" or "https://domain/path" legacy shapes.
        let host = s
        try {
          if (host.includes('://')) {
            host = getHostName(host) || host
          } else {
            host = host.split('/')[0].split('?')[0].split('#')[0]
          }
          host = host.split(':')[0] // drop port if any
        } catch {
          // ignore
        }

        // exact domain match OR subdomain match of any allowed hint
        return allowedHints.some((hint) => host === hint || host.endsWith(`.${hint}`))
      })

      // Decrypt only candidate items to produce display candidates (NO password returned)
      const decryptedCandidates = await Promise.all(
        candidateItems.map(async (item) => {
          try {
            // Modern encryption: item has data and metadata
            if (this.userKey && item.data) {
              // Decrypt the data object (contains username, password, url, etc)
              const decryptedDataBytes = await cryptoService.decryptAesCbcHmac(
                item.data,
                this.userKey
              )
              const decryptedDataStr = new TextDecoder().decode(decryptedDataBytes)
              const decryptedData = JSON.parse(decryptedDataStr)

              // Return candidate-only (never return password to content script)
              return {
                id: item.id,
                title: item.metadata?.name || item.title || 'Untitled',
                username: decryptedData.username || '',
                url: item.metadata?.uri_hint || decryptedData.uris?.[0]?.uri || '',
                item_type: item.item_type
              }
            } else if (!this.userKey) {
              // Legacy encryption fallback
              CryptoUtils.decryptFields(item, ['username'])
              return {
                id: item.id,
                title: item.title || 'Untitled',
                username: item.username || '',
                url: item.url || item.URL || '',
                item_type: item.item_type
              }
            }
            return null
          } catch (error) {
            console.error(`[Background] Failed to decrypt item ${item.id}:`, error)
            return null
          }
        })
      )

      const validCandidates = decryptedCandidates.filter(Boolean)

      if (validCandidates.length === 0) {
        throw new RequestError(`No passwords found for ${domain}`, 'NO_LOGINS')
      }

      return validCandidates
    } catch (error) {
      // Re-throw RequestErrors as-is
      if (error instanceof RequestError) {
        throw error
      }

      // Check if it's an authentication error
      const status = error.response?.status
      if (status === 401 || status === 403) {
        console.warn('🔐 Session expired or unauthorized, clearing auth state...')
        this.isAuthenticated = false
        throw new RequestError(
          'Session expired. Please login again to Passwall extension.',
          'AUTH_EXPIRED'
        )
      }

      // Network or other errors
      console.error('Failed to fetch logins:', error)
      const errorMessage = error.message || 'Failed to fetch logins from server'
      throw new RequestError(errorMessage, 'FETCH_ERROR')
    }
  }

  /**
   * Check if login item matches domain (Bitwarden-style domain matching)
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

      // Bitwarden-style blacklist check
      // Even if domains match/equivalent, exclude certain subdomains
      if (isHostnameBlacklisted(currentHostname, currentDomain)) {
        return false
      }

      return true
    } catch (error) {
      console.error('Error matching domain:', error, { item, currentHostname })
      return false
    }
  }

  /**
   * Save or update credentials (modern encryption)
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

    const { username, password, url, domain, action, loginId, title: providedTitle } = payload

    // Validate required fields
    if (!username || !password) {
      throw new RequestError('Username and password are required', 'VALIDATION_ERROR')
    }

    try {
      let result
      const title = providedTitle || domain || getHostName(url) || 'Untitled'
      const uriHint = domain || getHostName(url) || '' // Extract domain only (no paths)

      if (action === 'update' && loginId) {
        // UPDATE: Fetch existing item to preserve metadata
        try {
          const { data: existingItem } = await HTTPClient.get(`/api/items/${loginId}`)

          // Prepare new data object
          const itemData = {
            username,
            password,
            uris: url ? [{ uri: url, match: null }] : []
          }

          // Encrypt data with user key
          const encryptedData = await cryptoService.encryptAesCbcHmac(
            JSON.stringify(itemData),
            this.userKey
          )

          // Update item
          result = await HTTPClient.put(`/api/items/${loginId}`, {
            data: encryptedData,
            metadata: {
              name: existingItem.metadata?.name || title,
              uri_hint: uriHint || existingItem.metadata?.uri_hint
            }
          })
        } catch (fetchError) {
          console.error('Failed to fetch existing item, creating new instead:', fetchError)
          // Fallback to create if fetch fails
          const itemData = {
            username,
            password,
            uris: url ? [{ uri: url, match: null }] : []
          }

          const encryptedData = await cryptoService.encryptAesCbcHmac(
            JSON.stringify(itemData),
            this.userKey
          )

          result = await HTTPClient.post('/api/items', {
            item_type: ItemType.Password,
            data: encryptedData,
            metadata: {
              name: title,
              uri_hint: uriHint
            },
            auto_fill: true,
            auto_login: false
          })
        }
      } else {
        // CREATE new password item
        const itemData = {
          username,
          password,
          uris: url ? [{ uri: url, match: null }] : []
        }

        // Encrypt data with user key
        const encryptedData = await cryptoService.encryptAesCbcHmac(
          JSON.stringify(itemData),
          this.userKey
        )

        result = await HTTPClient.post('/api/items', {
          item_type: ItemType.Password,
          data: encryptedData,
          metadata: {
            name: title,
            uri_hint: uriHint
          },
          auto_fill: true,
          auto_login: false
        })
      }

      return { success: true, data: result.data }
    } catch (error) {
      // Check if it's an authentication error
      const status = error.response?.status
      if (status === 401 || status === 403) {
        console.warn('🔐 Session expired during save, clearing auth state...')
        this.isAuthenticated = false
        throw new RequestError(
          'Session expired. Please login again to Passwall extension.',
          'AUTH_EXPIRED'
        )
      }

      console.error('Failed to save credentials:', error)
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      })

      const errorMessage =
        error.response?.data?.message || error.message || 'Failed to save credentials'
      throw new RequestError(errorMessage, 'SAVE_ERROR')
    }
  }

  /**
   * Fetch and decrypt a single secret for autofill (requires user gesture).
   * Never returns bulk secrets; only one item at a time.
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

    const { data: item } = await HTTPClient.get(`/api/items/${itemId}`)
    if (!item?.data) {
      throw new RequestError('Item data missing', 'NOT_FOUND')
    }

    const decryptedDataBytes = await cryptoService.decryptAesCbcHmac(item.data, this.userKey)
    const decryptedDataStr = new TextDecoder().decode(decryptedDataBytes)
    const decryptedData = JSON.parse(decryptedDataStr)

    return {
      username: decryptedData.username || '',
      password: decryptedData.password || ''
    }
  }

  purgeExpiredPendingSaves() {
    const now = Date.now()
    for (const [tabId, entry] of this.pendingSaveByTab.entries()) {
      if (!entry || entry.expiresAt <= now) {
        this.pendingSaveByTab.delete(tabId)
      }
    }
  }

  async setPendingSave(payload, sender) {
    const tabId = sender?.tab?.id
    if (tabId == null) {
      throw new RequestError('Tab context missing', 'NO_TAB')
    }
    const { username, password, url, domain, title, action, loginId } = payload || {}
    const existing = this.pendingSaveByTab.get(tabId)
    const finalUsername = username || existing?.username
    const finalPassword = password || existing?.password
    if (!finalUsername || !finalPassword) {
      throw new RequestError('Username and password are required', 'VALIDATION_ERROR')
    }

    let resolvedAction = action ?? existing?.action ?? 'add'
    let resolvedLoginId = loginId ?? existing?.loginId ?? null
    let resolvedTitle = title ?? existing?.title ?? ''

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
      url: entry.url || '',
      domain: entry.domain || '',
      title: entry.title || '',
      action: entry.action || 'add',
      loginId: entry.loginId || null
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
      loginId: overrides.loginId || entry.loginId
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
}

// Initialize agent
const agent = new BackgroundAgent()
