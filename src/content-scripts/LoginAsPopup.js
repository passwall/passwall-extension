import browser from 'webextension-polyfill'
import { getOffset, sendPayload, getHostName } from '@/utils/helpers'
import { shouldExcludeField } from '@/utils/platform-rules'

const INPUT_TYPES = {
  PASSWORD: 'password',
  TEXT: 'text',
  EMAIL: 'email',
  NUMBER: 'number',
  TEL: 'tel'
}

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
  constructor(targetInput, logins, forms, authError = null) {
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

    this.iframeElement = null
    this.iframeReady = false // Track if iframe is ready for messages
    this.pendingMessages = [] // Queue messages until iframe is ready
    this.width = POPUP_CONFIG.WIDTH
    this.height = POPUP_CONFIG.INITIAL_HEIGHT
    this.className = this.generateUniqueClassName()
    this.canDestroy = false

    this.boundClickHandler = null
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
    let message

    try {
      message = JSON.parse(messageData)
    } catch (error) {
      // Not a valid JSON message, ignore
      return
    }

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
      this.iframeElement.contentWindow.postMessage(JSON.stringify(message), '*')
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
        this.iframeElement.contentWindow.postMessage(JSON.stringify(message), '*')
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
        authError: this.authError
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
   * @param {string} credentials.username
   * @param {string} credentials.password
   */
  handleFillForm({ username, password }) {
    if (!this.forms[0]) {
      log.error('No form available to fill')
      return
    }

    let usernameFilled = false

    this.forms[0].inputs.forEach((input) => {
      // Skip captcha fields
      if (this.isCaptchaField(input)) {
        return
      }

      // Skip platform-specific excluded fields (AWS account ID, Azure tenant ID, etc.)
      if (shouldExcludeField(input, this.domain)) {
        log.info(`Skipping excluded field (platform rule): ${input.name || input.id}`)
        return
      }

      // Fill password fields
      if (input.type === INPUT_TYPES.PASSWORD) {
        this.fillInputWithEvents(input, password)
      }
      // Fill first username field only
      else if (
        !usernameFilled &&
        [INPUT_TYPES.TEXT, INPUT_TYPES.EMAIL, INPUT_TYPES.NUMBER, INPUT_TYPES.TEL].includes(
          input.type
        )
      ) {
        this.fillInputWithEvents(input, username)
        usernameFilled = true
      }
    })

    log.success(`Form auto-filled for: ${username}`)
    this.destroy()
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
    // Store initial state
    const initialValue = input.value

    // Trigger focus event FIRST (critical for React)
    const focusEvent = new FocusEvent('focus', { bubbles: true })
    input.dispatchEvent(focusEvent)

    // Focus the input (critical for many forms)
    input.focus()

    // Click to ensure focus
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    })
    input.dispatchEvent(clickEvent)

    // Clear existing value first
    input.value = ''

    // Use native property descriptor for React/Vue compatibility
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set

    // Set value using native setter if available (React requires this)
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value)
    } else {
      input.value = value
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
    const inputEventBefore = new Event('beforeinput', {
      bubbles: true,
      cancelable: true
    })
    input.dispatchEvent(inputEventBefore)

    // Trigger InputEvent for modern frameworks (with proper data)
    const inputEvent = new InputEvent('input', {
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
    const changeEvent = new Event('change', {
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
    const popupUrl = browser.runtime.getURL('src/popup/index.html#/Inject/loginAsPopup')

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
