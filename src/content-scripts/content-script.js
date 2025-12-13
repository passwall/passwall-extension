import browser from 'webextension-polyfill'
import { EVENT_TYPES } from '@/utils/constants'
import { getHostName, PFormParseError, sendPayload } from '@/utils/helpers'
import { LoginAsPopup } from './LoginAsPopup'
import { PasswallLogo } from './PasswallLogo'

/**
 * @typedef {Object} LoginForm
 * @property {HTMLFormElement} form - The form element
 * @property {HTMLInputElement[]} inputs - Input fields in the form
 */

/**
 * @typedef {Object} Login
 * @property {number} id
 * @property {string} username
 * @property {string} password
 * @property {string} url
 */

const INPUT_TYPES = {
  PASSWORD: 'password',
  TEXT: 'text',
  EMAIL: 'email',
  NUMBER: 'number',
  TEL: 'tel'
}

// Development mode logging
const DEV_MODE = true // Set to true for debugging
const log = {
  info: (...args) => DEV_MODE && console.log('🔵 [Passwall]', ...args),
  success: (...args) => DEV_MODE && console.log('✅ [Passwall]', ...args),
  error: (...args) => console.error('❌ [Passwall]', ...args),
  warn: (...args) => DEV_MODE && console.warn('⚠️ [Passwall]', ...args)
}

/**
 * ContentScriptInjector - Manages Passwall integration in web pages
 * Detects login forms and injects Passwall logo for auto-fill functionality
 */
class ContentScriptInjector {
  constructor() {
    this.forms = []
    this.domain = ''
    this.logins = []
    this.authError = null
    this.logos = []
    this.popupMessageListeners = []
    
    this.initialize()
  }

  /**
   * Initialize event listeners and bindings
   * @private
   */
  initialize() {
    // Set domain first
    this.domain = getHostName(window.location.href)
    
    // Listen to messages from background script
    browser.runtime.onMessage.addListener(this.handleBackgroundMessage.bind(this))
    
    // Listen to messages from popup windows
    window.addEventListener('message', this.handlePopupMessage.bind(this))
    
    // Handle window resize - reposition logos
    window.addEventListener('resize', this.handleWindowResize.bind(this))
    
    // Scan page for login forms on initialization
    this.detectAndInjectLogos()
  }

  /**
   * Handle window resize events
   * @private
   */
  handleWindowResize() {
    if (this.hasLoginForms) {
      this.logos.forEach(logo => {
        logo.destroy()
        logo.render()
      })
    }
  }

  /**
   * Check if page has detected login forms
   * @returns {boolean}
   */
  get hasLoginForms() {
    return this.forms && this.forms.length > 0
  }

  /**
   * Handle messages from background script
   * @param {Object} request - Message from background
   * @param {*} sender
   * @param {Function} sendResponse
   */
  async handleBackgroundMessage(request, sender, sendResponse) {
    this.domain = getHostName(window.location.href)
    
    switch (request.type) {
      case EVENT_TYPES.REFRESH_TOKENS:
      case EVENT_TYPES.TAB_UPDATE:
        await this.detectAndInjectLogos()
        break
        
      case EVENT_TYPES.LOGOUT:
        this.cleanup()
        break
    }
  }

  /**
   * Handle messages from popup windows (iframe communication)
   * @param {MessageEvent} event
   */
  async handlePopupMessage(event) {
    this.popupMessageListeners.forEach(listener => listener(event.data))
  }

  /**
   * Detect login forms and inject Passwall logos
   * @private
   */
  async detectAndInjectLogos() {
    try {
      this.forms = this.findLoginForms()
      
      if (!this.hasLoginForms) return
      
      // Request matching logins from background script
      try {
        const logins = await sendPayload({
          type: EVENT_TYPES.REQUEST_LOGINS,
          payload: this.domain
        })
        
        this.logins = logins
        this.authError = null
        this.injectLogo()
        
        log.success(`Passwall ready: ${logins.length} login(s) for ${this.domain}`)
      } catch (error) {
        // Handle authentication and no logins errors
        if (error.type === 'NO_AUTH') {
          // User not logged in - still show logo but with empty logins
          // Popup will show authentication message
          this.logins = []
          this.authError = 'NO_AUTH'
          this.injectLogo()
          log.warn('User not authenticated - logo will prompt login')
        } else if (error.type === 'NO_LOGINS') {
          // No logins for this domain - still show logo
          this.logins = []
          this.authError = 'NO_LOGINS'
          this.injectLogo()
          log.info('No logins found for this domain')
        } else if (!error.message?.includes('Receiving end does not exist')) {
          log.error('Failed to fetch logins:', error)
        }
      }
      
    } catch (error) {
      if (!(error instanceof PFormParseError && error.type === 'NO_PASSWORD_FIELD')) {
        log.error('Form detection error:', error)
      }
    }
  }

  /**
   * Find all login forms on the page
   * @returns {LoginForm[]}
   * @throws {PFormParseError} If no password fields found
   */
  findLoginForms() {
    const passwordInputExists = document.querySelector(`input[type="${INPUT_TYPES.PASSWORD}"]`)
    
    if (!passwordInputExists) {
      throw new PFormParseError('No password field found', 'NO_PASSWORD_FIELD')
    }
    
    const forms = document.querySelectorAll('form')
    const loginForms = []
    
    forms.forEach(form => {
      const inputs = this.getFormInputs(form)
      
      // Valid login form must have at least one password field
      const hasPassword = inputs.some(input => input.type === INPUT_TYPES.PASSWORD)
      if (!hasPassword) return
      
      loginForms.push({ form, inputs })
    })
    
    return loginForms
  }

  /**
   * Get relevant input fields from a form
   * @param {HTMLFormElement} form
   * @returns {HTMLInputElement[]}
   * @private
   */
  getFormInputs(form) {
    const inputs = form.querySelectorAll('input')
    const relevantTypes = [
      INPUT_TYPES.TEXT, 
      INPUT_TYPES.EMAIL, 
      INPUT_TYPES.PASSWORD, 
      INPUT_TYPES.NUMBER,
      INPUT_TYPES.TEL
    ]
    
    return [...inputs].filter(input => 
      relevantTypes.includes(input.type) && !input.hidden
    )
  }

  /**
   * Inject Passwall logo next to the first username input field
   * Supports text, email, number, and tel input types
   * @private
   */
  injectLogo() {
    if (!this.hasLoginForms) return
    
    // Find first username field (text, email, number, or tel)
    const firstForm = this.forms[0]
    const usernameInput = firstForm.inputs.find(input => 
      [INPUT_TYPES.TEXT, INPUT_TYPES.EMAIL, INPUT_TYPES.NUMBER, INPUT_TYPES.TEL].includes(input.type)
    )
    
    if (!usernameInput) return
    
    const logo = new PasswallLogo(
      usernameInput, 
      () => this.showLoginSelector(usernameInput)
    )
    
    logo.render()
    this.logos.push(logo)
  }

  /**
   * Show login selection popup
   * @param {HTMLElement} targetInput - Input element to position popup near
   * @private
   */
  showLoginSelector(targetInput) {
    log.info(`🚀 Logo clicked! Creating popup with ${this.logins.length} logins`)

    const popup = new LoginAsPopup(targetInput, this.logins, this.forms, this.authError)

    // Register popup's message handler
    this.popupMessageListeners.push(popup.messageHandler.bind(popup))

    popup.render()
    log.success('Popup rendered and ready')
  }

  /**
   * Clean up all injected elements and listeners
   * @private
   */
  cleanup() {
    this.logos.forEach(logo => logo.destroy())
    this.logos = []
    this.logins = []
    this.authError = null
    this.forms = []
    this.popupMessageListeners = []
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ContentScriptInjector()
  })
} else {
  new ContentScriptInjector()
}
