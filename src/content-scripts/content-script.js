import browser from 'webextension-polyfill'
import { EVENT_TYPES } from '@/utils/constants'
import { getHostName, getDomain, PFormParseError, sendPayload } from '@/utils/helpers'
import { shouldExcludeField, getPlatformInfo, getPlatformRules } from '@/utils/platform-rules'
import { checkCurrentPageSecurity, SECURITY_WARNINGS } from '@/utils/security-checks'
import { LoginAsPopup } from './LoginAsPopup'
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
    this.lastAutofill = null // { at, username, passwordDigest }

    this.initialize()
  }

  /**
   * Initialize event listeners and bindings
   * @private
   */
  initialize() {
    // Set domain first
    this.domain = getHostName(window.location.href)

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

    // NEW: Check for pending save from background (after redirect)
    this.checkPendingSave()

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
    const extensionOrigin = browser.runtime.getURL('').replace(/\/$/, '')
    if (event.origin !== extensionOrigin) {
      return
    }

    const route = this.messageRoutes.find((r) => r.sourceWindow === event.source)
    if (!route) return

    // Nonce is mandatory for routed messages
    if (typeof message?.nonce !== 'string' || message.nonce !== route.nonce) {
      return
    }

    route.handler(message, event)
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
        this.authError = null
        this.injectLogo()

        log.success(`Passwall ready: ${logins.length} login(s) for ${this.domain}`)
      } catch (error) {
        // Handle authentication and no logins errors
        if (error.type === 'NO_AUTH' || error.type === 'AUTH_EXPIRED') {
          // User not logged in - still show logo but with empty logins
          // Popup will show authentication message
          this.logins = []
          this.authError = 'NO_AUTH'
          this.injectLogo()
          // Also surface an in-page notification; background will open login UI best-effort.
          this.showAuthRequiredNotification(error?.message)
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
      if (error instanceof PFormParseError && error.type === 'NO_PASSWORD_FIELD') {
        // Enhanced: No password field found - check for multi-step login
        log.info('No password field found - checking for multi-step login...')
        this.checkForMultiStepLogin()
      } else {
        log.error('Form detection error:', error)
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
    })

    // Observe entire document for changes (with safety check)
    if (document.body) {
      this.mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
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
            subtree: true
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
   * Identify the type/purpose of an input field using heuristics
   * Note: Platform-specific exclusions (account IDs, etc.) are handled separately
   * via shouldExcludeField() - this method only identifies credential fields
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

    // Get associated label text
    const label = this.getAssociatedLabel(input)
    const labelText = label ? (label.textContent || '').toLowerCase() : ''

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
      (input) => input.type === 'password' && this.isFieldVisible(input)
    )

    log.info(`Found ${passwordFields.length} password field(s)`)

    // For each password field, find associated username field
    passwordFields.forEach((passwordField) => {
      // Skip if already processed
      if (this.processedFields.has(passwordField)) return

      const usernameField = this.findUsernameFieldNear(passwordField)

      if (usernameField) {
        const form = passwordField.closest('form') // May be null for formless

        loginFields.push({
          username: usernameField,
          password: passwordField,
          form: form,
          detectMethod: 'formless'
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
          detectMethod: 'formless-password-page'
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

      // EXCLUDE: Platform-specific fields (account IDs, organization IDs, etc.)
      if (shouldExcludeField(input, this.domain)) {
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

      const label = this.getAssociatedLabel(input)
      const labelText = label ? (label.textContent || '').toLowerCase() : ''

      const allText = [
        attributes.name,
        attributes.id,
        attributes.placeholder,
        attributes.ariaLabel,
        labelText
      ].join(' ')

      // EXCLUDE: Search boxes, search bars (Gmail, etc.)
      if (
        /search|query|q\b|buscar|suche|recherche|検索/.test(allText) ||
        attributes.role === 'searchbox' ||
        attributes.role === 'search' ||
        attributes.type === 'search' ||
        attributes.name === 'q' ||
        attributes.id === 'q'
      ) {
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

    log.success(`🔍 Multi-step login detected: ${likelyLoginFields.length} field(s)`)

    // Create pseudo login fields for multi-step
    this.loginFields = likelyLoginFields.map((field) => ({
      username: field,
      password: null, // No password yet (multi-step)
      form: field.closest('form'),
      detectMethod: 'multi-step'
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
      log.warn(`Multi-step logo injected with security warning: ${securityCheck.warningType}`)
      return
    }

    // Try to fetch logins
    try {
      const logins = await sendPayload({
        type: EVENT_TYPES.REQUEST_LOGINS,
        payload: this.domain
      })

      this.logins = logins
      this.authError = null
      log.success(`Passwall ready (multi-step): ${logins.length} login(s) for ${this.domain}`)
    } catch (error) {
      if (error.type === 'NO_AUTH' || error.type === 'AUTH_EXPIRED') {
        this.logins = []
        this.authError = 'NO_AUTH'
        this.showAuthRequiredNotification(error?.message)
        log.warn('User not authenticated - logo will prompt login (multi-step)')
      } else if (error.type === 'NO_LOGINS') {
        this.logins = []
        this.authError = 'NO_LOGINS'
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
      (input) => input.type === 'password' && this.isFieldVisible(input)
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

      // Valid login form must have at least one password field
      const passwordField = inputs.find((input) => input.type === INPUT_TYPES.PASSWORD)
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
        if (shouldExcludeField(input, this.domain)) {
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
            detectMethod: 'form-based-password-page'
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
          detectMethod: 'form-based'
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
      (input) => relevantTypes.includes(input.type) && this.isFieldVisible(input)
    )
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
      const targetField = loginField.username

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
        this.showLoginSelector(targetField, event)
      )

      logo.render()
      this.logos.push(logo)

      const methodLabel = loginField.detectMethod || 'unknown'
      log.success(`🎨 Logo injected for ${methodLabel} login #${index + 1}`)
    })
  }

  /**
   * Show login selection popup
   * @param {HTMLElement} targetInput - Input element to position popup near
   * @private
   */
  showLoginSelector(targetInput, clickEvent) {
    // Require a trusted user gesture to open the autofill UI
    if (!clickEvent?.isTrusted) {
      return
    }

    const logins = this.logins || []
    log.info(`🚀 Logo clicked! Creating popup with ${logins.length} logins`)

    const popup = new LoginAsPopup(
      targetInput,
      logins,
      this.forms,
      this.authError,
      ({ at, username, passwordDigest }) => {
        this.lastAutofill = { at, username, passwordDigest }
      }
    )

    popup.render()
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
            return
          }
          popup.messageHandler(message)
        }
      })
    }
    log.success('Popup rendered and ready')
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

    // Clear data
    this.logins = []
    this.authError = null
    this.forms = []
    this.loginFields = []
    this.popupMessageListeners = []
    this.processedFields = new WeakSet()
    this.submittedFormData = null
    this.saveNotificationShown = false
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
        { username: pending.username, url: pending.url },
        pending.action || 'add',
        pending.loginId || null,
        pending.title ? { title: pending.title } : null
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

    // Check if this is a password field
    const isPassword =
      inputType === 'password' ||
      inputName.includes('password') ||
      inputName.includes('passwd') ||
      inputId.includes('password') ||
      inputId.includes('passwd')

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

    // Try to use cached credentials first (from submit button click)
    let credentials = null
    const CACHE_VALID_MS = 2000 // Cache valid for 2 seconds

    if (this.cachedCredentials && Date.now() - this.cacheTimestamp < CACHE_VALID_MS) {
      log.info('✅ Using cached credentials from submit button click')
      credentials = this.cachedCredentials
    } else {
      // Fallback: Extract credentials from form IMMEDIATELY (before form clears)
      log.info('⚠️ No valid cache, extracting from form...')
      credentials = this.extractCredentialsFromForm(form)
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
        await sendPayload({
          type: EVENT_TYPES.SET_PENDING_SAVE,
          payload: {
            username: credentials.username,
            password: credentials.password,
            url: credentials.url,
            domain: this.domain,
            action: 'add'
          }
        })
      } catch (error) {
        log.error('Failed to set pending save in background:', error)
      }

      // Clear cache after use
      this.cachedCredentials = null
      this.cacheTimestamp = 0

      // Also try to show immediately (if no redirect)
      setTimeout(() => {
        this.checkIfShouldOfferSave({ username: credentials.username, url: credentials.url })
      }, 1000)
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
    const element = event.target

    // Check if this looks like a submit button
    if (!this.isSubmitButton(element)) {
      return
    }

    log.info('🔍 Submit button clicked, caching credentials...')

    // Find the nearest form or container
    const container = element.closest('form, div, section, main') || document.body

    // Extract credentials from container BEFORE form manipulates fields
    const credentials = this.extractCredentialsFromContainer(container)

    if (credentials) {
      log.info('✅ Credentials detected and cached:', {
        username: credentials.username,
        hasPassword: !!credentials.password
      })

      // Cache credentials for use in form submit handler
      this.cachedCredentials = credentials
      this.cacheTimestamp = Date.now()

      // For formless submissions (no form submit event), wait and offer save
      if (!element.closest('form')) {
        setTimeout(() => {
          this.checkIfShouldOfferSave(credentials)
        }, 1000)
      }
      // If there's a form, let form submit handler use cached credentials
    }
  }

  /**
   * Check if element is a submit button
   * @param {HTMLElement} element
   * @returns {boolean}
   * @private
   */
  isSubmitButton(element) {
    if (!element) return false

    const tagName = element.tagName.toLowerCase()
    const type = (element.type || '').toLowerCase()
    const role = (element.getAttribute('role') || '').toLowerCase()

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
  extractCredentialsFromForm(form) {
    const formInputs = Array.from(form.elements).filter(
      (el) => el.tagName === 'INPUT' && this.isFieldVisible(el)
    )

    return this.extractCredentialsFromInputs(formInputs)
  }

  /**
   * Extract credentials from container element
   * @param {HTMLElement} container
   * @returns {Object|null} - {username, password, url}
   * @private
   */
  extractCredentialsFromContainer(container) {
    const inputs = Array.from(container.querySelectorAll('input')).filter((el) =>
      this.isFieldVisible(el)
    )

    return this.extractCredentialsFromInputs(inputs)
  }

  /**
   * Extract credentials from input elements
   * @param {HTMLInputElement[]} inputs
   * @returns {Object|null} - {username, password, url}
   * @private
   */
  extractCredentialsFromInputs(inputs) {
    // Find password field (including common name variations)
    const passwordFields = inputs.filter((input) => input.type === 'password')

    const passwordField = inputs.find((input) => {
      if (input.type !== 'password') return false
      if (!input.value) return false

      // Common password field names
      const name = (input.name || '').toLowerCase()
      const id = (input.id || '').toLowerCase()

      // Accept any password field with value
      return true
    })

    if (!passwordField || !passwordField.value) {
      log.info('No password field found with value')
      return null
    }

    log.info('Password field found:', {
      name: passwordField.name,
      id: passwordField.id,
      hasValue: !!passwordField.value
    })

    // Find username field with priority order
    // 1. Email type inputs
    // 2. Inputs with username-related names (WordPress: user_login, log, etc.)
    // 3. Any text/tel input
    const usernameFields = inputs.filter(
      (input) =>
        ['email', 'text', 'tel'].includes(input.type) &&
        input.value &&
        input !== passwordField &&
        !shouldExcludeField(input, this.domain)
    )

    if (usernameFields.length === 0) {
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
      password: passwordField.value,
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
   * Check if we should offer to save these credentials.
   * Note: password is never needed here (candidates-only).
   * @param {Object} credentials - {username, url}
   * @private
   */
  async checkIfShouldOfferSave(credentials) {
    log.info('🔍 Checking if should offer save...')

    // Don't show notification multiple times
    if (this.saveNotificationShown) {
      log.info('⏭️ Save notification already shown, skipping')
      return
    }

    // Security check
    const securityCheck = checkCurrentPageSecurity()
    if (!securityCheck.allowed) {
      log.warn('🔒 Security check failed, not offering to save:', securityCheck.reason)
      return
    }

    log.info('🔐 Security check passed, proceeding...')

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
        log.success(`🔄 Username exists - offering UPDATE`)
        log.info('Existing login:', { id: match.id, title: match.title })
        // Update pending metadata in background (no password re-sent)
        await sendPayload({
          type: EVENT_TYPES.SET_PENDING_SAVE,
          payload: {
            username: credentials.username,
            domain: this.domain,
            action: 'update',
            loginId: match.id,
            title: match.title || this.domain
          }
        })

        // Pass existing login data to popup (no password)
        this.showSaveNotification(
          { username: credentials.username, url: credentials.url },
          'update',
          match.id,
          match
        )
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
      this.showSaveNotification({ username: credentials.username, url: credentials.url }, 'add')
    } catch (error) {
      log.error('❌ Error checking existing logins:', error)

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
        this.showSaveNotification({ username: credentials.username, url: credentials.url }, 'add')
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
  async showSaveNotification(credentials, action = 'add', loginId = null, existingLogin = null) {
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

        iframe.contentWindow.postMessage(
          JSON.stringify({
            type: 'PASSWALL_SAVE_INIT',
            data: {
              username: credentials.username,
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

    // Cleanup after 30 seconds if not interacted
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
    }, 30000)

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
          url: data.url,
          domain: data.domain || this.domain,
          title: data.title,
          action: data.action,
          loginId: data.loginId
        }
      })

      log.success('✅ Credentials saved successfully!')
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
