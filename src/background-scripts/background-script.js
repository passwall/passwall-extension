import browser from 'webextension-polyfill'
import { EVENT_TYPES } from '@/utils/constants'
import PasswordsService from '@/api/services/Passwords'
import Storage from '@/utils/storage'
import HTTPClient from '@/api/HTTPClient'
import CryptoUtils from '@/utils/crypto'
import { RequestError, getDomain, getHostName } from '@/utils/helpers'
import { isHostnameBlacklisted, getEquivalentDomains } from '@/utils/platform-rules'

const ENCRYPTED_FIELDS = ['username', 'password', 'extra']

/**
 * Background Script Agent
 * Manages authentication state and orchestrates communication between
 * popup UI, content scripts, and API services
 */
class BackgroundAgent {
  constructor() {
    this.isAuthenticated = false
    this.init()
  }

  /**
   * Initialize background script
   * Sets up message listeners and restores authentication state
   */
  async init() {
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
      const [accessToken, masterHash] = await Promise.all([
        Storage.getItem('access_token'),
        Storage.getItem('master_hash')
      ])
      
      if (!accessToken || !masterHash) {
        this.isAuthenticated = false
        return
      }
      
      HTTPClient.setHeader('Authorization', `Bearer ${accessToken}`)
      CryptoUtils.encryptKey = masterHash
      this.isAuthenticated = true
    } catch (error) {
      console.error('Failed to restore auth state:', error)
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
        this.handleContentScriptMessage(request)
          .then(data => sendResponse(data))
          .catch(err => {
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
        this.handlePopupMessage(request).catch(err => {
          console.error('Popup message error:', err)
        })
        return false
      }
      
      // Handle token refresh from HTTPClient
      if (request.who === 'api' && request.type === 'TOKEN_REFRESHED') {
        // Token refreshed by API, updating background state
        this.restoreAuthState().catch(err => {
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
        this.handleLogout().catch(err => {
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
      browser.tabs.sendMessage(tabId, { 
        type: EVENT_TYPES.TAB_UPDATE, 
        payload: {} 
      }).catch(() => {}) // Ignore if content script not ready
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
   * @returns {Promise<any>}
   * @private
   */
  async handleContentScriptMessage(request) {
    switch (request.type) {
      case EVENT_TYPES.REQUEST_PASSWORDS:
        return await this.fetchLoginsByDomain(request.payload)
        
      case EVENT_TYPES.SAVE_CREDENTIALS:
        return await this.saveCredentials(request.payload)
        
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
      CryptoUtils.encryptKey = null
      HTTPClient.setHeader('Authorization', '')
      
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
        await browser.tabs.sendMessage(tabs[0].id, { type, payload })
          .catch(() => {}) // Ignore if content script not ready
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
      const { data: logins } = await PasswordsService.FetchAll()
      
      // Decrypt all items (with error resilience)
      const decryptedLogins = logins.map(login => {
        try {
          CryptoUtils.decryptFields(login, ENCRYPTED_FIELDS)
          return login
        } catch (error) {
          console.error(`Failed to decrypt login item ${login.id}:`, error)
          return null
        }
      }).filter(Boolean) // Remove failed items

      // Filter by domain
      const matchedLogins = decryptedLogins.filter(item => 
        this.loginMatchesDomain(item, domain)
      )
      
      if (matchedLogins.length === 0) {
        throw new RequestError(`No logins found for ${domain}`, 'NO_LOGINS')
      }
      
      return matchedLogins
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
        throw new RequestError('Session expired. Please login again to Passwall extension.', 'AUTH_EXPIRED')
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
      const hasEquivalentMatch = [...currentEquivalents].some(domain => 
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
   * Save or update credentials
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

    const { username, password, url, domain, action, loginId } = payload

    // Validate required fields
    if (!username || !password) {
      throw new RequestError('Username and password are required', 'VALIDATION_ERROR')
    }

    try {
      let result
      
      if (action === 'update' && loginId) {
        // UPDATE: Fetch existing login to preserve title and other fields
        try {
          // Fetch existing login
          const existingLoginResponse = await PasswordsService.Get(loginId)
          const existingLogin = existingLoginResponse.data
          
          // Decrypt existing data to get current title
          CryptoUtils.decryptFields(existingLogin, ENCRYPTED_FIELDS)
          
          // Prepare update data - preserve title, update credentials
          const loginData = {
            username,
            password,
            url: existingLogin.url || url, // Preserve existing URL
            title: existingLogin.title || domain || getHostName(url) || 'Untitled' // Preserve existing title
          }
          
          // Encrypt sensitive fields
          CryptoUtils.encryptFields(loginData, ENCRYPTED_FIELDS)
          
          result = await PasswordsService.Update(loginId, loginData)
        } catch (fetchError) {
          console.error('Failed to fetch existing login, creating new instead:', fetchError)
          // Fallback to create if fetch fails
          const loginData = {
            username,
            password,
            url,
            title: domain || getHostName(url) || 'Untitled'
          }
          CryptoUtils.encryptFields(loginData, ENCRYPTED_FIELDS)
          result = await PasswordsService.Create(loginData)
        }
      } else {
        // CREATE new login
        const loginData = {
          username,
          password,
          url,
          title: domain || getHostName(url) || 'Untitled'
        }
        
        // Encrypt sensitive fields
        CryptoUtils.encryptFields(loginData, ENCRYPTED_FIELDS)
        
        result = await LoginsService.Create(loginData)
      }

      return { success: true, data: result.data }
    } catch (error) {
      // Check if it's an authentication error
      const status = error.response?.status
      if (status === 401 || status === 403) {
        console.warn('🔐 Session expired during save, clearing auth state...')
        this.isAuthenticated = false
        throw new RequestError('Session expired. Please login again to Passwall extension.', 'AUTH_EXPIRED')
      }
      
      console.error('Failed to save credentials:', error)
      const errorMessage = error.message || 'Failed to save credentials'
      throw new RequestError(errorMessage, 'SAVE_ERROR')
    }
  }
}

// Initialize agent
const agent = new BackgroundAgent()
