import browser from 'webextension-polyfill'
import { getOffset, sendPayload, getHostName } from '@/utils/helpers'
import { shouldIgnoreField } from '@/utils/platform-rules'
import totpService from '@/utils/totp'

const INPUT_TYPES = {
  PASSWORD: 'password',
  TEXT: 'text',
  EMAIL: 'email',
  NUMBER: 'number',
  TEL: 'tel'
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

const POPUP_CONFIG = {
  ID: 'passwall-login-as-popup',
  WIDTH: 350,
  INITIAL_HEIGHT: 206,
  BORDER: '1px solid #8b93a1',
  BORDER_RADIUS: '16px',
  Z_INDEX: 99999
}

const MESSAGE_TYPES = {
  RESIZE: 'LOGIN_AS_POPUP_RESIZE',
  FETCH: 'LOGIN_AS_POPUP_FETCH',
  FILL_FORM: 'LOGIN_AS_POPUP_FILL_FORM',
  CLOSE: 'LOGIN_AS_POPUP_CLOSE'
}

function generateNonce() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256Base64(input) {
  const data = new TextEncoder().encode(String(input || ''))
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(digest)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// Development logging
const DEV_MODE = false // Production mode
const log = {
  info: (...args) => DEV_MODE && console.log('🔵 [Popup]', ...args),
  success: (...args) => DEV_MODE && console.log('✅ [Popup]', ...args),
  error: (...args) => console.error('❌ [Popup]', ...args)
}

/**
 * LoginAsPopup - Displays login selection popup for auto-fill
 */
export class LoginAsPopup {
  /**
   * @param {HTMLInputElement} targetInput - Input element to position popup near
   * @param {Array<Object>} logins - Available logins for this domain
   * @param {Array<Object>} forms - Detected forms on page
   * @param {string} authError - Authentication error type (NO_AUTH, NO_LOGINS, or null)
   */
  constructor(targetInput, logins, forms, authError = null, onAutofill = null) {
    if (!targetInput || !forms) {
      throw new Error('LoginAsPopup requires targetInput and forms')
    }

    log.info(
      `🎯 LoginAsPopup constructor called with ${
        logins?.length || 0
      } logins, authError: ${authError}`
    )

    this.targetInput = targetInput
    this.logins = logins || []
    this.forms = forms
    this.authError = authError
    this.domain = getHostName(window.location.href) // For platform-specific rules
    this.onAutofill = typeof onAutofill === 'function' ? onAutofill : null

    this.iframeElement = null
    this.iframeReady = false // Track if iframe is ready for messages
    this.pendingMessages = [] // Queue messages until iframe is ready
    this.width = POPUP_CONFIG.WIDTH
    this.height = POPUP_CONFIG.INITIAL_HEIGHT
    this.className = this.generateUniqueClassName()
    this.canDestroy = false

    this.boundClickHandler = null

    // Security: Get extension origin for postMessage validation
    this.EXTENSION_ORIGIN = browser.runtime.getURL('').replace(/\/$/, '')
    this.nonce = generateNonce()
  }

  getIframeWindow() {
    return this.iframeElement?.contentWindow || null
  }

  getNonce() {
    return this.nonce
  }

  getExtensionOrigin() {
    return this.EXTENSION_ORIGIN
  }

  /**
   * Generate unique class name for this popup instance
   * @private
   * @returns {string}
   */
  generateUniqueClassName() {
    const randomId = Math.floor(Math.random() * 9999)
    return `${POPUP_CONFIG.ID}-${randomId}`
  }

  /**
   * Handle messages from popup iframe
   * @param {string} messageData - JSON string message
   */
  async messageHandler(messageData) {
    const message =
      typeof messageData === 'string'
        ? (() => {
            try {
              return JSON.parse(messageData)
            } catch {
              return null
            }
          })()
        : messageData

    if (!message) return

    switch (message.type) {
      case MESSAGE_TYPES.RESIZE:
        this.handleResize(message.payload)
        break

      case MESSAGE_TYPES.FETCH:
        this.handleFetchRequest()
        break

      case MESSAGE_TYPES.FILL_FORM:
        this.handleFillForm(message.payload)
        break

      case MESSAGE_TYPES.CLOSE:
        this.destroy()
        break
    }
  }

  /**
   * Handle popup resize request
   * @private
   * @param {Object} payload
   */
  handleResize(payload) {
    this.height = payload.height
    this.updatePosition()
    this.canDestroy = true
  }

  /**
   * Send message to popup iframe
   * Queue messages if iframe not ready yet
   * @private
   * @param {Object} message
   */
  sendMessageToIframe(message) {
    // If iframe not created yet, queue for when it's ready
    if (!this.iframeElement) {
      this.pendingMessages.push(message)
      log.info('📬 Message queued (iframe not created yet):', message.type)
      return
    }

    // If iframe not fully loaded yet, queue the message
    if (!this.iframeReady) {
      this.pendingMessages.push(message)
      log.info('📬 Message queued (iframe loading):', message.type)
      return
    }

    // Iframe ready - send message immediately
    if (this.iframeElement.contentWindow) {
      // Security: Use specific extension origin instead of wildcard
      this.iframeElement.contentWindow.postMessage(JSON.stringify(message), this.EXTENSION_ORIGIN)
    } else {
      log.warn('⚠️ ContentWindow not available, queueing message:', message.type)
      this.pendingMessages.push(message)
    }
  }

  /**
   * Flush pending messages after iframe is ready
   * @private
   */
  flushPendingMessages() {
    if (this.pendingMessages.length > 0) {
      log.success(`📤 Flushing ${this.pendingMessages.length} queued message(s)`)
      this.pendingMessages.forEach((message) => {
        // Security: Use specific extension origin instead of wildcard
        this.iframeElement.contentWindow.postMessage(JSON.stringify(message), this.EXTENSION_ORIGIN)
        log.info(`  ✉️ Sent queued message: ${message.type}`)
      })
      this.pendingMessages = []
    }
  }

  /**
   * Handle login data fetch request from popup
   * @private
   */
  handleFetchRequest() {
    this.sendMessageToIframe({
      type: MESSAGE_TYPES.FETCH,
      payload: {
        logins: this.logins,
        authError: this.authError,
        domain: this.domain,
        url: window.location.href
      }
    })
    log.info(`Sent ${this.logins.length} logins to popup (authError: ${this.authError})`)
  }

  /**
   * Fill form with selected login credentials
   * Intelligently fills username and password fields while skipping captcha and account IDs
   * Triggers all necessary events for framework compatibility (React, Vue, Angular)
   * @private
   * @param {Object} credentials
   * @param {string} credentials.itemId
   */
  async handleFillForm({ itemId }) {
    const inputs = this.getFillInputs()
    const fallbackInputs = this.forms?.[0]?.inputs || []
    const fillInputs = inputs.length > 0 ? inputs : fallbackInputs
    if (fillInputs.length === 0) {
      log.error('No inputs available to fill')
      return
    }

    if (!itemId) {
      log.error('Missing itemId for fill request')
      return
    }

    let secret
    try {
      secret = await sendPayload({
        type: 'GET_FILL_SECRET',
        payload: { itemId, userGesture: true }
      })
    } catch (error) {
      log.error('Failed to fetch fill secret:', error)
      return
    }

    const username = secret?.username || ''
    const password = secret?.password || ''
    const totpSecret = secret?.totp_secret || secret?.totpSecret || secret?.totp || ''
    if (!username || !password) {
      log.error('Fill secret missing username or password')
      return
    }

    let passwordDigest
    try {
      passwordDigest = await sha256Base64(password)
    } catch {
      passwordDigest = null
    }

    let usernameFilled = false
    const filledInputs = []

    fillInputs.forEach((input) => {
      // Skip captcha fields
      if (this.isCaptchaField(input)) {
        return
      }

      // Skip platform-specific excluded fields (AWS account ID, Azure tenant ID, etc.)
      if (shouldIgnoreField(input, this.domain, { respectAutocompleteOff: false })) {
        log.info(`Skipping excluded field (platform rule): ${input.name || input.id}`)
        return
      }

      // Fill password fields
      if (input.type === INPUT_TYPES.PASSWORD) {
        this.fillInputWithEvents(input, password)
        filledInputs.push(input)
      }
      // Fill first username field only
      else if (
        !usernameFilled &&
        [INPUT_TYPES.TEXT, INPUT_TYPES.EMAIL, INPUT_TYPES.NUMBER, INPUT_TYPES.TEL].includes(
          input.type
        )
      ) {
        this.fillInputWithEvents(input, username)
        filledInputs.push(input)
        usernameFilled = true
      }
    })

    const totpInputs = totpSecret ? this.getTotpInputs(fillInputs) : []
    if (totpSecret && totpInputs.length > 0) {
      const totpCode = totpService.generateCode(totpSecret)
      if (totpCode) {
        const totpFilledInputs = this.fillTotpInputs(totpInputs, totpCode)
        if (totpFilledInputs.length > 0) {
          filledInputs.push(...totpFilledInputs)
        }
      }
    }

    log.success(`Form auto-filled for: ${username}`)

    try {
      this.onAutofill?.({
        at: Date.now(),
        username,
        passwordDigest,
        itemId,
        filledInputs,
        totpSecret
      })
    } catch {
      // ignore
    }

    // Best-effort wipe (minimize exposure in content script memory)
    try {
      secret.username = null
      secret.password = null
      secret.totp_secret = null
    } catch {
      // ignore
    }
    this.destroy()
  }

  /**
   * Resolve the best input list to fill
   * @returns {HTMLInputElement[]}
   * @private
   */
  getFillInputs() {
    const base = this.targetInput
    if (!base) return []

    const form = base.closest?.('form')
    const container =
      form ||
      base.closest?.('div, section, main, article, aside') ||
      base.closest?.('body') ||
      document.body

    const inputs = Array.from(container?.querySelectorAll?.('input') || [])
    return inputs.filter((input) => {
      if (!input || input.tagName !== 'INPUT') return false
      if (!this.isInputVisible(input)) return false
      if (shouldIgnoreField(input, this.domain, { respectAutocompleteOff: false })) return false
      return true
    })
  }

  getTotpInputs(inputs) {
    const candidates = Array.isArray(inputs) ? inputs : this.getFillInputs()
    return candidates.filter((input) => this.isTotpInput(input))
  }

  isTotpInput(input) {
    if (!input || input.tagName !== 'INPUT') return false
    if (!this.isInputVisible(input)) return false
    if (input.hasAttribute?.('data-passwall-ignore')) return false

    const type = (input.type || '').toLowerCase()
    if (['hidden', 'file', 'checkbox', 'radio', 'submit', 'button', 'image', 'reset'].includes(type)) {
      return false
    }

    const descriptor = this.normalizeFieldText(this.getInputDescriptorText(input))
    if (!descriptor) return false

    const hasLpIgnore =
      input.hasAttribute?.('data-lpignore') ||
      input.hasAttribute?.('data-lp-ignore') ||
      input.hasAttribute?.('lpignore')
    if (shouldIgnoreField(input, this.domain, { respectAutocompleteOff: false }) && !hasLpIgnore) {
      return false
    }

    if (RECOVERY_CODE_FIELD_NAMES.some((keyword) => descriptor.includes(this.normalizeFieldText(keyword)))) {
      return false
    }

    if (TOTP_FIELD_NAMES.some((keyword) => descriptor.includes(this.normalizeFieldText(keyword)))) {
      return true
    }

    const hasAmbiguousKeyword = AMBIGUOUS_TOTP_FIELD_NAMES.some((keyword) =>
      descriptor.includes(this.normalizeFieldText(keyword))
    )
    if (!hasAmbiguousKeyword) {
      return this.hasTotpAutocomplete(input)
    }

    return this.hasTotpAutocomplete(input) || this.isLikelyTotpNumericField(input)
  }

  hasTotpAutocomplete(input) {
    const autocomplete = this.normalizeFieldText(input?.getAttribute?.('autocomplete'))
    if (!autocomplete) return false
    return TOTP_AUTOCOMPLETE_VALUES.some((keyword) => autocomplete.includes(this.normalizeFieldText(keyword)))
  }

  isLikelyTotpNumericField(input) {
    const inputMode = this.normalizeFieldText(input?.getAttribute?.('inputmode'))
    const type = this.normalizeFieldText(input?.type)
    const pattern = this.normalizeFieldText(input?.getAttribute?.('pattern'))
    const maxLength = Number(input?.maxLength) || 0

    const numericHint =
      inputMode === 'numeric' ||
      type === 'number' ||
      /\d/.test(pattern) ||
      (maxLength > 0 && maxLength <= 10)

    return numericHint
  }

  normalizeFieldText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[\s_-]/g, '')
      .trim()
  }

  getInputDescriptorText(input) {
    const attributes = [
      input?.name,
      input?.id,
      input?.placeholder,
      input?.getAttribute?.('aria-label'),
      input?.getAttribute?.('autocomplete'),
      input?.getAttribute?.('title'),
      this.getLabelText(input)
    ]

    return attributes
      .filter(Boolean)
      .map((value) => String(value).toLowerCase())
      .join(' ')
  }

  getLabelText(input) {
    const ariaLabelledbyText = this.getAriaLabelledbyText(input)
    if (ariaLabelledbyText) {
      return ariaLabelledbyText
    }

    const label = input?.labels?.[0]
    return label ? label.textContent || '' : ''
  }

  getAriaLabelledbyText(input) {
    const labelledBy = input?.getAttribute?.('aria-labelledby')
    if (!labelledBy) return ''
    return labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent || '')
      .filter(Boolean)
      .join(' ')
  }

  fillTotpInputs(inputs, totpCode) {
    if (!Array.isArray(inputs) || inputs.length === 0 || !totpCode) {
      return []
    }

    const visibleInputs = inputs.filter((input) => this.isInputVisible(input))
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

  /**
   * Lightweight visibility check for inputs
   * @param {HTMLInputElement} input
   * @returns {boolean}
   * @private
   */
  isInputVisible(input) {
    if (!input) return false
    if (input.hidden) return false
    const rect = input.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return false
    const style = window.getComputedStyle(input)
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      return false
    }
    return true
  }

  /**
   * Sanitize value before filling (XSS prevention)
   * @private
   * @param {string} value
   * @returns {string}
   */
  sanitizeValue(value) {
    if (typeof value !== 'string') return ''

    // Basic XSS prevention - remove dangerous patterns
    // Note: Passwords/usernames shouldn't contain HTML/JS, but sanitize anyway
    return value
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '') // Remove event handlers like onclick=
      .trim()
  }

  /**
   * Fill input field and trigger all necessary events
   * Enhanced for React/Vue/Angular form validation compatibility
   * Simulates real user typing with proper event sequence
   * @private
   * @param {HTMLInputElement} input
   * @param {string} value
   */
  fillInputWithEvents(input, value) {
    // Security: Sanitize value before filling
    const sanitizedValue = this.sanitizeValue(value)
    const doc = input?.ownerDocument || document
    const win = doc.defaultView || window

    // Store initial state
    const initialValue = input.value

    // Trigger focus event FIRST (critical for React)
    const FocusEventCtor = win.FocusEvent || FocusEvent
    const focusEvent = new FocusEventCtor('focus', { bubbles: true, view: win })
    input.dispatchEvent(focusEvent)

    // Focus the input (critical for many forms)
    input.focus?.()

    // Click to ensure focus
    const MouseEventCtor = win.MouseEvent || MouseEvent
    const clickEvent = new MouseEventCtor('click', {
      bubbles: true,
      cancelable: true,
      view: win
    })
    input.dispatchEvent(clickEvent)

    // Clear existing value first
    input.value = ''

    // Use native property descriptor for React/Vue compatibility
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      win.HTMLInputElement?.prototype || window.HTMLInputElement?.prototype,
      'value'
    )?.set

    // Set value using native setter if available (React requires this)
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, sanitizedValue)
    } else {
      input.value = sanitizedValue
    }

    // Trigger KeyboardEvent (more realistic than Event)
    const keydownEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      composed: true,
      key: value.charAt(0),
      code: 'Key' + value.charAt(0).toUpperCase()
    })
    input.dispatchEvent(keydownEvent)

    // Trigger beforeinput event (CRITICAL for React 16+)
    const EventCtor = win.Event || Event
    const inputEventBefore = new EventCtor('beforeinput', {
      bubbles: true,
      cancelable: true
    })
    input.dispatchEvent(inputEventBefore)

    // Trigger InputEvent for modern frameworks (with proper data)
    const InputEventCtor = win.InputEvent || InputEvent
    const inputEvent = new InputEventCtor('input', {
      bubbles: true,
      cancelable: false, // input event cannot be cancelled
      composed: true,
      data: value,
      inputType: 'insertText',
      isComposing: false
    })
    input.dispatchEvent(inputEvent)

    // Trigger keyup
    const keyupEvent = new KeyboardEvent('keyup', {
      bubbles: true,
      cancelable: true,
      composed: true,
      key: value.charAt(value.length - 1)
    })
    input.dispatchEvent(keyupEvent)

    // Trigger change event (for form validation)
    const changeEvent = new EventCtor('change', {
      bubbles: true,
      cancelable: false
    })
    input.dispatchEvent(changeEvent)

    // DON'T blur immediately - keep focus for React state updates
    // Wait a bit for React to process, then blur
    setTimeout(() => {
      input.blur()

      // Trigger blur event explicitly
      const blurEvent = new FocusEvent('blur', { bubbles: true })
      input.dispatchEvent(blurEvent)
    }, 50) // 50ms delay for React to process

    // Final verification
    log.info(`Filled ${input.name || input.id}: ${input.value.substring(0, 3)}***`)
  }

  /**
   * Detect if input field is likely a captcha
   * @private
   * @param {HTMLInputElement} input
   * @returns {boolean}
   */
  isCaptchaField(input) {
    const nameOrId = (input.name + input.id).toLowerCase()

    // Check for captcha-related keywords
    const captchaKeywords = ['captcha', 'security', 'verification', 'code', 'confirm']
    const hasCaptchaKeyword = captchaKeywords.some((keyword) => nameOrId.includes(keyword))

    // Captcha fields are usually short (4-6 characters)
    const isShortField = input.maxLength > 0 && input.maxLength <= 6

    // If it has captcha keyword OR is a short text field, likely captcha
    return hasCaptchaKeyword || (isShortField && input.type === INPUT_TYPES.TEXT)
  }

  /**
   * Handle click outside popup
   * @private
   * @param {MouseEvent} event
   */
  handleClickOutside(event) {
    const isClickInsidePopup = event.target.className?.includes(this.className)

    if (!isClickInsidePopup && this.canDestroy) {
      this.destroy()
    }
  }

  /**
   * Create iframe element
   * @private
   */
  createIframe() {
    const iframe = document.createElement('iframe')
    const popupUrl = browser.runtime.getURL(
      `src/popup/index.html?pw_nonce=${this.nonce}#/Inject/loginAsPopup`
    )

    iframe.setAttribute('id', POPUP_CONFIG.ID)
    iframe.setAttribute('src', popupUrl)
    iframe.setAttribute('scrolling', 'no')
    iframe.setAttribute('class', this.className)
    iframe.style.position = 'absolute'
    iframe.style.border = POPUP_CONFIG.BORDER
    iframe.style.borderRadius = POPUP_CONFIG.BORDER_RADIUS
    iframe.style.zIndex = POPUP_CONFIG.Z_INDEX

    this.iframeElement = iframe
    document.body.appendChild(iframe)

    // Error handler for iframe
    iframe.addEventListener('error', (e) => {
      log.error('Iframe load error:', e)
    })

    // Wait for iframe to load before allowing messages
    iframe.addEventListener('load', () => {
      log.success(`Iframe loaded! src: ${iframe.src}`)

      // Mark iframe as ready for communication
      this.iframeReady = true

      // Handshake nonce to iframe so it can echo it back in all messages
      this.sendMessageToIframe({ type: 'PASSWALL_HANDSHAKE', nonce: this.nonce })

      // Flush any messages that were queued while loading
      this.flushPendingMessages()
    })

    // Setup click outside handler
    this.boundClickHandler = this.handleClickOutside.bind(this)
    window.addEventListener('click', this.boundClickHandler, true)
  }

  /**
   * Update popup position and size
   * @private
   */
  updatePosition() {
    if (!this.iframeElement) return

    const { top, left, height } = getOffset(this.targetInput)

    Object.assign(this.iframeElement.style, {
      top: `${top + height + 1}px`,
      left: `${left}px`,
      width: `${this.width}px`,
      height: `${this.height}px`
    })
  }

  /**
   * Render popup (create + position)
   */
  render() {
    this.createIframe()
    this.updatePosition()
  }

  /**
   * Remove popup from DOM and cleanup listeners
   */
  destroy() {
    if (this.iframeElement) {
      this.iframeElement.remove()
      this.iframeElement = null
    }

    if (this.boundClickHandler) {
      window.removeEventListener('click', this.boundClickHandler, true)
      this.boundClickHandler = null
    }

    // Clear pending messages
    this.pendingMessages = []
    this.iframeReady = false
  }
}
