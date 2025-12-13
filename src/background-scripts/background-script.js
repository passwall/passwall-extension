import browser from 'webextension-polyfill'
import { EVENT_TYPES } from '@/utils/constants'
import LoginsService from '@/api/services/Logins'
import Storage from '@/utils/storage'
import HTTPClient from '@/api/HTTPClient'
import CryptoUtils from '@/utils/crypto'
import { RequestError } from '@/utils/helpers'

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
      case EVENT_TYPES.REQUEST_LOGINS:
        return await this.fetchLoginsByDomain(request.payload)
        
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
      throw new RequestError('Passwall authentication is needed!', 'NO_AUTH')
    }
    
    try {
      const { data: logins } = await LoginsService.FetchAll()
      
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
      // Wrap other errors
      console.error('Failed to fetch logins:', error)
      throw new RequestError('Failed to fetch logins from server', 'FETCH_ERROR')
    }
  }

  /**
   * Check if login item matches domain
   * @param {Object} item - Login item
   * @param {string} domain - Domain to match
   * @returns {boolean}
   * @private
   */
  loginMatchesDomain(item, domain) {
    try {
      const searchTerm = domain.toLowerCase()
      return Object.values(item).some(value => 
        (value || '').toString().toLowerCase().includes(searchTerm)
      )
    } catch (error) {
      console.error('Error matching domain:', error)
      return false
    }
  }
}

// Initialize agent
const agent = new BackgroundAgent()
