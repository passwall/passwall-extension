import '@/polyfills'
import browser from 'webextension-polyfill'
import { EVENT_TYPES } from '@/utils/constants'
import { getHostName, getDomain, PFormParseError, sendPayload, generatePassword } from '@/utils/helpers'
import { shouldIgnoreField, getPlatformInfo, getPlatformRules } from '@/utils/platform-rules'
import { checkCurrentPageSecurity, SECURITY_WARNINGS } from '@/utils/security-checks'
import totpService from '@/utils/totp'
import { LoginAsPopup } from './LoginAsPopup'
import { PasswordSuggestionPopup } from './PasswordSuggestionPopup'
import { PasswallLogo } from './PasswallLogo'

/**
 * @typedef {Object} LoginForm
 * @property {HTMLFormElement} form - The form element
 * @property {HTMLInputElement[]} inputs - Input fields in the form
 */

/**
 * @typedef {Object} LoginField
 * @property {HTMLInputElement} username - Username/email input field
 * @property {HTMLInputElement} password - Password input field
 * @property {HTMLFormElement|null} form - Parent form (null if formless)
 * @property {string} detectMethod - Detection method used ('form-based' or 'formless')
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

const FIELD_TYPES = {
  PASSWORD: 'password',
  USERNAME: 'username',
  EMAIL: 'email',
  PHONE: 'phone',
  TEXT: 'text'
}

const FORM_INTENTS = {
  LOGIN: 'login',
  SIGNUP: 'signup',
  LOGOUT: 'logout',
  UNKNOWN: 'unknown'
}

const FORM_INTENT_KEYWORDS = {
  LOGIN: ['login', 'log in', 'sign in', 'signin', 'sign-in', 'enter', 'access', 'continue'],
  SIGNUP: [
    'sign up',
    'signup',
    'register',
    'create account',
    'create an account',
    'create your account',
    'new account',
    'join',
    'get started',
    'start free',
    'free trial'
  ],
  LOGOUT: ['logout', 'log out', 'sign out', 'signout', 'logoff', 'sign off'],
  CONFIRM_PASSWORD: ['confirm', 'retype', 'repeat', 'verify', 'again', 'confirmation'],
  NEW_PASSWORD: ['new password', 'create password', 'set password', 'choose password'],
  CURRENT_PASSWORD: ['current password', 'old password', 'existing password', 'previous password']
}

const TOTP_FIELD_NAMES = [
  'totp',
  'totpcode',
  '2facode',
  'approvals_code',
  'mfacode',
  'otc-code',
  'onetimecode',
  'otp-code',
  'otpcode',
  'onetimepassword',
  'security_code',
  'second-factor',
  'twofactor',
  'twofa',
  'twofactorcode',
  'verificationcode',
  'verification code'
]
const AMBIGUOUS_TOTP_FIELD_NAMES = ['code', 'pin', 'otc', 'otp', '2fa', 'mfa']
const RECOVERY_CODE_FIELD_NAMES = ['backup', 'recovery']
const TOTP_AUTOCOMPLETE_VALUES = ['one-time-code', 'otp', 'totp', 'one-time-password']
const PENDING_TOTP_TTL_MS = 5 * 60_000

// Development mode logging (from build-time env)
const DEV_MODE = __DEV_MODE__ // Injected at build time
const log = {
  info: (...args) => DEV_MODE && console.log('🔵 [Passwall]', ...args),
  success: (...args) => DEV_MODE && console.log('✅ [Passwall]', ...args),
  error: (...args) => console.error('❌ [Passwall]', ...args),
  warn: (...args) => DEV_MODE && console.warn('⚠️ [Passwall]', ...args)
}

function generateNonce() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * ContentScriptInjector - Manages Passwall integration in web pages
 * Detects login forms and injects Passwall logo for auto-fill functionality
 */
class ContentScriptInjector {
  constructor() {
    this.forms = []
    this.loginFields = [] // Enhanced: Form-based and formless login fields
    this.domain = ''
    this.logins = []
    this.authError = null
    this.logos = []
    this.popupMessageListeners = []
    this.messageRoutes = [] // { sourceWindow, origin, nonce, handler }
    this.mutationObserver = null // Enhanced: For dynamic content
    this.rescanTimeout = null // Enhanced: Debounce rescans
    this.processedFields = new WeakSet() // Enhanced: Track processed fields
    this.submittedFormData = null // Track form submissions for save detection
    this.saveNotificationShown = false // Prevent duplicate notifications
    this.cachedCredentials = null // Cache credentials from submit button click
    this.cacheTimestamp = 0 // Timestamp of cached credentials
    this.saveNotificationRoute = null // { sourceWindow, nonce }
    this.lastAutofill = null // { at, username, passwordDigest, itemId }
    this.lastSeenUsername = null // { username, domain, at }
    this.lastSeenPassword = null // { password, at }
    this.recentlySavedCredentials = null // { username, url, passwordDigest, at }
    this.lastButtonClick = null // { element, text, timestamp }
    this.passwordSuggestionPopup = null
    this.passwordSuggestionRoute = null // { sourceWindow, nonce }
    this.loginAsPopup = null
    this.loginAsPopupTarget = null
    this.autofillIgnoreFocusInputs = new WeakSet()
    this.saveOfferHistory = new Set()
    this.saveOfferInFlight = new Set()
    this.blockSaveOffer = false
    this.saveOfferDomain = null
    this.pendingInlineFocusInput = null
    this.inlineFocusFetchInFlight = false
    this.autoPopupHosts = new Set(['vault.passwall.io'])
    this.loginById = new Map()
    this.autoFillInFlight = false
    this.lastAutoFillAttemptUrl = ''
    this.lastAutoFillAttemptAt = 0
    this.lastAutoSubmitAt = 0
    this.pendingTotp = null // { itemId, secret, domain, at }
    this.pendingTotpFillTimeout = null
    this.pendingTotpFillInFlight = false

    this.initialize()
  }

  /**
   * Track button clicks to detect logout intent
   * @private
   */
  setupButtonClickTracking() {
    document.addEventListener('click', (event) => {
      const target = event.target
      if (target.matches('button, input[type="submit"], a')) {
        const text = target.textContent?.toLowerCase().trim() || ''
        const isLogoutRelated = text.includes('logout') || text.includes('sign out') || text.includes('log out')
        this.lastButtonClick = {
          element: target.tagName + (target.id ? '#' + target.id : ''),
          text: text,
          isLogoutRelated: isLogoutRelated,
          timestamp: Date.now()
        }
      }
    }, true)
  }

  /**
   * Initialize event listeners and bindings
   * @private
   */
  initialize() {
    // Set domain first
    this.domain = getHostName(window.location.href)
    this.resetSaveOfferStateIfDomainChanged(this.domain)

    // Track button clicks to detect logout intent
    this.setupButtonClickTracking()

    // Log platform-specific rules if any
    const platformInfo = getPlatformInfo(this.domain)
    if (platformInfo.hasPlatformRules) {
      log.info(`🎯 Platform detected: ${platformInfo.platform} - ${platformInfo.description}`)
    }

    // Listen to messages from background script
    browser.runtime.onMessage.addListener(this.handleBackgroundMessage.bind(this))

    // Listen to messages from popup windows
    window.addEventListener('message', this.handlePopupMessage.bind(this))

    // Handle window resize - reposition logos
    window.addEventListener('resize', this.handleWindowResize.bind(this))

    // Enhanced: Setup mutation observer for dynamic content
    this.setupMutationObserver()

    // NEW: Setup form submission detection
    this.setupFormSubmissionDetection()

    // NEW: Setup inline menu triggers
    this.setupInlineMenuTriggers()

    // NEW: Check for pending save from background (after redirect)
    this.checkPendingSave()

    // NEW: Restore pending TOTP (multi-step auth flows)
    this.loadPendingTotp()

    // Scan page for login forms on initialization
    this.detectAndInjectLogos()
  }

  /**
   * Handle window resize events
   * @private
   */
  handleWindowResize() {
    if (this.hasLoginForms) {
      this.logos.forEach((logo) => {
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
    this.resetSaveOfferStateIfDomainChanged(this.domain)

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
    if (!event) return
    if (typeof event.data !== 'string') return

    let message
    try {
      message = JSON.parse(event.data)
    } catch {
      return
    }

    // Only accept messages coming from extension iframes we created
    let extensionOrigin
    try {
      extensionOrigin = browser.runtime.getURL('').replace(/\/$/, '')
    } catch (error) {
      throw error
    }
    if (event.origin !== extensionOrigin) {
      return
    }

    const route = this.messageRoutes.find((r) => r.sourceWindow === event.source)
    if (!route) {
      return
    }

    // Nonce is mandatory for routed messages
    if (typeof message?.nonce !== 'string' || message.nonce !== route.nonce) {
      return
    }

    try {
      route.handler(message, event)
    } catch (error) {
      throw error
    }
  }

  /**
   * Detect login forms and inject Passwall logos (Enhanced)
   * Supports multi-step forms (like Google login)
   * Includes Bitwarden-style security checks
   * @private
   */
  async detectAndInjectLogos() {
    // Clean up old logos first (important for SPA navigation / multi-step forms)
    // This prevents old logos from "floating" on the page after URL changes
    if (this.logos.length > 0) {
      log.info(`🧹 Cleaning up ${this.logos.length} old logo(s) before re-injection`)
      this.logos.forEach((logo) => logo.destroy())
      this.logos = []
    }

    if (this.pendingTotp) {
      this.schedulePendingTotpFill()
    }

    // Check if injection is disabled for this platform (future-proof for special cases)
    const platformInfo = getPlatformInfo(this.domain)
    if (platformInfo.hasPlatformRules) {
      const platformRule = getPlatformRules(this.domain)
      if (platformRule?.disableInjection) {
        log.info(`⛔ Injection disabled for ${platformInfo.platform} - skipping`)
        return
      }
    }

    // Security check first (Bitwarden-style)
    const securityCheck = checkCurrentPageSecurity()

    if (!securityCheck.allowed) {
      log.warn(`🔒 Security check failed: ${securityCheck.reason}`)
      // Still detect forms but show security warning in popup
      this.authError = securityCheck.warningType
    }

    try {
      this.forms = this.findLoginForms()

      if (!this.hasLoginForms) {
        // Enhanced: Check for potential multi-step login fields
        // (email/username fields without password - like Google)
        this.checkForMultiStepLogin()
        return
      }

      // If security check failed, still inject logo but with security warning
      if (!securityCheck.allowed) {
        this.logins = []
        this.authError = securityCheck.warningType
        this.injectLogo()
        this.maybeOpenInlinePopupFromPending()
        this.maybeAutoOpenInlinePopup()
        log.warn(`Logo injected with security warning: ${securityCheck.warningType}`)
        return
      }

      // Request matching logins from background script
      try {
        const logins = await sendPayload({
          type: EVENT_TYPES.REQUEST_PASSWORDS,
          payload: this.domain
        })

        this.logins = logins
        this.buildLoginIndex(logins)
        this.authError = null
        this.injectLogo()
        this.maybeOpenInlinePopupFromPending()
        this.maybeAutoOpenInlinePopup()
        this.maybeAutoFillLogins()

        log.success(`Passwall ready: ${logins.length} login(s) for ${this.domain}`)
      } catch (error) {
        // Handle authentication and no logins errors
        if (error.type === 'NO_AUTH' || error.type === 'AUTH_EXPIRED') {
          // User not logged in - still show logo but with empty logins
          // Popup will show authentication message
          this.logins = []
          this.buildLoginIndex([])
          this.authError = 'NO_AUTH'
          this.injectLogo()
          this.maybeOpenInlinePopupFromPending()
          this.maybeAutoOpenInlinePopup()
          // Also surface an in-page notification; background will open login UI best-effort.
          this.showAuthRequiredNotification(error?.message)
          log.warn('User not authenticated - logo will prompt login')
        } else if (error.type === 'NO_LOGINS') {
          // No logins for this domain - still show logo
          this.logins = []
          this.buildLoginIndex([])
          this.authError = 'NO_LOGINS'
          this.injectLogo()
          this.maybeOpenInlinePopupFromPending()
          this.maybeAutoOpenInlinePopup()
          log.info('No logins found for this domain')
        } else if (!error.message?.includes('Receiving end does not exist')) {
          log.error('Failed to fetch logins:', error)
        }
      }
    } catch (error) {
      if (error instanceof PFormParseError && error.type === 'NO_PASSWORD_FIELD') {
        // Enhanced: No password field found - check for multi-step login
        log.info('No password field found - checking for multi-step login...')
        this.checkForMultiStepLogin()
      } else {
        log.error('Form detection error:', error)
      }
    }
  }

  buildLoginIndex(logins) {
    if (this.loginById?.clear) {
      this.loginById.clear()
    } else {
      this.loginById = new Map()
    }

    const list = Array.isArray(logins) ? logins : []
    list.forEach((login) => {
      if (login?.id != null) {
        this.loginById.set(String(login.id), login)
      }
    })
  }

  getLoginById(itemId) {
    if (!itemId || !this.loginById) return null
    return this.loginById.get(String(itemId)) || null
  }

  getAutoFillCandidates(logins) {
    const list = Array.isArray(logins) ? logins : []
    return list.filter((login) => login?.auto_fill !== false)
  }

  selectAutoFillLogin(candidates) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return null
    }

    const now = Date.now()
    const recentLaunched = candidates
      .filter(
        (login) =>
          typeof login?.last_launched_at === 'number' &&
          login.last_launched_at > 0 &&
          now - login.last_launched_at < 30_000
      )
      .sort((a, b) => (b.last_launched_at || 0) - (a.last_launched_at || 0))

    if (recentLaunched.length > 0) {
      return recentLaunched[0]
    }

    const sortedByLastUsed = [...candidates].sort(
      (a, b) => (b.last_used_at || 0) - (a.last_used_at || 0)
    )

    return sortedByLastUsed[0] || null
  }

  pickLoginFieldForAutofill() {
    if (!Array.isArray(this.loginFields) || this.loginFields.length === 0) {
      return null
    }

    const loginFields = this.loginFields.filter(
      (field) => field?.intent !== FORM_INTENTS.SIGNUP
    )

    const withPassword = loginFields.find(
      (field) =>
        field?.password && field.password.type === INPUT_TYPES.PASSWORD && this.isFieldVisible(field.password)
    )

    return withPassword || loginFields[0] || null
  }

  inputHasValue(input) {
    return !!(input && typeof input.value === 'string' && input.value.trim() !== '')
  }

  async computePasswordDigest(password) {
    if (!password) {
      return ''
    }

    try {
      const data = new TextEncoder().encode(String(password))
      const digest = await crypto.subtle.digest('SHA-256', data)
      const bytes = new Uint8Array(digest)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      return btoa(binary)
    } catch {
      return ''
    }
  }

  async recordLoginUsage(itemId, action) {
    if (!itemId) return
    try {
      await sendPayload({
        type: EVENT_TYPES.UPDATE_LOGIN_USAGE,
        payload: { itemId, action, domain: this.domain }
      })
    } catch {
      // ignore
    }
  }

  shouldSkipAutofillForField(loginField) {
    if (!loginField) return true
    const usernameField = loginField.username
    const passwordField = loginField.password
    const usernameDistinct = usernameField && usernameField !== passwordField

    if (usernameDistinct && this.inputHasValue(usernameField)) {
      return true
    }
    if (passwordField && this.inputHasValue(passwordField)) {
      return true
    }

    return false
  }

  async maybeAutoFillLogins() {
    if (this.autoFillInFlight || this.authError || this.loginAsPopup) {
      return
    }

    if (!Array.isArray(this.logins) || this.logins.length === 0) {
      return
    }

    const loginField = this.pickLoginFieldForAutofill()
    if (!loginField) {
      return
    }

    if (this.shouldSkipAutofillForField(loginField)) {
      return
    }

    const currentUrl = window.location.href
    const recentlyAttempted =
      this.lastAutoFillAttemptUrl === currentUrl &&
      Date.now() - this.lastAutoFillAttemptAt < 2500
    if (recentlyAttempted) {
      return
    }

    const candidates = this.getAutoFillCandidates(this.logins)
    const selectedLogin = this.selectAutoFillLogin(candidates)
    if (!selectedLogin) {
      return
    }

    this.lastAutoFillAttemptUrl = currentUrl
    this.lastAutoFillAttemptAt = Date.now()
    this.autoFillInFlight = true

    try {
      await this.performAutofill(selectedLogin, loginField)
    } finally {
      this.autoFillInFlight = false
    }
  }

  async performAutofill(login, loginField) {
    let secret
    try {
      secret = await sendPayload({
        type: EVENT_TYPES.GET_AUTOFILL_SECRET,
        payload: { itemId: login?.id, domain: this.domain }
      })
    } catch (error) {
      log.warn('Auto-fill failed to fetch secret:', error)
      return
    }

    const username = secret?.username || ''
    const password = secret?.password || ''
    const filledInputs = []

    const usernameField = loginField?.username
    const passwordField = loginField?.password
    const usernameDistinct = usernameField && usernameField !== passwordField

    if (usernameDistinct && username) {
      this.fillInputWithEvents(usernameField, username)
      filledInputs.push(usernameField)
    }

    if (passwordField && password) {
      this.fillInputWithEvents(passwordField, password)
      filledInputs.push(passwordField)
    }

    if (filledInputs.length === 0) {
      return
    }

    const passwordDigest = await this.computePasswordDigest(password)
    this.lastAutofill = { at: Date.now(), username, passwordDigest, itemId: login?.id }
    this.suppressNextFocusForInputs(filledInputs)
    await this.recordLoginUsage(login?.id, 'autofill')

    if (login?.auto_login && password) {
      this.scheduleAutoSubmit(loginField, filledInputs)
    }
  }

  isLogoutElement(element) {
    if (!element) return false
    const textParts = [
      element.textContent,
      typeof element.getAttribute === 'function' ? element.getAttribute('aria-label') : '',
      typeof element.getAttribute === 'function' ? element.getAttribute('title') : '',
      typeof element.value === 'string' ? element.value : ''
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase())
      .join(' ')

    return FORM_INTENT_KEYWORDS.LOGOUT.some((keyword) => textParts.includes(keyword))
  }

  findSubmitElement(loginField, filledInputs) {
    const form = loginField?.form || filledInputs?.find((input) => input?.form)?.form || null
    const root =
      form ||
      filledInputs?.[0]?.closest?.('form, div, section, main, article, aside') ||
      document.body

    if (!root) {
      return null
    }

    const elements =
      root.querySelectorAll?.('button, input[type="submit"], [role="button"], a') || []
    for (const element of elements) {
      if (!element) continue
      if (!this.isFieldVisible(element)) continue
      if (this.isLogoutElement(element)) continue
      if (this.isSubmitButton(element) || this.isActionElement(element)) {
        return element
      }
    }

    return null
  }

  scheduleAutoSubmit(loginField, filledInputs) {
    const now = Date.now()
    if (now - this.lastAutoSubmitAt < 1500) {
      return
    }

    setTimeout(() => {
      this.tryAutoSubmit(loginField, filledInputs)
    }, 150)
  }

  tryAutoSubmit(loginField, filledInputs) {
    const now = Date.now()
    if (now - this.lastAutoSubmitAt < 1500) {
      return
    }

    const passwordFilled = (filledInputs || []).some((input) =>
      this.isPasswordLikeInput(input)
    )
    if (!passwordFilled) {
      return
    }

    const submitElement = this.findSubmitElement(loginField, filledInputs)
    if (submitElement) {
      this.lastAutoSubmitAt = now
      submitElement.click()
      return
    }

    const form = loginField?.form || filledInputs?.find((input) => input?.form)?.form || null
    if (form) {
      this.lastAutoSubmitAt = now
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit()
      } else {
        form.submit()
      }
    }
  }

  /**
   * Setup MutationObserver to detect dynamically added forms/fields
   * Supports SPA and AJAX-loaded content
   * @private
   */
  setupMutationObserver() {
    if (this.mutationObserver) return

    this.mutationObserver = new MutationObserver((mutations) => {
      let shouldRescan = false
      let shouldCleanup = false
      let shouldCheckTotp = false

      for (const mutation of mutations) {
        // Check for added nodes
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if added node is or contains password input
              if (
                node.matches &&
                (node.matches('input[type="password"]') ||
                  node.matches('form') ||
                  node.querySelector('input[type="password"]'))
              ) {
                shouldRescan = true
                break
              }
              if (
                this.pendingTotp &&
                (node.matches('input') || node.querySelector('input'))
              ) {
                shouldCheckTotp = true
              }
            }
          }
        }

        // Check for attribute changes that reveal hidden password fields
        if (mutation.type === 'attributes' && mutation.target?.nodeType === Node.ELEMENT_NODE) {
          const attrName = mutation.attributeName || ''
          if (['class', 'style', 'hidden', 'aria-hidden'].includes(attrName)) {
            const target = mutation.target
            if (
              target.matches?.('input[type="password"]') ||
              target.querySelector?.('input[type="password"]')
            ) {
              shouldRescan = true
            }
            if (this.pendingTotp && target.matches?.('input')) {
              shouldCheckTotp = true
            }
          }
        }

        // Check for removed nodes - cleanup logos if their input fields are gone
        if (mutation.removedNodes.length > 0) {
          for (const node of mutation.removedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if removed node contains any of our tracked input fields
              this.logos.forEach((logo) => {
                const inputField = logo.targetElement
                if (!inputField || !document.body.contains(inputField)) {
                  shouldCleanup = true
                }
              })

              // Also check if it's a form or contains forms
              if (
                node.matches &&
                (node.matches('form') ||
                  node.matches('input[type="password"]') ||
                  node.querySelector('form') ||
                  node.querySelector('input[type="password"]'))
              ) {
                shouldCleanup = true
              }
            }
          }
        }

        if (shouldRescan || shouldCleanup) break
      }

      // Handle cleanup first
      if (shouldCleanup) {
        // Remove logos for fields that no longer exist in DOM
        this.logos = this.logos.filter((logo) => {
          const inputField = logo.targetElement
          if (!inputField || !document.body.contains(inputField)) {
            log.info('🧹 Removing orphaned logo (input field removed from DOM)')
            logo.destroy()
            return false // Remove from array
          }
          return true // Keep in array
        })
      }

      if (shouldRescan) {
        // Debounce rescan to avoid too frequent scans
        clearTimeout(this.rescanTimeout)
        this.rescanTimeout = setTimeout(() => {
          log.info('🔄 DOM changed, rescanning for login forms...')
          this.detectAndInjectLogos()
        }, 300) // 300ms debounce
      }

      if (shouldCheckTotp) {
        this.schedulePendingTotpFill()
      }
    })

    // Observe entire document for changes (with safety check)
    if (document.body) {
      this.mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
      })
      log.success('MutationObserver setup complete - watching for dynamic content')
    } else {
      log.warn('document.body not ready - MutationObserver will be set up later')
      // Retry when body is available
      const bodyCheck = setInterval(() => {
        if (document.body) {
          clearInterval(bodyCheck)
          this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
          })
          log.success('MutationObserver setup complete (delayed)')
        }
      }, 100)
    }
  }

  /**
   * Check if a field is actually visible to the user
   * Enhanced visibility detection (Bitwarden-style)
   * @param {HTMLElement} element
   * @returns {boolean}
   * @private
   */
  isFieldVisible(element) {
    // Check if element exists
    if (!element) return false

    // Check for hidden attribute
    if (element.hidden) return false

    // Check computed styles
    const style = window.getComputedStyle(element)
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseFloat(style.opacity) === 0
    ) {
      return false
    }

    // Check dimensions
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      return false
    }

    // Check parent visibility
    let parent = element.parentElement
    while (parent && parent !== document.body) {
      const parentStyle = window.getComputedStyle(parent)
      if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
        return false
      }
      parent = parent.parentElement
    }

    return true
  }

  /**
   * Get the deepest active element across iframes and shadow roots
   * @param {Document} doc
   * @returns {Element|null}
   * @private
   */
  getDeepActiveElement(doc = document) {
    let active = doc.activeElement

    // Same-origin iframe chain
    while (active && active.tagName === 'IFRAME') {
      try {
        const nextDoc = active.contentDocument
        if (!nextDoc) break
        doc = nextDoc
        active = nextDoc.activeElement
      } catch {
        break
      }
    }

    // Shadow root chain
    while (active && active.shadowRoot && active.shadowRoot.activeElement) {
      active = active.shadowRoot.activeElement
    }

    return active || null
  }

  /**
   * Resolve aria-labelledby text for an input
   * @param {HTMLInputElement} input
   * @returns {string}
   * @private
   */
  getAriaLabelledbyText(input) {
    const ids = (input.getAttribute('aria-labelledby') || '').trim()
    if (!ids) return ''

    const texts = ids
      .split(/\s+/)
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .map((el) => (el.textContent || '').trim())
      .filter(Boolean)

    return texts.join(' ')
  }

  /**
   * Get associated label text (label + aria-labelledby)
   * @param {HTMLInputElement} input
   * @returns {string}
   * @private
   */
  getLabelText(input) {
    const ariaLabelledbyText = this.getAriaLabelledbyText(input)
    if (ariaLabelledbyText) {
      return ariaLabelledbyText.toLowerCase()
    }

    const label = this.getAssociatedLabel(input)
    return label ? (label.textContent || '').toLowerCase() : ''
  }

  /**
   * Detect search fields to avoid false positives
   * @param {HTMLInputElement} input
   * @returns {boolean}
   * @private
   */
  isSearchField(input) {
    if (!input) return false
    const attributes = {
      name: (input.name || '').toLowerCase(),
      id: (input.id || '').toLowerCase(),
      placeholder: (input.placeholder || '').toLowerCase(),
      ariaLabel: (input.getAttribute('aria-label') || '').toLowerCase(),
      role: (input.getAttribute('role') || '').toLowerCase(),
      type: (input.type || '').toLowerCase()
    }

    const labelText = this.getLabelText(input)
    const allText = [
      attributes.name,
      attributes.id,
      attributes.placeholder,
      attributes.ariaLabel,
      labelText
    ].join(' ')

    return (
      /search|query|q\b|buscar|suche|recherche|検索/.test(allText) ||
      attributes.role === 'searchbox' ||
      attributes.role === 'search' ||
      attributes.type === 'search' ||
      attributes.name === 'q' ||
      attributes.id === 'q'
    )
  }

  normalizeText(value) {
    return String(value || '').toLowerCase().trim()
  }

  normalizeKeyword(value) {
    return this.normalizeText(value).replace(/[\s_-]/g, '')
  }

  isTotpInput(input) {
    if (!input || input.tagName !== 'INPUT') return false
    if (!this.isFieldVisible(input)) return false
    if (this.isSearchField(input)) return false
    if (input.hasAttribute?.('data-passwall-ignore')) return false

    const type = this.normalizeText(input.type)
    if (['hidden', 'file', 'checkbox', 'radio', 'submit', 'button', 'image', 'reset', 'search'].includes(type)) {
      return false
    }

    const descriptor = this.normalizeKeyword(this.getInputDescriptorText(input))
    if (!descriptor) return false

    const hasLpIgnore = this.hasLpIgnore(input)
    if (this.shouldIgnoreFieldForCapture(input) && !hasLpIgnore) {
      return false
    }

    if (RECOVERY_CODE_FIELD_NAMES.some((keyword) => descriptor.includes(this.normalizeKeyword(keyword)))) {
      return false
    }

    if (TOTP_FIELD_NAMES.some((keyword) => descriptor.includes(this.normalizeKeyword(keyword)))) {
      return true
    }

    const hasAmbiguousKeyword = AMBIGUOUS_TOTP_FIELD_NAMES.some((keyword) =>
      descriptor.includes(this.normalizeKeyword(keyword))
    )
    if (!hasAmbiguousKeyword) {
      return this.hasTotpAutocomplete(input)
    }

    return this.hasTotpAutocomplete(input) || this.isLikelyTotpNumericField(input)
  }

  hasTotpAutocomplete(input) {
    const autocomplete = this.normalizeKeyword(input?.getAttribute?.('autocomplete'))
    if (!autocomplete) return false
    return TOTP_AUTOCOMPLETE_VALUES.some((keyword) => autocomplete.includes(this.normalizeKeyword(keyword)))
  }

  isLikelyTotpNumericField(input) {
    const inputMode = this.normalizeText(input?.getAttribute?.('inputmode'))
    const type = this.normalizeText(input?.type)
    const pattern = this.normalizeText(input?.getAttribute?.('pattern'))
    const maxLength = Number(input?.maxLength) || 0

    return (
      inputMode === 'numeric' ||
      type === 'number' ||
      /\d/.test(pattern) ||
      (maxLength > 0 && maxLength <= 10)
    )
  }

  hasLpIgnore(input) {
    if (!input) return false
    return (
      input.hasAttribute?.('data-lpignore') ||
      input.hasAttribute?.('data-lp-ignore') ||
      input.hasAttribute?.('lpignore')
    )
  }

  getTotpInputs(root) {
    const scope = root || document
    const inputs = Array.from(scope.querySelectorAll?.('input') || [])
    return inputs.filter((input) => this.isTotpInput(input))
  }

  sortInputsByPosition(inputs) {
    return [...inputs].sort((a, b) => {
      const rectA = a.getBoundingClientRect()
      const rectB = b.getBoundingClientRect()
      if (rectA.top === rectB.top) {
        return rectA.left - rectB.left
      }
      return rectA.top - rectB.top
    })
  }

  fillTotpInputs(inputs, totpCode) {
    if (!Array.isArray(inputs) || inputs.length === 0 || !totpCode) {
      return []
    }

    const visibleInputs = inputs.filter((input) => this.isFieldVisible(input))
    if (visibleInputs.length === 0) {
      return []
    }

    const sortedInputs = this.sortInputsByPosition(visibleInputs)
    const isSegmented =
      sortedInputs.length > 1 &&
      sortedInputs.every((input) => {
        const maxLength = Number(input?.maxLength) || 0
        return maxLength === 1 || this.isLikelyTotpNumericField(input)
      })

    if (!isSegmented) {
      this.fillInputWithEvents(sortedInputs[0], totpCode)
      return [sortedInputs[0]]
    }

    const digits = String(totpCode).split('')
    const filled = []
    for (let i = 0; i < sortedInputs.length && i < digits.length; i += 1) {
      this.fillInputWithEvents(sortedInputs[i], digits[i])
      filled.push(sortedInputs[i])
    }
    return filled
  }

  setPendingTotp({ itemId, secret }) {
    if (!itemId || !secret) return

    this.pendingTotp = {
      itemId,
      secret,
      domain: this.domain,
      at: Date.now()
    }

    sendPayload({
      type: EVENT_TYPES.SET_PENDING_TOTP,
      payload: {
        itemId,
        totp_secret: secret,
        domain: this.domain
      }
    }).catch(() => {})
  }

  clearPendingTotp() {
    this.pendingTotp = null
    sendPayload({ type: EVENT_TYPES.CLEAR_PENDING_TOTP }).catch(() => {})
  }

  isPendingTotpValid() {
    if (!this.pendingTotp) return false
    if (this.pendingTotp.domain !== this.domain) {
      this.clearPendingTotp()
      return false
    }
    if (Date.now() - this.pendingTotp.at > PENDING_TOTP_TTL_MS) {
      this.clearPendingTotp()
      return false
    }
    return true
  }

  schedulePendingTotpFill() {
    if (this.pendingTotpFillTimeout) {
      clearTimeout(this.pendingTotpFillTimeout)
    }
    this.pendingTotpFillTimeout = setTimeout(() => {
      this.maybeFillPendingTotp()
    }, 250)
  }

  maybeFillPendingTotp(targetInput) {
    if (this.pendingTotpFillInFlight) {
      return false
    }
    if (!this.isPendingTotpValid()) {
      return false
    }

    if ([SECURITY_WARNINGS.INSECURE_HTTP, SECURITY_WARNINGS.SUSPICIOUS_URL].includes(this.authError)) {
      return false
    }

    this.pendingTotpFillInFlight = true
    try {
      const container =
        targetInput?.closest?.('form') ||
        targetInput?.closest?.('div, section, main, article, aside') ||
        document.body
      const inputs = this.getTotpInputs(container)
      if (inputs.length === 0) {
        return false
      }

      const totpCode = totpService.generateCode(this.pendingTotp.secret)
      if (!totpCode) {
        this.clearPendingTotp()
        return false
      }

      const filledInputs = this.fillTotpInputs(inputs, totpCode)
      if (filledInputs.length === 0) {
        return false
      }

      this.suppressNextFocusForInputs(filledInputs)
      this.clearPendingTotp()
      return true
    } finally {
      this.pendingTotpFillInFlight = false
    }
  }

  async loadPendingTotp() {
    try {
      const pending = await sendPayload({
        type: EVENT_TYPES.GET_PENDING_TOTP,
        payload: { domain: this.domain }
      })
      if (pending?.totp_secret && pending?.itemId) {
        this.pendingTotp = {
          itemId: pending.itemId,
          secret: pending.totp_secret,
          domain: this.domain,
          at: Date.now()
        }
        this.schedulePendingTotpFill()
      }
    } catch {
      // ignore
    }
  }

  getInputDescriptorText(input) {
    const attributes = {
      name: this.normalizeText(input?.name),
      id: this.normalizeText(input?.id),
      placeholder: this.normalizeText(input?.placeholder),
      ariaLabel: this.normalizeText(input?.getAttribute?.('aria-label')),
      autocomplete: this.normalizeText(input?.autocomplete)
    }

    const labelText = this.normalizeText(this.getLabelText(input))

    return [
      attributes.name,
      attributes.id,
      attributes.placeholder,
      attributes.ariaLabel,
      attributes.autocomplete,
      labelText
    ]
      .filter(Boolean)
      .join(' ')
  }

  getActionTextFromElement(element) {
    if (!element) return ''
    const parts = [
      element.textContent,
      typeof element.getAttribute === 'function' ? element.getAttribute('aria-label') : '',
      typeof element.getAttribute === 'function' ? element.getAttribute('title') : '',
      typeof element.value === 'string' ? element.value : ''
    ]
    return parts
      .filter(Boolean)
      .map((value) => this.normalizeText(value))
      .join(' ')
  }

  collectActionTexts({ form, container, triggerElement }) {
    const texts = []

    if (triggerElement) {
      const triggerText = this.getActionTextFromElement(triggerElement)
      if (triggerText) texts.push(triggerText)
    }

    const root = form || container || document
    const elements = root.querySelectorAll?.('button, input[type="submit"], [role="button"], a') || []

    elements.forEach((el) => {
      if (this.isFieldVisible && el instanceof HTMLElement && !this.isFieldVisible(el)) {
        return
      }
      const text = this.getActionTextFromElement(el)
      if (text) texts.push(text)
    })

    if (this.lastButtonClick?.text && Date.now() - this.lastButtonClick.timestamp < 5000) {
      texts.push(this.normalizeText(this.lastButtonClick.text))
    }

    return texts
  }

  isConfirmPasswordField(input) {
    if (!input) return false
    const text = this.getInputDescriptorText(input)
    return FORM_INTENT_KEYWORDS.CONFIRM_PASSWORD.some((keyword) => text.includes(keyword))
  }

  isNewPasswordField(input) {
    if (!input) return false
    const autocomplete = this.normalizeText(input.autocomplete)
    if (autocomplete === 'new-password') return true
    const text = this.getInputDescriptorText(input)
    return FORM_INTENT_KEYWORDS.NEW_PASSWORD.some((keyword) => text.includes(keyword))
  }

  isCurrentPasswordField(input) {
    if (!input) return false
    const autocomplete = this.normalizeText(input.autocomplete)
    if (autocomplete === 'current-password') return true
    const text = this.getInputDescriptorText(input)
    return FORM_INTENT_KEYWORDS.CURRENT_PASSWORD.some((keyword) => text.includes(keyword))
  }

  getPasswordFieldInfo(inputs) {
    const passwordFields = (inputs || []).filter(
      (input) =>
        input?.type === INPUT_TYPES.PASSWORD &&
        this.isFieldVisible(input) &&
        !this.shouldIgnoreFieldForCapture(input)
    )

    const hasConfirmPasswordField = passwordFields.some((input) => this.isConfirmPasswordField(input))
    const hasNewPasswordField = passwordFields.some((input) => this.isNewPasswordField(input))
    const hasCurrentPasswordField = passwordFields.some((input) => this.isCurrentPasswordField(input))

    return {
      passwordFields,
      hasConfirmPasswordField,
      hasNewPasswordField,
      hasCurrentPasswordField
    }
  }

  detectFormIntent({ form, inputs, container, triggerElement }) {
    const scores = { login: 0, signup: 0, logout: 0 }
    const urlPath = this.normalizeText(window.location.pathname || '')
    const formAction = this.normalizeText(form?.action || '')
    const formMeta = this.normalizeText(`${form?.id || ''} ${form?.name || ''}`)

    const inputTexts = (inputs || [])
      .map((input) => this.getInputDescriptorText(input))
      .filter(Boolean)
      .join(' ')

    const actionTexts = this.collectActionTexts({ form, container, triggerElement }).join(' ')

    const haystack = [urlPath, formAction, formMeta, inputTexts, actionTexts].join(' ')

    const addScore = (intent, keywords, weight) => {
      keywords.forEach((keyword) => {
        if (haystack.includes(keyword)) {
          scores[intent] += weight
        }
      })
    }

    addScore('logout', FORM_INTENT_KEYWORDS.LOGOUT, 4)
    if (this.lastButtonClick?.isLogoutRelated && Date.now() - this.lastButtonClick.timestamp < 5000) {
      scores.logout += 6
    }

    addScore('signup', FORM_INTENT_KEYWORDS.SIGNUP, 3)
    addScore('login', FORM_INTENT_KEYWORDS.LOGIN, 2)

    if (urlPath.includes('signup') || urlPath.includes('register')) {
      scores.signup += 2
    }
    if (urlPath.includes('login') || urlPath.includes('signin')) {
      scores.login += 2
    }
    if (urlPath.includes('logout') || urlPath.includes('signout')) {
      scores.logout += 3
    }

    const passwordInfo = this.getPasswordFieldInfo(inputs)
    const passwordCount = passwordInfo.passwordFields.length

    if (passwordCount >= 2) {
      scores.signup += 3
    }
    if (passwordInfo.hasConfirmPasswordField) {
      scores.signup += 3
    }
    if (passwordInfo.hasNewPasswordField) {
      scores.signup += 4
    }
    if (passwordInfo.hasCurrentPasswordField && (passwordInfo.hasNewPasswordField || passwordCount >= 2)) {
      scores.signup -= 2
    }

    const usernameFields = (inputs || []).filter((input) => {
      const fieldType = this.identifyFieldType(input)
      const autocomplete = this.normalizeText(input?.autocomplete)
      return fieldType === FIELD_TYPES.USERNAME || fieldType === FIELD_TYPES.EMAIL || autocomplete === 'username'
    })

    if (passwordCount === 1 && usernameFields.length > 0) {
      scores.login += 2
    }
    if (passwordCount === 1 && passwordInfo.hasCurrentPasswordField) {
      scores.login += 1
    }

    if (scores.logout >= 4 && scores.logout >= scores.signup + 2 && scores.logout >= scores.login + 2) {
      return FORM_INTENTS.LOGOUT
    }
    if (scores.signup >= 4 && scores.signup >= scores.login + 1) {
      return FORM_INTENTS.SIGNUP
    }
    if (scores.login >= 2) {
      return FORM_INTENTS.LOGIN
    }
    if (scores.signup > scores.login && scores.signup > 0) {
      return FORM_INTENTS.SIGNUP
    }
    if (scores.logout > scores.login && scores.logout > 0) {
      return FORM_INTENTS.LOGOUT
    }
    return FORM_INTENTS.LOGIN
  }

  /**
   * Check if an input is likely credential-related
   * @param {HTMLInputElement} input
   * @returns {boolean}
   * @private
   */
  isLikelyCredentialInput(input) {
    if (!input || input.tagName !== 'INPUT') return false
    if (this.isSearchField(input)) return false
    if (this.shouldIgnoreFieldForCapture(input)) return false

    const type = (input.type || '').toLowerCase()
    if (type === 'password') return true

    const fieldType = this.identifyFieldType(input)
    return fieldType === FIELD_TYPES.USERNAME || fieldType === FIELD_TYPES.EMAIL
  }

  async setLastSeenUsername(username) {
    const normalized = String(username || '').trim()
    if (!normalized) return

    const entry = { username: normalized, domain: this.domain, at: Date.now() }
    this.lastSeenUsername = entry

    try {
      await sendPayload({
        type: EVENT_TYPES.SET_LAST_SEEN_USERNAME,
        payload: { domain: this.domain, username: normalized }
      })
    } catch {
      // Best-effort; local memory is enough for same-page flows
    }
  }

  shouldIgnoreFieldForCapture(input) {
    return shouldIgnoreField(input, this.domain, { respectAutocompleteOff: false })
  }

  setLastSeenPassword(password) {
    const normalized = String(password || '')
    if (!normalized) return
    this.lastSeenPassword = { password: normalized, at: Date.now() }
  }

  async getLastSeenUsername() {
    const now = Date.now()
    const local = this.lastSeenUsername
    if (local && local.domain === this.domain && now - local.at < 5 * 60_000) {
      return local.username
    }

    try {
      const res = await sendPayload({
        type: EVENT_TYPES.GET_LAST_SEEN_USERNAME,
        payload: { domain: this.domain }
      })
      return res?.username || ''
    } catch {
      return ''
    }
  }

  getLastSeenPassword() {
    const local = this.lastSeenPassword
    if (!local) return ''
    if (Date.now() - local.at > 2 * 60_000) {
      this.lastSeenPassword = null
      return ''
    }
    return local.password || ''
  }

  isVaultDomain() {
    const hostname = this.domain || getHostName(window.location.href) || ''
    return hostname === 'vault.passwall.io'
  }

  isDomainInList(domains) {
    const hostname = this.domain || getHostName(window.location.href) || ''
    return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
  }

  isEdevletDomain() {
    return this.isDomainInList(['turkiye.gov.tr'])
  }

  /**
   * Resolve the best container for credential extraction
   * @param {HTMLElement} startElement
   * @returns {HTMLElement|null}
   * @private
   */
  findBestContainerForCapture(startElement) {
    if (!startElement) return null

    const candidates = []
    let current = startElement
    const selectors = ['form', 'div', 'section', 'main', 'article', 'aside']

    while (current && current !== document.body) {
      if (current.matches && selectors.some((selector) => current.matches(selector))) {
        candidates.push(current)
      }
      current = current.parentElement
    }

    let best = null
    let bestScore = Infinity

    for (const candidate of candidates) {
      const inputs = Array.from(candidate.querySelectorAll('input')).filter((el) =>
        this.isFieldVisible(el)
      )

      const passwordInputs = inputs.filter(
        (input) => input.type === 'password' && !this.shouldIgnoreFieldForCapture(input)
      )
      if (passwordInputs.length === 0) continue

      let nearestDistance = Infinity
      for (const passwordInput of passwordInputs) {
        const distance = this.calculateDOMDistance(passwordInput, startElement)
        if (distance < nearestDistance) {
          nearestDistance = distance
        }
      }

      const score = nearestDistance * 10 + inputs.length
      if (score < bestScore) {
        bestScore = score
        best = candidate
      }
    }

    return best || candidates[0] || null
  }

  /**
   * Resolve submit button from a composed event path (shadow DOM safe)
   * @param {Event} event
   * @returns {HTMLElement|null}
   * @private
   */
  getSubmitButtonFromEvent(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : []
    for (const node of path) {
      if (node && node.nodeType === Node.ELEMENT_NODE && this.isSubmitButton(node)) {
        return node
      }
    }
    return null
  }

  /**
   * Find all input elements including those in Shadow DOM
   * @param {Document|ShadowRoot} root
   * @returns {HTMLInputElement[]}
   * @private
   */
  findAllInputs(root = document) {
    const inputs = []

    // Get inputs from current root
    inputs.push(...root.querySelectorAll('input'))

    // Check for Shadow DOM
    const elementsWithShadow = root.querySelectorAll('*')
    elementsWithShadow.forEach((element) => {
      if (element.shadowRoot) {
        // Recursively search shadow roots
        inputs.push(...this.findAllInputs(element.shadowRoot))
      }
    })

    return inputs
  }

  /**
   * Find all action elements (buttons/links) including those in Shadow DOM
   * @param {Document|ShadowRoot} root
   * @returns {HTMLElement[]}
   * @private
   */
  findAllActionElements(root = document) {
    const actions = []
    const selector = 'button, a, [role="button"]'

    actions.push(...root.querySelectorAll(selector))

    const elementsWithShadow = root.querySelectorAll('*')
    elementsWithShadow.forEach((element) => {
      if (element.shadowRoot) {
        actions.push(...this.findAllActionElements(element.shadowRoot))
      }
    })

    return actions
  }

  /**
   * Identify the type/purpose of an input field using heuristics
   * Note: Platform-specific exclusions (account IDs, etc.) are handled separately
   * via shouldIgnoreField() - this method only identifies credential fields
   * @param {HTMLInputElement} input
   * @returns {string} Field type from FIELD_TYPES
   * @private
   */
  identifyFieldType(input) {
    // Password fields are easy
    if (input.type === 'password') return FIELD_TYPES.PASSWORD

    // Gather all attributes
    const attributes = {
      name: (input.name || '').toLowerCase(),
      id: (input.id || '').toLowerCase(),
      placeholder: (input.placeholder || '').toLowerCase(),
      autocomplete: (input.autocomplete || '').toLowerCase(),
      ariaLabel: (input.getAttribute('aria-label') || '').toLowerCase(),
      className: (input.className || '').toLowerCase(),
      type: input.type || 'text'
    }

    // Get associated label text (label + aria-labelledby)
    const labelText = this.getLabelText(input)

    // Combine all text for pattern matching
    const allText = [
      attributes.name,
      attributes.id,
      attributes.placeholder,
      attributes.ariaLabel,
      attributes.className,
      labelText
    ].join(' ')

    // Email detection
    if (
      attributes.type === 'email' ||
      attributes.autocomplete === 'email' ||
      /email|e-mail|correo|mail|電子メール/.test(allText)
    ) {
      return FIELD_TYPES.EMAIL
    }

    // Username detection
    if (
      attributes.autocomplete === 'username' ||
      /iam.?user|user.?name|username|login|usuario|benutzername|gebruiker|utilisateur|ユーザー名/.test(
        allText
      )
    ) {
      return FIELD_TYPES.USERNAME
    }

    // Phone detection
    if (
      attributes.type === 'tel' ||
      attributes.autocomplete === 'tel' ||
      /phone|telefon|tel|mobile|celular|携帯/.test(allText)
    ) {
      return FIELD_TYPES.PHONE
    }

    // Default to text
    return FIELD_TYPES.TEXT
  }

  /**
   * Get the label element associated with an input
   * @param {HTMLInputElement} input
   * @returns {HTMLLabelElement|null}
   * @private
   */
  getAssociatedLabel(input) {
    // Try to find label with 'for' attribute
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`)
      if (label) return label
    }

    // Try to find parent label
    return input.closest('label')
  }

  /**
   * Find username field near a password field (for formless logins)
   * Modern approach: doesn't require <form> tag
   * @param {HTMLInputElement} passwordField
   * @returns {HTMLInputElement|null}
   * @private
   */
  findUsernameFieldNear(passwordField) {
    // Find a common container (form, div, section, main, or body)
    const container =
      passwordField.closest('form, div, section, main, article, aside') || document.body

    // Build selectors for potential username fields
    const selectors = [
      'input[type="text"]',
      'input[type="email"]',
      'input[name*="user"]',
      'input[name*="email"]',
      'input[name*="login"]',
      'input[id*="user"]',
      'input[id*="email"]',
      'input[id*="login"]',
      'input[autocomplete="username"]',
      'input[autocomplete="email"]'
    ]

    // Find all potential username fields in container
    const candidateFields = container.querySelectorAll(selectors.join(','))

    // Filter and find best match
    let bestCandidate = null
    let shortestDistance = Infinity

    for (const field of candidateFields) {
      // Skip if same field or not visible
      if (field === passwordField || !this.isFieldVisible(field)) continue
      if (this.shouldIgnoreFieldForCapture(field)) continue
      if (this.isSearchField(field)) continue

      // Username field should come before password field in DOM
      const position = field.compareDocumentPosition(passwordField)
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
        // Calculate DOM distance (simple heuristic)
        const distance = this.calculateDOMDistance(field, passwordField)

        if (distance < shortestDistance) {
          shortestDistance = distance
          bestCandidate = field
        }
      }
    }

    return bestCandidate
  }

  /**
   * Calculate approximate DOM distance between two elements
   * @param {HTMLElement} elem1
   * @param {HTMLElement} elem2
   * @returns {number}
   * @private
   */
  calculateDOMDistance(elem1, elem2) {
    // Simple heuristic: count parent levels to common ancestor
    let distance = 0
    let current = elem1

    while (current && !current.contains(elem2)) {
      distance++
      current = current.parentElement
    }

    return distance
  }

  /**
   * Find formless login fields (modern SPA approach)
   * Doesn't require <form> tag - works with React, Vue, etc.
   * @returns {LoginField[]}
   * @private
   */
  findFormlessLogins() {
    const loginFields = []

    // Find all password fields (including Shadow DOM)
    const allInputs = this.findAllInputs()
    const passwordFields = allInputs.filter(
      (input) =>
        input.type === 'password' &&
        this.isFieldVisible(input) &&
        !this.shouldIgnoreFieldForCapture(input)
    )

    log.info(`Found ${passwordFields.length} password field(s)`)

    // For each password field, find associated username field
    passwordFields.forEach((passwordField) => {
      // Skip if already processed
      if (this.processedFields.has(passwordField)) return

      const container =
        passwordField.closest('form, div, section, main, article, aside') || document.body
      const contextInputs = Array.from(container.querySelectorAll('input')).filter((el) =>
        this.isFieldVisible(el)
      )
      const intent = this.detectFormIntent({
        form: passwordField.closest('form'),
        inputs: contextInputs,
        container
      })

      const usernameField = this.findUsernameFieldNear(passwordField)

      if (usernameField) {
        const form = passwordField.closest('form') // May be null for formless

        loginFields.push({
          username: usernameField,
          password: passwordField,
          form: form,
          detectMethod: 'formless',
          intent
        })

        // Mark as processed
        this.processedFields.add(passwordField)
        this.processedFields.add(usernameField)

        log.success(
          `✅ Formless login detected: ${
            usernameField.name || usernameField.id || 'unnamed'
          } + password`
        )
      } else {
        // SPECIAL CASE: Password-only page (multi-step login 2nd stage)
        // Examples: Disney Plus, some Google flows, certain banking sites
        // When no username field found, treat as password-only page
        log.info(`🔍 Password-only page detected (formless multi-step 2nd stage)`)

        loginFields.push({
          username: passwordField, // Use password field as target for logo
          password: passwordField,
          form: passwordField.closest('form'),
          detectMethod: 'formless-password-page',
          intent
        })

        this.processedFields.add(passwordField)
        log.success(
          `✅ Password-only page detected (formless): ${
            passwordField.name || passwordField.id || 'unnamed password'
          }`
        )
      }
    })

    return loginFields
  }

  /**
   * Remove duplicate login fields
   * @param {LoginField[]} fields
   * @returns {LoginField[]}
   * @private
   */
  deduplicateFields(fields) {
    const seen = new Set()
    const unique = []

    for (const field of fields) {
      // Create unique key based on password field (most reliable)
      const key = field.password

      if (!seen.has(key)) {
        seen.add(key)
        unique.push(field)
      }
    }

    return unique
  }

  /**
   * Check for multi-step login forms (Enhanced)
   * Handles cases like Google/AWS login where password comes later
   * Injects logo on email/username fields even without password
   * @private
   */
  async checkForMultiStepLogin() {
    // Check if injection is disabled for this platform (future-proof)
    const platformInfo = getPlatformInfo(this.domain)
    if (platformInfo.hasPlatformRules) {
      const platformRule = getPlatformRules(this.domain)
      if (platformRule?.disableInjection) {
        log.info(`⛔ Multi-step injection disabled for ${platformInfo.platform}`)
        return
      }
    }

    const allInputs = this.findAllInputs()

    // Find potential username/email fields
    const potentialLoginFields = allInputs.filter((input) => {
      if (!this.isFieldVisible(input)) return false

      // EXCLUDE: Platform-specific fields or opt-out fields
      if (shouldIgnoreField(input, this.domain)) {
        log.info(`Excluding platform-specific field: ${input.name || input.id || 'unnamed'}`)
        return false
      }

      const fieldType = this.identifyFieldType(input)

      return (
        fieldType === FIELD_TYPES.EMAIL ||
        fieldType === FIELD_TYPES.USERNAME ||
        input.type === 'text' ||
        input.type === 'email' ||
        input.type === 'tel'
      )
    })

    if (potentialLoginFields.length === 0) {
      log.info('No multi-step login fields found')
      return
    }

    // Filter to most likely login fields using heuristics
    const likelyLoginFields = potentialLoginFields.filter((input) => {
      const attributes = {
        name: (input.name || '').toLowerCase(),
        id: (input.id || '').toLowerCase(),
        placeholder: (input.placeholder || '').toLowerCase(),
        autocomplete: (input.autocomplete || '').toLowerCase(),
        ariaLabel: (input.getAttribute('aria-label') || '').toLowerCase(),
        role: (input.getAttribute('role') || '').toLowerCase(),
        type: input.type || 'text'
      }

      const labelText = this.getLabelText(input)

      const allText = [
        attributes.name,
        attributes.id,
        attributes.placeholder,
        attributes.ariaLabel,
        labelText
      ].join(' ')

      // EXCLUDE: Search boxes, search bars (Gmail, etc.)
      if (this.isSearchField(input)) {
        log.info(`Skipping search field: ${input.name || input.id || 'unnamed'}`)
        return false
      }

      // Check if it looks like a login field
      return (
        /email|e-mail|mail|correo/.test(allText) ||
        /iam.?user|user.?name|username|login|identifier|usuario/.test(allText) ||
        /phone|telefon|tel|mobile/.test(allText) ||
        attributes.autocomplete === 'username' ||
        attributes.autocomplete === 'email'
      )
    })

    if (likelyLoginFields.length === 0) {
      log.info('No likely login fields detected in multi-step form')
      return
    }

    const actionCandidates = this.findAllActionElements().filter(
      (element) => this.isFieldVisible(element) && this.isActionElement(element)
    )

    let selectedLoginFields = likelyLoginFields
    if (actionCandidates.length > 0) {
      const actionDistanceThreshold = 4
      const actionFilteredFields = likelyLoginFields.filter((input) =>
        actionCandidates.some(
          (action) =>
            this.calculateDOMDistance(action, input) <= actionDistanceThreshold ||
            this.calculateDOMDistance(input, action) <= actionDistanceThreshold
        )
      )

      if (actionFilteredFields.length > 0) {
        selectedLoginFields = actionFilteredFields
      }
    }

    log.success(`🔍 Multi-step login detected: ${selectedLoginFields.length} field(s)`)

    // Create pseudo login fields for multi-step
    this.loginFields = selectedLoginFields.map((field) => ({
      username: field,
      password: null, // No password yet (multi-step)
      form: field.closest('form'),
      detectMethod: 'multi-step',
      intent: FORM_INTENTS.LOGIN
    }))

    // Update forms for backward compatibility
    this.forms = this.loginFields.map((loginField) => ({
      form: loginField.form,
      inputs: [loginField.username].filter(Boolean)
    }))

    // Security check (Bitwarden-style)
    const securityCheck = checkCurrentPageSecurity()

    if (!securityCheck.allowed) {
      // Security check failed - show warning instead of logins
      this.logins = []
      this.authError = securityCheck.warningType
      this.injectLogo()
      this.maybeOpenInlinePopupFromPending()
      this.maybeAutoOpenInlinePopup()
      log.warn(`Multi-step logo injected with security warning: ${securityCheck.warningType}`)
      return
    }

    // Try to fetch logins
    try {
      const logins = await sendPayload({
        type: EVENT_TYPES.REQUEST_PASSWORDS,
        payload: this.domain
      })

      this.logins = logins
      this.authError = null
      log.success(`Passwall ready (multi-step): ${logins.length} login(s) for ${this.domain}`)
      this.maybeOpenInlinePopupFromPending()
      this.maybeAutoOpenInlinePopup()
    } catch (error) {
      if (error.type === 'NO_AUTH' || error.type === 'AUTH_EXPIRED') {
        this.logins = []
        this.authError = 'NO_AUTH'
        this.showAuthRequiredNotification(error?.message)
        this.maybeOpenInlinePopupFromPending()
        this.maybeAutoOpenInlinePopup()
        log.warn('User not authenticated - logo will prompt login (multi-step)')
      } else if (error.type === 'NO_LOGINS') {
        this.logins = []
        this.authError = 'NO_LOGINS'
        this.maybeOpenInlinePopupFromPending()
        this.maybeAutoOpenInlinePopup()
        log.info('No logins found for this domain (multi-step)')
      }
    }

    // Inject logos on username/email fields
    this.injectLogo()
  }

  /**
   * Find all login forms on the page (Enhanced)
   * Supports both traditional form-based and modern formless logins
   * @returns {LoginForm[]}
   * @throws {PFormParseError} If no password fields found
   */
  findLoginForms() {
    // Check if any VISIBLE password fields exist (including Shadow DOM)
    const allInputs = this.findAllInputs()
    const passwordInputExists = allInputs.some(
      (input) =>
        input.type === 'password' &&
        this.isFieldVisible(input) &&
        !this.shouldIgnoreFieldForCapture(input)
    )

    if (!passwordInputExists) {
      throw new PFormParseError('No password field found', 'NO_PASSWORD_FIELD')
    }

    // Clear processed fields for fresh scan
    this.processedFields = new WeakSet()

    // 1. Traditional form-based approach
    const formBasedLogins = this.findFormBasedLogins()

    // 2. Modern formless approach (for SPA, React, Vue, etc.)
    const formlessLogins = this.findFormlessLogins()

    // Combine and deduplicate
    this.loginFields = this.deduplicateFields([...formBasedLogins, ...formlessLogins])

    log.info(
      `📊 Total unique login fields: ${this.loginFields.length} (${formBasedLogins.length} form-based, ${formlessLogins.length} formless)`
    )

    // Convert to old format for backward compatibility
    const loginForms = []
    this.loginFields.forEach((loginField) => {
      if (loginField.form) {
        const inputs = this.getFormInputs(loginField.form)
        loginForms.push({ form: loginField.form, inputs })
      } else {
        // For formless, create a pseudo-form structure
        loginForms.push({
          form: null,
          inputs: [loginField.username, loginField.password].filter(Boolean)
        })
      }
    })

    return loginForms
  }

  /**
   * Find traditional form-based logins
   * @returns {LoginField[]}
   * @private
   */
  findFormBasedLogins() {
    const loginFields = []
    const forms = document.querySelectorAll('form')

    forms.forEach((form) => {
      const inputs = this.getFormInputs(form)
      const intent = this.detectFormIntent({ form, inputs, container: form })

      // Valid login form must have at least one password field
      const passwordField = inputs.find(
        (input) =>
          input.type === INPUT_TYPES.PASSWORD && !this.shouldIgnoreFieldForCapture(input)
      )
      if (!passwordField) return

      // Skip if already processed
      if (this.processedFields.has(passwordField)) return

      // Find username field (text, email, tel, number) - use platform-specific exclusions
      const usernameField = inputs.find((input) => {
        if (
          ![INPUT_TYPES.TEXT, INPUT_TYPES.EMAIL, INPUT_TYPES.TEL, INPUT_TYPES.NUMBER].includes(
            input.type
          )
        ) {
          return false
        }

        // Check platform-specific exclusions (AWS account ID, Azure tenant ID, etc.)
        if (this.shouldIgnoreFieldForCapture(input)) {
          log.info(`Skipping platform-excluded field: ${input.name || input.id}`)
          return false
        }

        return true // This is a valid username field
      })

      // SPECIAL CASE: Multi-step password page (e.g. Amazon 2nd step)
      // If no visible username found, check for hidden/readonly username
      let isPasswordPage = false
      if (!usernameField) {
        const allFormInputs = form.querySelectorAll('input')
        const hiddenOrReadonlyUsername = [...allFormInputs].find((input) => {
          if (
            ![INPUT_TYPES.TEXT, INPUT_TYPES.EMAIL, INPUT_TYPES.TEL, INPUT_TYPES.NUMBER].includes(
              input.type
            )
          ) {
            return false
          }
          // Must be hidden OR readonly with a value (pre-filled from step 1)
          return (!this.isFieldVisible(input) || input.readOnly) && input.value
        })

        if (hiddenOrReadonlyUsername) {
          log.info(
            `🔍 Password page detected (multi-step 2nd stage) - username is ${
              hiddenOrReadonlyUsername.readOnly ? 'readonly' : 'hidden'
            }`
          )
          isPasswordPage = true

          // Inject logo on password field for password-only pages
        loginFields.push({
            username: passwordField, // Use password field as target for logo
            password: passwordField,
            form: form,
          detectMethod: 'form-based-password-page',
          intent
          })

          this.processedFields.add(passwordField)
          log.success(`✅ Password page detected: ${form.name || form.id || 'unnamed form'}`)
        }
      }

      if (usernameField && !isPasswordPage) {
        loginFields.push({
          username: usernameField,
          password: passwordField,
          form: form,
          detectMethod: 'form-based',
          intent
        })

        // Mark as processed
        this.processedFields.add(passwordField)
        this.processedFields.add(usernameField)

        log.success(`✅ Form-based login detected: ${form.name || form.id || 'unnamed form'}`)
      }
    })

    return loginFields
  }

  /**
   * Get relevant input fields from a form (Enhanced)
   * Uses improved visibility detection
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

    return [...inputs].filter(
      (input) =>
        relevantTypes.includes(input.type) &&
        this.isFieldVisible(input) &&
        !this.shouldIgnoreFieldForCapture(input)
    )
  }

  getLoginContext(loginField) {
    const baseField = loginField?.password || loginField?.username
    const form = loginField?.form || baseField?.closest('form') || null
    const container =
      form || baseField?.closest('div, section, main, article, aside') || document.body
    const inputs = Array.from(container.querySelectorAll('input')).filter((el) =>
      this.isFieldVisible(el)
    )

    return { form, container, inputs }
  }

  getSignupPasswordTargets({ inputs, fallbackField }) {
    const passwordInputs = (inputs || []).filter(
      (input) =>
        input?.type === INPUT_TYPES.PASSWORD &&
        this.isFieldVisible(input) &&
        !this.shouldIgnoreFieldForCapture(input)
    )

    const confirmFields = passwordInputs.filter((input) => this.isConfirmPasswordField(input))
    const primaryCandidates = passwordInputs.filter(
      (input) => !this.isConfirmPasswordField(input) && !this.isCurrentPasswordField(input)
    )

    const primary =
      primaryCandidates.find((input) => this.isNewPasswordField(input)) ||
      primaryCandidates[0] ||
      passwordInputs[0] ||
      fallbackField ||
      null

    return {
      primary,
      confirmFields: confirmFields.filter((field) => field !== primary)
    }
  }

  sanitizeValue(value) {
    if (typeof value !== 'string') return ''
    return value
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim()
  }

  fillInputWithEvents(input, value) {
    if (!input) return
    const sanitizedValue = this.sanitizeValue(value)

    const focusEvent = new FocusEvent('focus', { bubbles: true })
    input.dispatchEvent(focusEvent)
    input.focus()

    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    })
    input.dispatchEvent(clickEvent)

    input.value = ''
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, sanitizedValue)
    } else {
      input.value = sanitizedValue
    }

    const inputEventBefore = new Event('beforeinput', { bubbles: true, cancelable: true })
    input.dispatchEvent(inputEventBefore)

    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: false,
      composed: true,
      data: value,
      inputType: 'insertText',
      isComposing: false
    })
    input.dispatchEvent(inputEvent)

    const changeEvent = new Event('change', { bubbles: true, cancelable: false })
    input.dispatchEvent(changeEvent)

    setTimeout(() => {
      input.blur()
      const blurEvent = new FocusEvent('blur', { bubbles: true })
      input.dispatchEvent(blurEvent)
    }, 50)
  }

  async handleSignupLogoClick(loginField, clickEvent) {
    if (!clickEvent?.isTrusted) {
      return
    }

    let generatedPassword = ''
    try {
      generatedPassword = await generatePassword()
    } catch (error) {
      log.error('Failed to generate password:', error)
      return
    }
    this.openPasswordSuggestionPopup(loginField, generatedPassword)
  }

  closePasswordSuggestionPopup() {
    if (this.passwordSuggestionPopup) {
      this.passwordSuggestionPopup.destroy()
    }
    this.cleanupPasswordSuggestionRoute()
  }

  closeLoginPopup() {
    if (this.loginAsPopup) {
      const sourceWindow = this.loginAsPopup.getIframeWindow?.()
      this.loginAsPopup.destroy()
      if (sourceWindow) {
        this.messageRoutes = this.messageRoutes.filter(
          (route) => route.sourceWindow !== sourceWindow
        )
      }
    }
    this.loginAsPopup = null
    this.loginAsPopupTarget = null
  }

  cleanupPasswordSuggestionRoute() {
    if (this.passwordSuggestionRoute?.sourceWindow) {
      const sw = this.passwordSuggestionRoute.sourceWindow
      this.messageRoutes = this.messageRoutes.filter((r) => r.sourceWindow !== sw)
    }
    this.passwordSuggestionRoute = null
    this.passwordSuggestionPopup = null
  }

  applySignupPassword(loginField, password) {
    const { inputs } = this.getLoginContext(loginField)
    const targets = this.getSignupPasswordTargets({
      inputs,
      fallbackField: loginField?.password || loginField?.username
    })

    if (!targets.primary) {
      log.warn('No password field found for signup apply')
      return
    }

    this.fillInputWithEvents(targets.primary, password)
    targets.confirmFields.forEach((field) => {
      this.fillInputWithEvents(field, password)
    })

    this.setLastSeenPassword(password)
    const usernameValue = loginField?.username?.value || ''
    this.cachedCredentials = {
      username: usernameValue,
      password: password,
      url: window.location.href
    }
    this.cacheTimestamp = Date.now()
  }

  openPasswordSuggestionPopup(loginField, generatedPassword) {
    const { inputs } = this.getLoginContext(loginField)
    const targets = this.getSignupPasswordTargets({
      inputs,
      fallbackField: loginField?.password || loginField?.username
    })
    const targetField = targets.primary || loginField?.password || loginField?.username

    if (!targetField) {
      log.warn('No password field found for signup popup')
      return
    }

    this.closePasswordSuggestionPopup()

    const popup = new PasswordSuggestionPopup(targetField, generatedPassword, {
      onApply: (password) => {
        this.applySignupPassword(loginField, password)
        this.closePasswordSuggestionPopup()
      },
      onRefresh: async () => {
        try {
          const newPassword = await generatePassword()
          popup.setPassword(newPassword)
        } catch (error) {
          log.error('Failed to refresh generated password:', error)
        }
      },
      onDestroy: () => {
        if (this.passwordSuggestionPopup === popup) {
          this.cleanupPasswordSuggestionRoute()
        }
      }
    })

    popup.render()
    this.passwordSuggestionPopup = popup

    const sourceWindow = popup.getIframeWindow()
    const nonce = popup.getNonce()
    const origin = popup.getExtensionOrigin()

    if (sourceWindow && nonce && origin) {
      this.passwordSuggestionRoute = { sourceWindow, nonce }
      this.messageRoutes.push({
        sourceWindow,
        origin,
        nonce,
        handler: (message) => {
          popup.messageHandler(message)
        }
      })
    }
  }

  handleLogoClick(loginField, targetField, clickEvent) {
    const intent = loginField?.intent || FORM_INTENTS.LOGIN
    if (intent === FORM_INTENTS.SIGNUP) {
      this.handleSignupLogoClick(loginField, clickEvent)
      return
    }
    this.showLoginSelector(targetField, clickEvent)
  }

  /**
   * Inject Passwall logo next to username input fields (Enhanced)
   * Supports form-based, formless, and multi-step logins
   * @private
   */
  injectLogo() {
    if (!this.hasLoginForms && this.loginFields.length === 0) return

    // Inject logo for each detected login field set
    this.loginFields.forEach((loginField, index) => {
      // For multi-step, username might be the only field
      const intent = loginField.intent || FORM_INTENTS.LOGIN
      const targetField =
        intent === FORM_INTENTS.SIGNUP
          ? loginField.password || loginField.username
          : loginField.username

      if (!targetField || !this.isFieldVisible(targetField)) {
        log.warn(`Skipping logo injection for login #${index + 1} - field not visible`)
        return
      }

      // Check if we already have a logo for this field
      const alreadyHasLogo = this.logos.some((logo) => logo.targetElement === targetField)

      if (alreadyHasLogo) {
        log.info(`Logo already exists for login #${index + 1}`)
        return
      }

      const logo = new PasswallLogo(targetField, (event) =>
        this.handleLogoClick(loginField, targetField, event)
      )

      logo.render()
      this.logos.push(logo)

      const methodLabel = loginField.detectMethod || 'unknown'
      log.success(`🎨 Logo injected for ${methodLabel} ${intent} #${index + 1}`)
    })
  }

  /**
   * Show login selection popup
   * @param {HTMLElement} targetInput - Input element to position popup near
   * @private
   */
  showLoginSelector(targetInput, clickEvent, options = {}) {
    // Require a trusted user gesture to open the autofill UI
    if (!clickEvent?.isTrusted && !options?.allowUntrusted) {
      return
    }
    if (options?.allowUntrusted && !clickEvent?.isTrusted) {
    }

    if (this.loginAsPopup) {
      if (this.loginAsPopupTarget === targetInput) {
        if (options?.skipToggleClose) {
          return
        }
        this.closeLoginPopup()
        return
      }
      this.closeLoginPopup()
    }

    const logins = this.logins || []
    let popupLogins = logins
    const lastAutofill = this.lastAutofill
    const isPasswordStep = targetInput?.type === 'password'
    const autofillAge = lastAutofill?.at ? Date.now() - lastAutofill.at : null
    const isRecentAutofill =
      typeof autofillAge === 'number' && autofillAge >= 0 && autofillAge < 5 * 60_000

    if (isPasswordStep && isRecentAutofill && lastAutofill) {
      if (lastAutofill.itemId) {
        popupLogins = logins.filter((login) => login?.id === lastAutofill.itemId)
      } else if (lastAutofill.username) {
        const selectedUsername = String(lastAutofill.username).toLowerCase()
        popupLogins = logins.filter(
          (login) => String(login?.username || '').toLowerCase() === selectedUsername
        )
      }

      if (popupLogins.length === 0) {
        popupLogins = logins
      }
    }

    log.info(`🚀 Logo clicked! Creating popup with ${popupLogins.length} logins`)

    this.closeLoginPopup()
    const popupLoginField = this.findLoginFieldForInput(targetInput)
    const popup = new LoginAsPopup(
      targetInput,
      popupLogins,
      this.forms,
      this.authError,
      ({ at, username, passwordDigest, itemId, filledInputs, totpSecret }) => {
        this.lastAutofill = { at, username, passwordDigest, itemId }
        this.suppressNextFocusForInputs(filledInputs)
        this.recordLoginUsage(itemId, 'manual')
        if (totpSecret) {
          this.setPendingTotp({ itemId, secret: totpSecret })
          this.maybeFillPendingTotp()
        }
        const selectedLogin = this.getLoginById(itemId)
        if (selectedLogin?.auto_login) {
          this.scheduleAutoSubmit(popupLoginField, filledInputs)
        }
      }
    )

    popup.render()
    this.loginAsPopup = popup
    this.loginAsPopupTarget = targetInput
    const sourceWindow = popup.getIframeWindow()
    const nonce = popup.getNonce()
    const origin = popup.getExtensionOrigin()

    if (sourceWindow && nonce && origin) {
      this.messageRoutes.push({
        sourceWindow,
        origin,
        nonce,
        handler: (message) => {
          // If popup closes itself, unregister route
          if (message?.type === 'LOGIN_AS_POPUP_CLOSE') {
            popup.destroy()
            this.messageRoutes = this.messageRoutes.filter((r) => r.sourceWindow !== sourceWindow)
            if (this.loginAsPopup === popup) {
              this.loginAsPopup = null
            }
            return
          }
          if (message?.type === 'LOGIN_AS_POPUP_OPEN_SAVE') {
            popup.destroy()
            this.messageRoutes = this.messageRoutes.filter((r) => r.sourceWindow !== sourceWindow)
            if (this.loginAsPopup === popup) {
              this.loginAsPopup = null
            }

            const pageUrl = window.location.href
            const baseDomain = getDomain(pageUrl) || this.domain
            const payload = {
              username: '',
              password: '',
              url: pageUrl,
              domain: baseDomain,
              action: 'add',
              title: baseDomain,
              manual: true
            }

            sendPayload({ type: EVENT_TYPES.SET_PENDING_SAVE, payload }).catch((error) => {
              log.error('Failed to set pending save from login popup:', error)
            })

            this.showSaveNotification(
              { username: '', password: '', url: pageUrl },
              'add',
              null,
              null,
              'manual_add'
            )
            return
          }
          popup.messageHandler(message)
        }
      })
    }
    log.success('Popup rendered and ready')
  }

  /**
   * Setup inline menu triggers for focus events
   * @private
   */
  setupInlineMenuTriggers() {
    document.addEventListener('focusin', this.handleInlineMenuFocus.bind(this), true)
  }

  /**
   * Handle inline menu display on input focus
   * @param {FocusEvent} event
   * @private
   */
  handleInlineMenuFocus(event) {
    const input = event?.target
    if (!input || input.tagName !== 'INPUT') {
      return
    }

    if (this.autofillIgnoreFocusInputs?.has(input)) {
      this.autofillIgnoreFocusInputs.delete(input)
      return
    }

    if (!this.isFieldVisible(input)) {
      return
    }

    if (this.pendingTotp && this.isTotpInput(input)) {
      if (this.maybeFillPendingTotp(input)) {
        return
      }
    }

    if (this.isSearchField(input) || this.shouldIgnoreFieldForCapture(input)) {
      return
    }

    if (this.loginAsPopup && this.loginAsPopupTarget && this.loginAsPopupTarget !== input) {
      return
    }

    let loginField = this.findLoginFieldForInput(input)
    if (!loginField) {
      if (!this.isLikelyCredentialInput(input)) {
        return
      }
      loginField = { intent: FORM_INTENTS.LOGIN }
    }

    if (loginField.intent === FORM_INTENTS.SIGNUP) {
      return
    }

    if (!this.authError && (!this.logins || this.logins.length === 0)) {
      this.pendingInlineFocusInput = input
      if (!this.inlineFocusFetchInFlight) {
        this.inlineFocusFetchInFlight = true
        Promise.resolve(this.detectAndInjectLogos())
          .catch(() => {})
          .finally(() => {
            this.inlineFocusFetchInFlight = false
          })
      }
      return
    }

    this.showLoginSelector(input, event, { skipToggleClose: true })
  }

  /**
   * Attempt to open popup for a pending focus input
   * @private
   */
  maybeOpenInlinePopupFromPending() {
    const input = this.pendingInlineFocusInput
    if (!input) return

    if (document.activeElement !== input) {
      this.pendingInlineFocusInput = null
      return
    }

    if (!this.isFieldVisible(input)) {
      this.pendingInlineFocusInput = null
      return
    }

    if (this.isSearchField(input) || this.shouldIgnoreFieldForCapture(input)) {
      this.pendingInlineFocusInput = null
      return
    }

    let loginField = this.findLoginFieldForInput(input)
    if (!loginField) {
      if (!this.isLikelyCredentialInput(input)) {
        this.pendingInlineFocusInput = null
        return
      }
      loginField = { intent: FORM_INTENTS.LOGIN }
    }

    if (loginField.intent === FORM_INTENTS.SIGNUP) {
      this.pendingInlineFocusInput = null
      return
    }

    if (!this.authError && (!this.logins || this.logins.length === 0)) {
      return
    }

    this.pendingInlineFocusInput = null
    this.showLoginSelector(input, { isTrusted: true }, { skipToggleClose: true })
  }

  /**
   * Auto-open inline popup on trusted hosts after refresh
   * @private
   */
  maybeAutoOpenInlinePopup() {
    const domain = this.domain || ''
    if (!this.autoPopupHosts?.has?.(domain)) {
      return
    }

    if (this.loginAsPopup || this.pendingInlineFocusInput) {
      return
    }

    const activeTag = document.activeElement?.tagName
    if (activeTag && activeTag !== 'BODY' && activeTag !== 'HTML') {
      return
    }

    if (!this.authError && (!this.logins || this.logins.length === 0)) {
      return
    }

    const loginField =
      this.loginFields?.find((field) => field?.username) ||
      this.loginFields?.[0] ||
      null
    const targetInput = loginField?.username || loginField?.password || null
    if (!targetInput) {
      return
    }

    this.showLoginSelector(targetInput, { isTrusted: false }, { skipToggleClose: true, allowUntrusted: true })
  }

  /**
   * Suppress focus-triggered popup for autofilled inputs
   * @param {HTMLInputElement[]} inputs
   * @private
   */
  suppressNextFocusForInputs(inputs) {
    if (!Array.isArray(inputs) || inputs.length === 0) {
      return
    }

    inputs.forEach((input) => {
      if (input && typeof this.autofillIgnoreFocusInputs?.add === 'function') {
        this.autofillIgnoreFocusInputs.add(input)
      }
    })
  }

  /**
   * Find matching loginField for input
   * @param {HTMLInputElement} input
   * @returns {LoginField|null}
   * @private
   */
  findLoginFieldForInput(input) {
    if (!input || !this.loginFields?.length) return null

    return (
      this.loginFields.find(
        (field) => field?.username === input || field?.password === input
      ) || null
    )
  }

  /**
   * Clean up all injected elements and listeners
   * @private
   */
  cleanup() {
    // Clean up logos
    this.logos.forEach((logo) => logo.destroy())
    this.logos = []

    // Clean up mutation observer
    if (this.mutationObserver) {
      this.mutationObserver.disconnect()
      this.mutationObserver = null
    }

    // Clear rescan timeout
    if (this.rescanTimeout) {
      clearTimeout(this.rescanTimeout)
      this.rescanTimeout = null
    }

    if (this.pendingTotpFillTimeout) {
      clearTimeout(this.pendingTotpFillTimeout)
      this.pendingTotpFillTimeout = null
    }

    this.clearPendingTotp()

    // Clear data
    this.logins = []
    this.authError = null
    this.forms = []
    this.loginFields = []
    this.popupMessageListeners = []
    this.processedFields = new WeakSet()
    this.pendingTotp = null
    this.submittedFormData = null
    this.saveNotificationShown = false
    this.closePasswordSuggestionPopup()
    this.closeLoginPopup()
  }

  /**
   * Check for pending save after page load (post-redirect).
   * Pending secrets live only in background memory (never in chrome.storage).
   * @private
   */
  async checkPendingSave() {
    try {
      const pending = await sendPayload({
        type: EVENT_TYPES.CHECK_PENDING_SAVE,
        payload: {}
      })

      if (!pending?.pending) {
        return
      }

      log.info('🔄 Found pending save in background, showing save notification')

      await this.showSaveNotification(
        {
          username: pending.username,
          password: pending.password,
          url: pending.url,
          folder_id: pending.folder_id,
          auto_fill: pending.auto_fill,
          auto_login: pending.auto_login,
          reprompt: pending.reprompt
        },
        pending.action || 'add',
        pending.loginId || null,
        pending.title ? { title: pending.title } : null,
        'pending_save'
      )
    } catch (error) {
      // Best-effort: if background restarted, pending is gone
      log.error('Error checking pending save:', error)
    }
  }

  /**
   * Setup form submission detection
   * Listens for form submissions to detect new credentials
   * @private
   */
  setupFormSubmissionDetection() {
    // Listen for form submit events
    document.addEventListener('submit', this.handleFormSubmit.bind(this), true)

    // Also listen for click events on submit buttons (for formless submissions)
    document.addEventListener('click', this.handleSubmitButtonClick.bind(this), true)

    // NEW: Listen for input changes to cache credentials early (for React/Vue forms)
    document.addEventListener('input', this.handleInputChange.bind(this), true)
    document.addEventListener('change', this.handleInputChange.bind(this), true)

    // NEW: Listen for Enter key submits (keyboard-only flows)
    document.addEventListener('keydown', this.handleKeydownEnter.bind(this), true)
    // NEW: Listen for ESC to close in-page popups
    document.addEventListener('keydown', this.handleKeydownEscape.bind(this), true)

    log.success('Form submission detection initialized')
  }

  /**
   * Handle input change events to cache credentials early
   * @param {Event} event - Input/change event
   * @private
   */
  handleInputChange(event) {
    const input = event.target

    if (!input || input.tagName !== 'INPUT') {
      return
    }

    // Only cache if input has a value
    if (!input.value || input.value.length < 1) {
      return
    }

    const inputType = input.type.toLowerCase()
    const inputName = (input.name || '').toLowerCase()
    const inputId = (input.id || '').toLowerCase()

    if (this.shouldIgnoreFieldForCapture(input)) {
      return
    }

    // Check if this is a password field
    const isPassword =
      inputType === 'password' ||
      inputName.includes('password') ||
      inputName.includes('passwd') ||
      inputName.includes('pwd') ||
      inputId.includes('password') ||
      inputId.includes('passwd') ||
      inputId.includes('pwd')

    // Check if this is a username/email field
    const isUsername =
      inputType === 'email' ||
      inputType === 'text' ||
      inputName.includes('user') ||
      inputName.includes('email') ||
      inputName.includes('login') ||
      inputId.includes('user') ||
      inputId.includes('email') ||
      inputId.includes('login')

    if (isPassword) {
      if (this.lastAutofill?.passwordDigest) {
        try {
          const currentValue = String(input.value || '')
          const data = new TextEncoder().encode(currentValue)
          crypto.subtle
            .digest('SHA-256', data)
            .then((digest) => {
              const bytes = new Uint8Array(digest)
              let binary = ''
              for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
              const currentDigest = btoa(binary)
              const matchesAutofill = currentDigest === this.lastAutofill.passwordDigest
              if (!matchesAutofill) {
                this.lastAutofill = null
                log.info('🔄 Password changed after autofill, clearing autofill state')
              }
            })
            .catch(() => {})
        } catch {
          // ignore
        }
      }
      this.setLastSeenPassword(input.value)
    }

    if (isUsername && !this.isSearchField(input)) {
      this.setLastSeenUsername(input.value)
    }

    if (isPassword || isUsername) {
      this.blockSaveOffer = false
    }

    if (isPassword || isUsername) {
      // Find form or container
      const form = input.closest('form')
      const container = form || input.closest('div, section, main') || document.body

      // Extract all credentials from container
      const inputs = Array.from(container.querySelectorAll('input')).filter((el) =>
        this.isFieldVisible(el)
      )

      // Try to extract full credentials
      const credentials = this.extractCredentialsFromInputs(inputs)

      if (credentials && credentials.username && credentials.password) {
        // Cache complete credentials
        this.cachedCredentials = credentials
        this.cacheTimestamp = Date.now()

        log.info('🔄 Credentials cached from input change:', {
          username: credentials.username,
          hasPassword: !!credentials.password
        })
      }
    }
  }

  /**
   * Handle form submit event
   * @param {Event} event - Submit event
   * @private
   */
  async handleFormSubmit(event) {
    const form = event.target

    if (!form || !form.elements) {
      return
    }

    log.info('🔍 Form submitted, analyzing...')

    const formInputs = Array.from(form.elements).filter((el) => el.tagName === 'INPUT')
    const intent = this.detectFormIntent({
      form,
      inputs: formInputs,
      container: form,
      triggerElement: this.getSubmitButtonFromEvent(event)
    })

    if (intent === FORM_INTENTS.LOGOUT) {
      log.info('🚫 Logout intent detected, skipping credential capture')
      this.blockSaveOffer = true
      return
    }

    if (!this.hasVisiblePasswordInput(formInputs)) {
      log.info('🚫 No visible password fields in submitted form, skipping save offer')
      return
    }

    // Try to use cached credentials first (from submit button click)
    let credentials = null
    const CACHE_VALID_MS = 2000 // Cache valid for 2 seconds

    if (this.cachedCredentials && Date.now() - this.cacheTimestamp < CACHE_VALID_MS) {
      log.info('✅ Using cached credentials from submit button click')
      credentials = this.cachedCredentials
    } else {
      // Fallback: Extract credentials from form IMMEDIATELY (before form clears)
      log.info('⚠️ No valid cache, extracting from form...')
      const fallbackUsername = await this.getLastSeenUsername()
      const fallbackPassword = this.getLastSeenPassword()
      const deepActiveElement = this.getDeepActiveElement()
      const activeContainer = deepActiveElement
        ? this.findBestContainerForCapture(deepActiveElement)
        : null

      if (activeContainer && activeContainer !== form) {
        credentials = this.extractCredentialsFromContainer(activeContainer, {
          fallbackUsername,
          fallbackPassword,
          allowMissingUsername: intent === FORM_INTENTS.SIGNUP
        })
      }

      if (!credentials) {
        credentials = this.extractCredentialsFromForm(form, {
          fallbackUsername,
          fallbackPassword,
          allowMissingUsername: intent === FORM_INTENTS.SIGNUP
        })
      }
    }

    if (credentials) {
      const autofillAge = this.lastAutofill?.at ? Date.now() - this.lastAutofill.at : null
      const recentAutofillTime =
        typeof autofillAge === 'number' &&
        autofillAge >= 0 &&
        autofillAge < 8000 &&
        (this.lastAutofill?.username || '') === (credentials.username || '')

      let passwordSameAsAutofill = false
      if (recentAutofillTime && this.lastAutofill?.passwordDigest && credentials.password) {
        try {
          const data = new TextEncoder().encode(String(credentials.password))
          const digest = await crypto.subtle.digest('SHA-256', data)
          const bytes = new Uint8Array(digest)
          let binary = ''
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
          const currentDigest = btoa(binary)
          passwordSameAsAutofill = currentDigest === this.lastAutofill.passwordDigest
        } catch {
          passwordSameAsAutofill = false
        }
      }

      const recentAutofill = recentAutofillTime && passwordSameAsAutofill

      if (recentAutofill) {
        // Do not prompt save for credentials we just autofilled
        this.lastAutofill = null
        return
      }

      log.info('✅ Credentials detected:', {
        username: credentials.username,
        hasPassword: !!credentials.password,
        url: credentials.url
      })

      // Store credentials immediately in background memory (survives redirect)
      try {
        const missingUsername = !credentials.username || !credentials.username.trim()
        const manual = intent === FORM_INTENTS.SIGNUP && missingUsername
        await sendPayload({
          type: EVENT_TYPES.SET_PENDING_SAVE,
          payload: {
            username: credentials.username,
            password: credentials.password,
            url: credentials.url,
            domain: this.domain,
            action: 'add',
            manual
          }
        })
      } catch (error) {
        log.error('Failed to set pending save in background:', error)
      }

      // Clear cache after use
      this.cachedCredentials = null
      this.cacheTimestamp = 0

      // Also try to show immediately (if no redirect)
      // Don't set up new timers if a save notification is already active
      if (!this.saveNotificationShown) {
        setTimeout(() => {
          // Check if save notification is already shown before offering
          if (!this.saveNotificationShown) {
            this.checkIfShouldOfferSave(credentials, { intent })
          }
        }, 1000)
      }
    } else {
      log.warn('❌ No credentials found in form')
    }
  }

  /**
   * Handle submit button click (for formless submissions)
   * @param {Event} event - Click event
   * @private
   */
  async handleSubmitButtonClick(event) {
    const element = this.getSubmitButtonFromEvent(event) || event.target

    // Check if this looks like a submit button
    if (!this.isSubmitButton(element)) {
      return
    }

    log.info('🔍 Submit button clicked, caching credentials...')

    const deepActiveElement = this.getDeepActiveElement()
    const baseElement = deepActiveElement || element
    const container =
      this.findBestContainerForCapture(baseElement) ||
      element.closest('form, div, section, main') ||
      document.body

    const contextInputs = Array.from(container.querySelectorAll('input')).filter((el) =>
      this.isFieldVisible(el)
    )
    const intent = this.detectFormIntent({
      form: element.closest('form'),
      inputs: contextInputs,
      container,
      triggerElement: element
    })

    if (intent === FORM_INTENTS.LOGOUT) {
      log.info('🚫 Logout intent detected, skipping credential capture')
      this.blockSaveOffer = true
      return
    }

    if (!this.hasVisiblePasswordInput(contextInputs)) {
      log.info('🚫 No visible password fields in submit context, skipping save offer')
      return
    }

    // Extract credentials from container BEFORE form manipulates fields
    const fallbackUsername = await this.getLastSeenUsername()
    const fallbackPassword = this.getLastSeenPassword()
    const credentials = this.extractCredentialsFromContainer(container, {
      fallbackUsername,
      fallbackPassword,
      allowMissingUsername: intent === FORM_INTENTS.SIGNUP
    })

    if (credentials) {
      log.info('✅ Credentials detected and cached:', {
        username: credentials.username,
        hasPassword: !!credentials.password
      })

      // Cache credentials for use in form submit handler
      this.cachedCredentials = credentials
      this.cacheTimestamp = Date.now()

      // For formless submissions (no form submit event), wait and offer save
      // Don't set up new timers if a save notification is already active
      if (!element.closest('form') && !this.saveNotificationShown) {
        setTimeout(() => {
          // Check if save notification is already shown before offering
          if (!this.saveNotificationShown) {
            this.checkIfShouldOfferSave(credentials, { intent })
          }
        }, 1000)
      }
      // If there's a form, let form submit handler use cached credentials
    }
  }

  /**
   * Close in-page popups on Escape for quick dismissal
   * @param {KeyboardEvent} event
   * @private
   */
  handleKeydownEscape(event) {
    if (event.key !== 'Escape') return

    const hasPopup =
      this.saveNotificationShown ||
      this.passwordSuggestionPopup ||
      this.loginAsPopup

    if (!hasPopup) return

    this.removeSaveNotification()
    this.closePasswordSuggestionPopup()
    this.closeLoginPopup()

    event.preventDefault()
    event.stopPropagation()
  }

  /**
   * Handle Enter key submits (keyboard-only flows)
   * @param {KeyboardEvent} event
   * @private
   */
  async handleKeydownEnter(event) {
    if (event.key !== 'Enter') return
    if (event.defaultPrevented) return
    if (!event.isTrusted) return

    const target = event.target
    if (target?.isContentEditable || target?.tagName === 'TEXTAREA') {
      return
    }

    const deepActiveElement = this.getDeepActiveElement()
    const input =
      deepActiveElement?.tagName === 'INPUT'
        ? deepActiveElement
        : target?.tagName === 'INPUT'
          ? target
          : null

    if (!input || !this.isLikelyCredentialInput(input)) {
      return
    }

    const container =
      this.findBestContainerForCapture(input) ||
      input.closest('form, div, section, main') ||
      document.body

    const contextInputs = Array.from(container.querySelectorAll('input')).filter((el) =>
      this.isFieldVisible(el)
    )
    const intent = this.detectFormIntent({
      form: input.closest('form'),
      inputs: contextInputs,
      container,
      triggerElement: input
    })

    if (intent === FORM_INTENTS.LOGOUT) {
      return
    }

    const fallbackUsername = await this.getLastSeenUsername()
    const fallbackPassword = this.getLastSeenPassword()
    const credentials = this.extractCredentialsFromContainer(container, {
      fallbackUsername,
      fallbackPassword,
      allowMissingUsername: intent === FORM_INTENTS.SIGNUP
    })

    if (!credentials) {
      return
    }

    this.cachedCredentials = credentials
    this.cacheTimestamp = Date.now()

    // Don't set up new timers if a save notification is already active
    if (!input.closest('form') && !this.saveNotificationShown) {
      setTimeout(() => {
        // Check if save notification is already shown before offering
        if (!this.saveNotificationShown) {
          this.checkIfShouldOfferSave(credentials, { intent })
        }
      }, 1000)
    }
  }

  /**
   * Check if element looks like an action button (next/continue/login)
   * @param {HTMLElement} element
   * @returns {boolean}
   * @private
   */
  isActionElement(element) {
    if (!element) return false

    const tagName = typeof element.tagName === 'string' ? element.tagName.toLowerCase() : ''
    const role =
      typeof element.getAttribute === 'function'
        ? (element.getAttribute('role') || '').toLowerCase()
        : ''

    if (tagName !== 'button' && tagName !== 'a' && role !== 'button') {
      return false
    }

    const textParts = [
      element.textContent,
      typeof element.getAttribute === 'function' ? element.getAttribute('aria-label') : '',
      typeof element.getAttribute === 'function' ? element.getAttribute('title') : '',
      typeof element.value === 'string' ? element.value : ''
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase())
      .join(' ')

    const actionKeywords = [
      'login',
      'sign in',
      'log in',
      'submit',
      'continue',
      'next',
      'proceed',
      'enter'
    ]

    return actionKeywords.some((keyword) => textParts.includes(keyword))
  }

  /**
   * Check if element is a submit button
   * @param {HTMLElement} element
   * @returns {boolean}
   * @private
   */
  isSubmitButton(element) {
    if (!element) return false

    const tagName = typeof element.tagName === 'string' ? element.tagName.toLowerCase() : ''
    const typeAttr = typeof element.getAttribute === 'function' ? element.getAttribute('type') : null
    const rawType = typeof element.type === 'string' ? element.type : typeAttr
    const type = typeof rawType === 'string' ? rawType.toLowerCase() : ''
    const role =
      typeof element.getAttribute === 'function'
        ? (element.getAttribute('role') || '').toLowerCase()
        : ''

    // Check if it's a submit input or button
    if (type === 'submit') return true
    if (tagName === 'button' && type !== 'button' && type !== 'reset') return true
    if (role === 'button') {
      // Check button text for login/submit keywords
      const text = (element.textContent || '').toLowerCase()
      const submitKeywords = [
        'login',
        'sign in',
        'log in',
        'submit',
        'continue',
        'next',
        'proceed',
        'enter'
      ]
      return submitKeywords.some((keyword) => text.includes(keyword))
    }

    return false
  }

  /**
   * Extract credentials from form element
   * @param {HTMLFormElement} form
   * @returns {Object|null} - {username, password, url}
   * @private
   */
  extractCredentialsFromForm(form, options = {}) {
    const formInputs = Array.from(form.elements).filter((el) => el.tagName === 'INPUT')

    return this.extractCredentialsFromInputs(formInputs, options)
  }

  /**
   * Extract credentials from container element
   * @param {HTMLElement} container
   * @returns {Object|null} - {username, password, url}
   * @private
   */
  extractCredentialsFromContainer(container, options = {}) {
    const inputs = Array.from(container.querySelectorAll('input'))

    return this.extractCredentialsFromInputs(inputs, options)
  }

  /**
   * Extract credentials from input elements
   * @param {HTMLInputElement[]} inputs
   * @returns {Object|null} - {username, password, url}
   * @private
   */
  extractCredentialsFromInputs(inputs, options = {}) {
    const fallbackUsername = String(options.fallbackUsername || '').trim()
    const fallbackPassword = String(options.fallbackPassword || '')
    const allowMissingUsername = !!options.allowMissingUsername
    const visibleInputs = inputs.filter((input) => this.isFieldVisible(input))

    // Find password field (including common name variations)
    const passwordField = visibleInputs.find(
      (input) => input.type === 'password' && !this.shouldIgnoreFieldForCapture(input)
    )

    const resolvedPassword = (passwordField?.value || fallbackPassword || '').trim()

    if (!resolvedPassword) {
      log.info('No password value found')
      return null
    }

    if (!passwordField && !fallbackPassword) {
      log.info('No password field found with value')
      return null
    }

    log.info('Password field found:', {
      name: passwordField?.name || null,
      id: passwordField?.id || null,
      hasValue: !!passwordField?.value
    })

    // Find username field with priority order
    // 1. Email type inputs
    // 2. Inputs with username-related names (WordPress: user_login, log, etc.)
    // 3. Any text/tel input
    const usernameFields = visibleInputs.filter(
      (input) =>
        ['email', 'text', 'tel'].includes(input.type) &&
        input.value &&
        input !== passwordField &&
        !this.shouldIgnoreFieldForCapture(input) &&
        !this.isCaptchaFieldForCapture(input)
    )

    if (usernameFields.length === 0) {
      const hiddenUsernameFields = inputs.filter((input) => {
        if (this.isFieldVisible(input)) return false
        if (!['email', 'text', 'tel'].includes(input.type)) return false
        if (!input.value) return false
        if (input === passwordField) return false
        if (this.shouldIgnoreFieldForCapture(input)) return false
        if (this.isCaptchaFieldForCapture(input)) return false

        const fieldType = this.identifyFieldType(input)
        const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase()
        return (
          fieldType === FIELD_TYPES.USERNAME ||
          fieldType === FIELD_TYPES.EMAIL ||
          autocomplete === 'username' ||
          autocomplete === 'email'
        )
      })

      if (hiddenUsernameFields.length > 0) {
        const hiddenUsernameField = hiddenUsernameFields[0]
        log.info('Username field found (hidden fallback):', {
          name: hiddenUsernameField.name,
          id: hiddenUsernameField.id
        })
        return {
          username: hiddenUsernameField.value,
          password: resolvedPassword,
          url: window.location.href
        }
      }

      if (fallbackUsername) {
        if (this.isEdevletDomain()) {
          log.info('⏭️ e-Devlet detected, skipping fallback username')
          return null
        }
        return {
          username: fallbackUsername,
          password: resolvedPassword,
          url: window.location.href
        }
      }
      if (allowMissingUsername) {
        return {
          username: '',
          password: resolvedPassword,
          url: window.location.href
        }
      }
      log.info('No username field found with value')
      return null
    }

    // Prioritize by field name/id patterns
    const usernamePatterns = [
      /^email$/i,
      /^e-?mail$/i,
      /^user_?login$/i, // WordPress
      /^log$/i, // WordPress short form
      /^user_?name$/i,
      /^username$/i,
      /^user$/i,
      /^login$/i,
      /^account$/i
    ]

    let usernameField = null

    // Try to find field by pattern
    for (const pattern of usernamePatterns) {
      usernameField = usernameFields.find(
        (input) => pattern.test(input.name) || pattern.test(input.id)
      )
      if (usernameField) {
        log.info('Username field found by pattern:', {
          name: usernameField.name,
          id: usernameField.id,
          pattern: pattern.toString()
        })
        break
      }
    }

    // If no pattern match, use the first visible text/email field
    if (!usernameField) {
      usernameField = usernameFields[0]
      log.info('Username field found (first available):', {
        name: usernameField.name,
        id: usernameField.id
      })
    }

    if (!usernameField || !usernameField.value) {
      log.info('No valid username field')
      return null
    }

    const result = {
      username: usernameField.value,
      password: resolvedPassword,
      url: window.location.href
    }

    log.success('✅ Credentials extracted:', {
      username: result.username,
      passwordLength: result.password.length,
      url: result.url
    })

    return result
  }

  /**
   * Check if the current form submission looks like a login form
   * rather than logout, registration, or other forms
   * @param {Object} credentials - {username, password, url}
   * @returns {boolean} True if this appears to be a login form
   * @private
   */
  isLikelyLoginForm(credentials) {
    // Must have both username and password for login forms
    if (!credentials?.username?.trim() || !credentials?.password?.trim()) {
      log.info('🚫 Missing username or password, not a login form')
      return false
    }

    // Check for logout-related elements on the page
    const logoutSelectors = [
      'button[type="submit"]:contains("logout")',
      'button[type="submit"]:contains("sign out")',
      'button[type="submit"]:contains("log out")',
      'a:contains("logout")',
      'a:contains("sign out")',
      'a:contains("log out")',
      'form[action*="logout"]',
      'form[action*="signout"]',
      'form[action*="sign-out"]',
      '[data-testid*="logout"]',
      '[data-cy*="logout"]',
      '.logout',
      '#logout'
    ]

    // Check if last button click was logout-related
    if (this.lastButtonClick && this.lastButtonClick.isLogoutRelated) {
      const timeSinceClick = Date.now() - this.lastButtonClick.timestamp
      if (timeSinceClick < 5000) { // Within 5 seconds
        log.info('🚫 Recent logout button click detected, not offering save')
        return false
      }
    }

    // Check if form action indicates logout or redirect after logout
    const formAction = document.activeElement?.closest('form')?.action || ''
    const currentUrl = window.location.href
    const isSignInPage = currentUrl.includes('/sign-in') || currentUrl.includes('/login')
    const isLogoutAction = formAction.includes('logout') || formAction.includes('signout') || formAction.includes('sign-out')

    if (isLogoutAction) {
      log.info('🚫 Form action indicates logout, not offering save')
      return false
    }

    // Check for redirect loop patterns (common after logout)
    if (isSignInPage && document.referrer) {
      const referrerDomain = new URL(document.referrer).hostname
      const currentDomain = new URL(currentUrl).hostname
      if (referrerDomain === currentDomain) {
        // Same domain redirect to sign-in page - likely post-logout
        log.info('🚫 Redirect to sign-in from same domain detected, likely post-logout')
        return false
      }
    }

    for (const selector of logoutSelectors) {
      try {
        // Simple text contains check for buttons/links
        if (selector.includes(':contains(')) {
          const textMatch = selector.match(/:contains\("([^"]+)"\)/i)
          if (textMatch) {
            const searchText = textMatch[1].toLowerCase()
            const elements = document.querySelectorAll('button, a, input[type="submit"]')
            for (const el of elements) {
              if (el.textContent?.toLowerCase().includes(searchText)) {
                log.info(`🚫 Found logout element with text "${searchText}", not offering save`)
                return false
              }
            }
          }
        } else {
          // Regular selector check
          const elements = document.querySelectorAll(selector)
          if (elements.length > 0) {
            log.info(`🚫 Found logout element matching "${selector}", not offering save`)
            return false
          }
        }
      } catch (e) {
        // Ignore invalid selectors
      }
    }

    // Check if this is within a reasonable time after page load
    // (logout forms are often triggered immediately after login)
    const timeSinceLoad = Date.now() - (window.performance?.timing?.navigationStart || Date.now())
    if (timeSinceLoad < 2000) {
      // Very quick form submissions might be logout/redirect forms
      log.info('🚫 Form submitted too quickly after page load, likely not a login')
      return false
    }

    log.info('✅ Form appears to be a login form')
    return true
  }

  /**
   * Check if inputs contain a visible password field
   * @param {HTMLInputElement[]} inputs
   * @returns {boolean}
   * @private
   */
  hasVisiblePasswordInput(inputs) {
    if (!Array.isArray(inputs)) return false
    const result = inputs.some((input) => {
      if (!input || input.tagName !== 'INPUT') return false
      if (!this.isFieldVisible(input)) return false
      if (this.shouldIgnoreFieldForCapture(input)) return false
      return this.isPasswordLikeInput(input)
    })
    return result
  }

  /**
   * Treat password reveal inputs as password-like
   * @param {HTMLInputElement} input
   * @returns {boolean}
   * @private
   */
  isPasswordLikeInput(input) {
    const inputType = (input?.type || '').toLowerCase()
    const inputName = (input?.name || '').toLowerCase()
    const inputId = (input?.id || '').toLowerCase()
    const autocomplete = this.normalizeText(input?.autocomplete)

    return (
      inputType === INPUT_TYPES.PASSWORD ||
      autocomplete === 'current-password' ||
      autocomplete === 'new-password' ||
      inputName.includes('password') ||
      inputName.includes('passwd') ||
      inputName.includes('pwd') ||
      inputId.includes('password') ||
      inputId.includes('passwd') ||
      inputId.includes('pwd')
    )
  }

  isCaptchaFieldForCapture(input) {
    if (!input) return false
    const type = (input.type || '').toLowerCase()
    const name = (input.name || '').toLowerCase()
    const id = (input.id || '').toLowerCase()
    const placeholder = (input.placeholder || '').toLowerCase()
    const ariaLabel = (input.getAttribute?.('aria-label') || '').toLowerCase()
    const labelText = (input.getAttribute?.('title') || '').toLowerCase()
    const combined = [name, id, placeholder, ariaLabel, labelText].join(' ')

    const keywordMatch =
      combined.includes('captcha') ||
      combined.includes('güvenlik') ||
      combined.includes('guvenlik') ||
      combined.includes('doğrulama') ||
      combined.includes('dogrulama') ||
      combined.includes('verification') ||
      combined.includes('security code') ||
      combined.includes('güvenlik kodu') ||
      combined.includes('guvenlik kodu')

    if (keywordMatch) return true

    if (type === 'text') {
      const maxLength = Number(input.maxLength || 0)
      if (maxLength > 0 && maxLength <= 6) {
        return true
      }
    }

    return false
  }

  /**
   * Reset save-offer state when domain changes
   * @param {string} nextDomain
   * @private
   */
  resetSaveOfferStateIfDomainChanged(nextDomain) {
    const normalized = String(nextDomain || '').trim()
    if (!normalized) return
    if (this.saveOfferDomain && this.saveOfferDomain === normalized) {
      return
    }

    this.saveOfferDomain = normalized
    this.saveOfferHistory?.clear?.()
    this.saveOfferInFlight?.clear?.()
    this.blockSaveOffer = false
  }

  /**
   * Build a stable key for save offer dedupe
   * @param {Object} credentials
   * @param {string} intent
   * @returns {Promise<string>}
   * @private
   */
  async buildSaveOfferKey(credentials, intent) {
    const username = String(credentials?.username || '').trim().toLowerCase()
    const domain = getDomain(credentials?.url || '') || this.domain || ''
    const password = credentials?.password || ''
    let passwordDigest = ''

    if (password) {
      try {
        const data = new TextEncoder().encode(String(password))
        const digest = await crypto.subtle.digest('SHA-256', data)
        const bytes = new Uint8Array(digest)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        passwordDigest = btoa(binary)
      } catch {
        passwordDigest = ''
      }
    }

    return [domain, intent || '', username, passwordDigest].join('|')
  }

  /**
   * Check if we should offer to save these credentials.
   * Note: password is optional, but used to prefill the popup.
   * @param {Object} credentials - {username, password, url}
   * @private
   */
  async checkIfShouldOfferSave(credentials, options = {}) {
    log.info('🔍 Checking if should offer save...')
    const intent = options.intent || FORM_INTENTS.LOGIN

    if (this.isVaultDomain()) {
      log.info('⏭️ Vault domain detected, skipping save offer')
      return
    }

    if (this.blockSaveOffer) {
      log.info('⏭️ Save offer blocked (logout flow), skipping')
      return
    }

    let offerKey = null
    try {
      offerKey = await this.buildSaveOfferKey(credentials, intent)
    } catch {
      offerKey = null
    }

    if (offerKey) {
      if (this.saveOfferHistory?.has?.(offerKey) || this.saveOfferInFlight?.has?.(offerKey)) {
        log.info('⏭️ Duplicate save offer detected, skipping')
        return
      }
      this.saveOfferInFlight?.add?.(offerKey)
    }

    // Don't show notification multiple times
    if (this.saveNotificationShown) {
      log.info('⏭️ Save notification already shown, skipping')
      if (offerKey) {
        this.saveOfferInFlight?.delete?.(offerKey)
      }
      return
    }

    // Don't offer save for recently saved credentials (within 60 seconds)
    if (this.recentlySavedCredentials) {
      const timeSinceLastSave = Date.now() - this.recentlySavedCredentials.at
      if (timeSinceLastSave < 60000) {
        // Check if it's the same credentials
        // Compare domains instead of full URLs (to handle navigation within same site)
        const savedDomain = this.recentlySavedCredentials.url ? getDomain(this.recentlySavedCredentials.url) : ''
        const currentDomain = credentials?.url ? getDomain(credentials.url) : ''
        
        if (
          this.recentlySavedCredentials.username === credentials?.username &&
          savedDomain === currentDomain &&
          savedDomain // Ensure domain is not empty
        ) {
          // If password provided, also check password digest
          if (credentials?.password) {
            try {
              const data = new TextEncoder().encode(credentials.password)
              const digest = await crypto.subtle.digest('SHA-256', data)
              const bytes = new Uint8Array(digest)
              let binary = ''
              for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i])
              }
              const passwordDigest = btoa(binary)
              
              if (this.recentlySavedCredentials.passwordDigest === passwordDigest) {
                log.info('⏭️ Credentials recently saved, skipping offer')
                return
              }
            } catch (err) {
              log.warn('Failed to digest password for comparison:', err)
            }
          } else {
            // No password in current credentials, just check username/domain
            log.info('⏭️ Credentials recently saved (no pwd check), skipping offer')
            return
          }
        }
      }
    }

    // Security check
    const securityCheck = checkCurrentPageSecurity()
    if (!securityCheck.allowed) {
      log.warn('🔒 Security check failed, not offering to save:', securityCheck.reason)
      return
    }

    log.info('🔐 Security check passed, proceeding...')

    // Check if this looks like a login form (not logout, registration, etc.)
    if (intent === FORM_INTENTS.LOGOUT) {
      log.info('🚫 Logout intent detected, skipping save offer')
      if (offerKey) {
        this.saveOfferInFlight?.delete?.(offerKey)
      }
      return
    }

    if (intent === FORM_INTENTS.LOGIN && !this.isLikelyLoginForm(credentials)) {
      log.info('🚫 Form does not appear to be a login form, skipping save offer')
      if (offerKey) {
        this.saveOfferInFlight?.delete?.(offerKey)
      }
      return
    }

    if (intent === FORM_INTENTS.SIGNUP && !credentials?.password) {
      log.info('🚫 Signup intent but password missing, skipping save offer')
      if (offerKey) {
        this.saveOfferInFlight?.delete?.(offerKey)
      }
      return
    }

    if (
      intent === FORM_INTENTS.SIGNUP &&
      (!credentials?.username || String(credentials.username).trim().length === 0)
    ) {
      log.info('🆕 Signup detected without username - offering SAVE with password only')
      await sendPayload({
        type: EVENT_TYPES.SET_PENDING_SAVE,
        payload: {
          username: '',
          password: credentials.password,
          url: credentials.url,
          domain: this.domain,
          action: 'add',
          title: this.domain,
          manual: true
        }
      })
      this.showSaveNotification(
        { username: '', password: credentials.password, url: credentials.url },
        'add',
        null,
        null,
        'offer_add_signup_no_username'
      )
      if (offerKey) {
        this.saveOfferInFlight?.delete?.(offerKey)
        this.saveOfferHistory?.add?.(offerKey)
      }
      return
    }

    // Check if we already have this login
    try {
      log.info('📡 Fetching existing logins for domain:', this.domain)

      const existingLogins = await sendPayload({
        type: EVENT_TYPES.REQUEST_PASSWORDS,
        payload: this.domain
      })

      log.info(`📦 Found ${existingLogins.length} existing login(s)`)
      const emptyUsernameCount = (existingLogins || []).filter(
        (l) => !l?.username || String(l.username).trim().length === 0
      ).length

      const raw = credentials.username || ''
      const normalized = raw.trim().toLowerCase()
      const normalizedMatch = existingLogins.find(
        (login) => (login.username || '').trim().toLowerCase() === normalized
      )
      const usernameMatch = existingLogins.find((login) => login.username === credentials.username)

      const match = usernameMatch || normalizedMatch
      if (match) {
        // Additional check: ensure password is present and not empty/placeholder for updates
        if (!credentials.password || credentials.password.trim().length === 0) {
          log.info('🚫 Password is empty or missing, not offering update (likely logout form)')
          return
        }

        log.success(`🔄 Username exists - offering UPDATE`)
        log.info('Existing login:', { id: match.id, title: match.title })
        // Update pending metadata in background (no password re-sent)
        await sendPayload({
          type: EVENT_TYPES.SET_PENDING_SAVE,
          payload: {
            username: credentials.username,
            password: credentials.password,
            domain: this.domain,
            action: 'update',
            loginId: match.id,
            title: match.title || this.domain
          }
        })

        // Pass existing login data to popup (no password)
        this.showSaveNotification(
          { username: credentials.username, password: credentials.password, url: credentials.url },
          'update',
          match.id,
          match,
          'offer_update'
        )
        if (offerKey) {
          this.saveOfferInFlight?.delete?.(offerKey)
          this.saveOfferHistory?.add?.(offerKey)
        }
        return
      }

      // New login - offer to save
      log.success('🆕 New login detected - offering to SAVE')
      await sendPayload({
        type: EVENT_TYPES.SET_PENDING_SAVE,
        payload: {
          username: credentials.username,
          domain: this.domain,
          action: 'add',
          title: this.domain
        }
      })
      this.showSaveNotification(
        { username: credentials.username, password: credentials.password, url: credentials.url },
        'add',
        null,
        null,
        'offer_add'
      )
      if (offerKey) {
        this.saveOfferInFlight?.delete?.(offerKey)
        this.saveOfferHistory?.add?.(offerKey)
      }
    } catch (error) {
      log.error('❌ Error checking existing logins:', error)
      if (offerKey) {
        this.saveOfferInFlight?.delete?.(offerKey)
      }

      // Handle authentication errors
      if (error.type === 'NO_AUTH' || error.type === 'AUTH_EXPIRED') {
        log.warn('⚠️ Authentication required:', error.message)
        this.showAuthRequiredNotification(error.message)
        return
      }

      // If no existing logins for this domain, offer to save new
      if (error.type === 'NO_LOGINS') {
        log.info('ℹ️ No existing logins for this domain, offering to save new')
        await sendPayload({
          type: EVENT_TYPES.SET_PENDING_SAVE,
          payload: {
            username: credentials.username,
            domain: this.domain,
            action: 'add',
            title: this.domain
          }
        })
        this.showSaveNotification(
          { username: credentials.username, password: credentials.password, url: credentials.url },
          'add',
          null,
          null,
          'offer_add_no_logins'
        )
        return
      }

      // For other errors (network, etc.), log but don't show notification
      log.error('💥 Failed to check existing logins:', error.message || error)
      // Optionally show a non-intrusive notification
      console.warn(
        '[Passwall] Could not check existing logins. Please ensure you are logged in to Passwall extension.'
      )
    }
  }

  /**
   * Show save notification popup
   * @param {Object} credentials - {username, password, url}
   * @param {string} action - 'add' or 'update'
   * @param {string} loginId - ID of login to update (if action is 'update')
   * @param {Object} existingLogin - Existing login data (for update, to show current title)
   * @private
   */
  async showSaveNotification(
    credentials,
    action = 'add',
    loginId = null,
    existingLogin = null,
    source = 'unknown'
  ) {
    this.saveNotificationShown = true
    this.submittedFormData = { credentials, action, loginId, existingLogin }

    const extensionOrigin = browser.runtime.getURL('').replace(/\/$/, '')
    const nonce = generateNonce()

    // Create iframe for save notification
    const iframe = document.createElement('iframe')
    iframe.id = 'passwall-save-notification'
    iframe.src = browser.runtime.getURL(
      `src/popup/index.html?pw_nonce=${nonce}#/Inject/savePassword`
    )
    iframe.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      width: 380px !important;
      max-height: 90vh !important;
      height: auto !important;
      min-height: 200px !important;
      border: none !important;
      border-radius: 12px !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15) !important;
      z-index: 2147483647 !important;
      opacity: 0 !important;
      transform: translateY(-20px) !important;
      transition: opacity 0.3s ease, transform 0.3s ease, height 0.3s ease !important;
    `

    document.body.appendChild(iframe)

    // Fade in animation
    setTimeout(() => {
      iframe.style.opacity = '1'
      iframe.style.transform = 'translateY(0)'
    }, 100)

    // Register message route for this iframe (validated in handlePopupMessage)
    const sourceWindow = iframe.contentWindow
    if (sourceWindow) {
      this.saveNotificationRoute = { sourceWindow, nonce }
      this.messageRoutes.push({
        sourceWindow,
        origin: extensionOrigin,
        nonce,
        handler: (message) => {
          if (message?.type === 'PASSWALL_SAVE_READY') {
            sendDataToIframe()
            return
          }

          if (message?.type === 'PASSWALL_SAVE_RESIZE') {
            const height = message?.data?.height
            if (height && iframe) {
              iframe.style.height = `${height}px`
            }
            return
          }

          if (message?.type === 'PASSWALL_SAVE_CONFIRMED') {
            this.handleSaveConfirmed({ data: { data: message.data } })
            return
          }

          if (message?.type === 'PASSWALL_SAVE_CANCELLED') {
            this.handleSaveCancelled()
          }
        }
      })
    }

    const sendDataToIframe = () => {
      try {
        // Use existing login's title for update, or domain for new
        const displayTitle = existingLogin?.title || this.domain
        const resolvedFolderId =
          credentials?.folder_id !== undefined && credentials?.folder_id !== null
            ? credentials.folder_id
            : existingLogin?.folder_id ?? null
        const resolvedAutoFill =
          typeof credentials?.auto_fill === 'boolean'
            ? credentials.auto_fill
            : existingLogin?.auto_fill ?? true
        const resolvedAutoLogin =
          typeof credentials?.auto_login === 'boolean'
            ? credentials.auto_login
            : existingLogin?.auto_login ?? false
        const resolvedReprompt =
          typeof credentials?.reprompt === 'boolean'
            ? credentials.reprompt
            : existingLogin?.reprompt ?? false

        iframe.contentWindow.postMessage(
          JSON.stringify({
            type: 'PASSWALL_SAVE_INIT',
            data: {
              username: credentials.username,
              password: credentials.password,
              folder_id: resolvedFolderId,
              auto_fill: resolvedAutoFill,
              auto_login: resolvedAutoLogin,
              reprompt: resolvedReprompt,
              url: credentials.url,
              domain: this.domain,
              title: displayTitle, // Use existing title for update
              action,
              loginId
            }
          }),
          extensionOrigin
        )
        log.success('📤 Data sent to iframe with title:', displayTitle)
      } catch (error) {
        log.error('Error sending data to iframe:', error)
      }
    }

    // Note: init data is sent after PASSWALL_SAVE_READY handshake to avoid SPA mount race

    // Cleanup after 90 seconds if not interacted
    setTimeout(() => {
      const existingIframe = document.getElementById('passwall-save-notification')
      if (existingIframe) {
        existingIframe.style.opacity = '0'
        existingIframe.style.transform = 'translateY(-20px)'
        setTimeout(() => {
          existingIframe.remove()
          this.saveNotificationShown = false
        }, 300)
      }
      if (this.saveNotificationRoute?.sourceWindow) {
        const sw = this.saveNotificationRoute.sourceWindow
        this.messageRoutes = this.messageRoutes.filter((r) => r.sourceWindow !== sw)
      }
      this.saveNotificationRoute = null
    }, 90000)

    log.success('Save notification displayed')
  }

  /**
   * Handle save confirmed by user
   * @private
   */
  async handleSaveConfirmed(event) {
    // Extract data from message event - ALWAYS use event data (from popup)
    const data = event?.data?.data

    if (!data) {
      log.error('❌ No data to save from popup')
      return
    }

    log.info('💾 User confirmed save, sending to background...')

    try {
      await sendPayload({
        type: EVENT_TYPES.CONFIRM_PENDING_SAVE,
        payload: {
          username: data.username,
          password: data.password,
          folder_id: data.folder_id,
          auto_fill: data.auto_fill,
          auto_login: data.auto_login,
          reprompt: data.reprompt,
          url: data.url,
          domain: data.domain || this.domain,
          title: data.title,
          action: data.action,
          loginId: data.loginId
        }
      })

      log.success('✅ Credentials saved successfully!')
      
      try {
        const refreshDomain = getDomain(data?.url) || data?.domain || this.domain
        const updatedLogins = await sendPayload({
          type: EVENT_TYPES.REQUEST_PASSWORDS,
          payload: refreshDomain
        })
        this.logins = updatedLogins
        this.authError = null
      } catch (refreshError) {
        if (refreshError?.type === 'NO_LOGINS') {
          this.logins = []
          this.authError = 'NO_LOGINS'
        } else if (refreshError?.type === 'NO_AUTH' || refreshError?.type === 'AUTH_EXPIRED') {
          this.logins = []
          this.authError = 'NO_AUTH'
        }
      }

      // Record saved credentials to prevent duplicate offers
      if (data.password) {
        try {
          const pwdData = new TextEncoder().encode(data.password)
          const digest = await crypto.subtle.digest('SHA-256', pwdData)
          const bytes = new Uint8Array(digest)
          let binary = ''
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i])
          }
          const passwordDigest = btoa(binary)
          
          this.recentlySavedCredentials = {
            username: data.username,
            url: data.url,
            passwordDigest,
            at: Date.now()
          }
        } catch (err) {
          log.warn('Failed to record saved credentials:', err)
        }
      } else {
        this.recentlySavedCredentials = {
          username: data.username,
          url: data.url,
          passwordDigest: null,
          at: Date.now()
        }
      }
      
      this.showSaveSuccessMessage()
    } catch (error) {
      log.error('❌ Error saving credentials:', error)
      this.showSaveErrorMessage()
    } finally {
      this.removeSaveNotification()
    }
  }

  /**
   * Handle save cancelled by user
   * @private
   */
  handleSaveCancelled() {
    log.info('User cancelled save')
    sendPayload({ type: EVENT_TYPES.DISMISS_PENDING_SAVE, payload: {} }).catch(() => {})
    this.removeSaveNotification()
  }

  /**
   * Remove save notification
   * @private
   */
  removeSaveNotification() {
    const iframe = document.getElementById('passwall-save-notification')
    if (iframe) {
      iframe.style.opacity = '0'
      iframe.style.transform = 'translateY(-20px)'
      setTimeout(() => {
        iframe.remove()
        this.saveNotificationShown = false
        this.submittedFormData = null

        if (this.saveNotificationRoute?.sourceWindow) {
          const sw = this.saveNotificationRoute.sourceWindow
          this.messageRoutes = this.messageRoutes.filter((r) => r.sourceWindow !== sw)
        }
        this.saveNotificationRoute = null
      }, 300)
    }
  }

  /**
   * Show success message after save
   * @private
   */
  showSaveSuccessMessage() {
    const message = document.createElement('div')
    message.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      padding: 16px 24px !important;
      background: #10b981 !important;
      color: white !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
      z-index: 2147483647 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
      font-size: 14px !important;
      font-weight: 500 !important;
      opacity: 0 !important;
      transform: translateY(-20px) !important;
      transition: opacity 0.3s ease, transform 0.3s ease !important;
    `
    message.textContent = '✓ Password saved successfully!'
    document.body.appendChild(message)

    setTimeout(() => {
      message.style.opacity = '1'
      message.style.transform = 'translateY(0)'
    }, 100)

    setTimeout(() => {
      message.style.opacity = '0'
      message.style.transform = 'translateY(-20px)'
      setTimeout(() => message.remove(), 300)
    }, 3000)
  }

  /**
   * Show authentication required notification
   * @param {string} message - Custom error message
   * @private
   */
  showAuthRequiredNotification(message = 'Please login to Passwall extension') {
    // Remove any existing auth notification
    const existing = document.getElementById('passwall-auth-notification')
    if (existing) {
      existing.remove()
    }

    const notification = document.createElement('div')
    notification.id = 'passwall-auth-notification'
    notification.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      color: white !important;
      padding: 16px 20px !important;
      border-radius: 12px !important;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2) !important;
      z-index: 2147483647 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 14px !important;
      font-weight: 500 !important;
      opacity: 0 !important;
      transform: translateY(-20px) !important;
      transition: opacity 0.3s ease, transform 0.3s ease !important;
      cursor: pointer !important;
      max-width: 320px !important;
    `

    const wrapper = document.createElement('div')
    wrapper.style.display = 'flex'
    wrapper.style.alignItems = 'center'
    wrapper.style.gap = '12px'

    const svgNS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(svgNS, 'svg')
    svg.setAttribute('width', '24')
    svg.setAttribute('height', '24')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', 'currentColor')
    svg.setAttribute('stroke-width', '2')

    const rect = document.createElementNS(svgNS, 'rect')
    rect.setAttribute('x', '3')
    rect.setAttribute('y', '11')
    rect.setAttribute('width', '18')
    rect.setAttribute('height', '11')
    rect.setAttribute('rx', '2')
    rect.setAttribute('ry', '2')

    const path = document.createElementNS(svgNS, 'path')
    path.setAttribute('d', 'M7 11V7a5 5 0 0 1 10 0v4')

    svg.appendChild(rect)
    svg.appendChild(path)

    const textBox = document.createElement('div')

    const titleEl = document.createElement('div')
    titleEl.style.fontWeight = '600'
    titleEl.style.marginBottom = '4px'
    titleEl.textContent = 'Authentication Required'

    const messageEl = document.createElement('div')
    messageEl.style.fontSize = '13px'
    messageEl.style.opacity = '0.9'
    messageEl.textContent = String(message || 'Please login to Passwall extension')

    const hintEl = document.createElement('div')
    hintEl.style.fontSize = '12px'
    hintEl.style.marginTop = '6px'
    hintEl.style.opacity = '0.8'
    hintEl.textContent = 'Click to open Passwall extension'

    textBox.appendChild(titleEl)
    textBox.appendChild(messageEl)
    textBox.appendChild(hintEl)

    wrapper.appendChild(svg)
    wrapper.appendChild(textBox)
    notification.appendChild(wrapper)

    // Open extension popup when clicked
    notification.addEventListener('click', async () => {
      try {
        const res = await browser.runtime.sendMessage({ type: 'OPEN_POPUP', who: 'content-script' })
        // If we could open the popup, close the notification; otherwise keep it so user can click the icon.
        if (res?.ok === true) {
          notification.remove()
        } else {
          hintEl.textContent = 'Please click the Passwall extension icon to sign in'
        }
      } catch {
        hintEl.textContent = 'Please click the Passwall extension icon to sign in'
      }
    })

    document.body.appendChild(notification)

    // Fade in animation
    setTimeout(() => {
      notification.style.opacity = '1'
      notification.style.transform = 'translateY(0)'
    }, 100)

    // Auto remove after 8 seconds
    setTimeout(() => {
      notification.style.opacity = '0'
      notification.style.transform = 'translateY(-20px)'
      setTimeout(() => notification.remove(), 300)
    }, 8000)
  }

  /**
   * Show error message after failed save
   * @private
   */
  showSaveErrorMessage() {
    const message = document.createElement('div')
    message.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      padding: 16px 24px !important;
      background: #ef4444 !important;
      color: white !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
      z-index: 2147483647 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
      font-size: 14px !important;
      font-weight: 500 !important;
      opacity: 0 !important;
      transform: translateY(-20px) !important;
      transition: opacity 0.3s ease, transform 0.3s ease !important;
    `
    message.textContent = '✗ Failed to save password'
    document.body.appendChild(message)

    setTimeout(() => {
      message.style.opacity = '1'
      message.style.transform = 'translateY(0)'
    }, 100)

    setTimeout(() => {
      message.style.opacity = '0'
      message.style.transform = 'translateY(-20px)'
      setTimeout(() => message.remove(), 300)
    }, 3000)
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Immediately inject - no delay
    new ContentScriptInjector()
  })
} else {
  // Already loaded - inject immediately
  new ContentScriptInjector()
}
