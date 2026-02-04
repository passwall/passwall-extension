// Use extension's 48px icon for crisp appearance
const PASSWALL_LOGO_URL = chrome.runtime.getURL('icons/48.png')

const LOGO_CONFIG = {
  ID: 'passwall-input-icon',
  SIZE_RATIO: 0.7,
  MAX_SIZE: 32, // Maximum logo size in pixels (fixed)
  MIN_SIZE: 20, // Minimum logo size in pixels
  OFFSET: 5,
  Z_INDEX: 2147483647 // Maximum safe z-index
}

// Development logging
const DEV_MODE = false // Set to false for production
const log = {
  info: (...args) => DEV_MODE && console.log('🔵 [Logo]', ...args),
  success: (...args) => DEV_MODE && console.log('✅ [Logo]', ...args),
  error: (...args) => console.error('❌ [Logo]', ...args)
}

/**
 * Generate a random custom element name for obfuscation
 * This makes it harder for pages to detect and manipulate our elements
 * @returns {string}
 */
function generateCustomElementName() {
  const randomId = Math.random().toString(36).substring(2, 8)
  return `pw-logo-${randomId}`
}

/**
 * Default styles for host element
 * Note: We don't use 'all: initial' as it can hide the element
 */
const DEFAULT_HOST_STYLES = {
  position: 'fixed',
  display: 'block',
  zIndex: LOGO_CONFIG.Z_INDEX.toString(),
  pointerEvents: 'auto',
  visibility: 'visible',
  opacity: '1',
  margin: '0',
  padding: '0',
  border: 'none',
  background: 'transparent',
  boxSizing: 'border-box',
  overflow: 'visible'
}

/**
 * PasswallLogo - Renders Passwall icon next to input fields
 * Uses Shadow DOM for CSS isolation and protection
 */
export class PasswallLogo {
  /**
   * @param {HTMLInputElement} input - Target input element
   * @param {Function} onClick - Click handler callback
   */
  constructor(input, onClick) {
    if (!input) {
      throw new Error('PasswallLogo requires an input element')
    }

    this.input = input
    this.onClick = onClick
    this.hostElement = null // Shadow DOM host element
    this.shadowRoot = null // Closed shadow root for isolation
    this.imageElement = null
    this.mutationObserver = null // Protection against page interference
    this.foreignMutationCount = 0 // Track unauthorized mutations
    this._raf = 0
    this._onWinChange = null
  }

  /**
   * Get the target input element
   * @returns {HTMLInputElement}
   */
  get targetElement() {
    return this.input
  }

  /**
   * Create Shadow DOM host element with CSS isolation
   * @private
   */
  createHostElement() {
    const doc = this.input?.ownerDocument || document

    // Create custom element as host
    const host = doc.createElement('div')
    host.setAttribute('id', LOGO_CONFIG.ID)
    host.setAttribute('data-passwall-logo', 'true')

    // Apply host styles
    Object.assign(host.style, DEFAULT_HOST_STYLES)

    // Create closed shadow root for true isolation
    // Closed mode prevents page JS from accessing our shadow internals
    this.shadowRoot = host.attachShadow({ mode: 'closed' })

    this.hostElement = host
    return host
  }

  /**
   * Create the logo image element inside Shadow DOM
   * @private
   */
  createLogoElement() {
    if (!this.shadowRoot) {
      throw new Error('Shadow root must be created before logo element')
    }

    const img = document.createElement('img')

    img.alt = 'Passwall'
    img.src = PASSWALL_LOGO_URL

    // Apply all styles directly inside shadow DOM
    Object.assign(img.style, {
      cursor: 'pointer',
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      // Smooth rendering for crisp logo appearance
      imageRendering: 'auto',
      // Prevent image dragging
      userSelect: 'none',
      WebkitUserDrag: 'none',
      // Reset any inherited styles
      margin: '0',
      padding: '0',
      border: 'none',
      background: 'transparent',
      maxWidth: 'none',
      maxHeight: 'none'
    })

    if (this.onClick) {
      img.addEventListener('click', (event) => {
        log.info('🖱️ Logo clicked! Calling onClick handler')
        event.stopPropagation()
        this.onClick(event)
      })
    }

    // Add styles element for additional CSS reset
    const styleElement = document.createElement('style')
    styleElement.textContent = `
      :host {
        position: fixed !important;
        display: block !important;
        z-index: ${LOGO_CONFIG.Z_INDEX} !important;
        pointer-events: auto !important;
        visibility: visible !important;
        opacity: 1 !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        background: transparent !important;
        box-sizing: border-box !important;
        overflow: visible !important;
      }
      img {
        cursor: pointer !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        user-select: none !important;
        -webkit-user-drag: none !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        background: transparent !important;
        max-width: none !important;
        max-height: none !important;
      }
    `

    this.shadowRoot.appendChild(styleElement)
    this.shadowRoot.appendChild(img)
    this.imageElement = img

    return img
  }

  /**
   * Setup mutation observer to protect against page interference
   * @private
   */
  setupMutationProtection() {
    if (!this.hostElement || this.mutationObserver) return

    this.mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Check for unauthorized style modifications
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          // Reset to our default styles
          Object.assign(this.hostElement.style, DEFAULT_HOST_STYLES)
          this.updatePosition()
          this.foreignMutationCount++

          log.info('⚠️ Detected style modification, resetting...')

          // If too many foreign mutations, consider disabling
          if (this.foreignMutationCount > 10) {
            log.warn('⚠️ Excessive mutations detected, page may be interfering')
          }
        }

        // Check for unauthorized attribute modifications
        if (mutation.type === 'attributes' && mutation.attributeName !== 'style') {
          // Remove unauthorized attributes (except our own)
          const attr = mutation.attributeName
          if (attr && !['id', 'data-passwall-logo'].includes(attr)) {
            this.hostElement.removeAttribute(attr)
            log.info(`⚠️ Removed unauthorized attribute: ${attr}`)
          }
        }
      }
    })

    this.mutationObserver.observe(this.hostElement, {
      attributes: true,
      attributeOldValue: true
    })
  }

  /**
   * Detect existing icons from other extensions (LastPass, 1Password, etc.)
   * @private
   * @returns {number} Additional offset needed to avoid overlap
   */
  detectExistingIcons(inputRect, targetRect) {
    const inputRight = inputRect.right
    const inputTop = inputRect.top
    const inputBottom = inputRect.bottom
    const inputLeft = inputRect.left
    const inputWidth = inputRect.width
    const rightZoneLeft = inputRight - Math.max(inputRect.height * 1.5, 36)

    const doc = this.input?.ownerDocument || document

    // Common selectors for other password manager icons
    const iconSelectors = [
      'img[data-lastpass-icon-root]', // LastPass
      'span[data-lastpass-icon-root]', // LastPass
      'div[data-lastpass-icon-root]', // LastPass
      '[class*="1password"]', // 1Password
      '[id*="1password"]', // 1Password
      '[class*="dashlane"]', // Dashlane
      '[id*="keeper"]', // Keeper
      'input + img', // Generic icon after input
      'input + span > img' // Generic icon in span after input
    ]

    let maxShift = 0
    const candidates = new Set()

    // Check each selector
    iconSelectors.forEach((selector) => {
      try {
        const icons = doc.querySelectorAll(selector)

        icons.forEach((icon) => {
          candidates.add(icon)
        })
      } catch (e) {
        // Ignore selector errors
      }
    })

    // Also detect in-field icons like show/hide buttons within the same container
    let container =
      this.input.closest('[data-slot], .relative, .input-wrapper, .form-control') ||
      this.input.parentElement ||
      doc.body
    if (container === this.input) {
      container = this.input.parentElement || doc.body
    }
    const localIcons = container.querySelectorAll('button, [role="button"], svg, img')
    localIcons.forEach((icon) => candidates.add(icon))
    if (container !== this.input.parentElement && this.input.parentElement) {
      const siblingIcons = this.input.parentElement.querySelectorAll(
        'button, [role="button"], svg, img'
      )
      siblingIcons.forEach((icon) => candidates.add(icon))
    }

    const gap = 10

    candidates.forEach((icon) => {
      // Skip our own icon and the input itself
      if (icon === this.hostElement || icon === this.imageElement || icon === this.input) return

      const buttonAnchor =
        typeof icon.closest === 'function' ? icon.closest('button, [role="button"]') : null
      const iconRect = (buttonAnchor || icon).getBoundingClientRect()
      if (!iconRect.width || !iconRect.height) return

      const sameVerticalArea = iconRect.top < inputBottom && iconRect.bottom > inputTop
      if (!sameVerticalArea) return

      const overlapsTarget = targetRect.left < iconRect.right && targetRect.right > iconRect.left
      const insideInput = iconRect.left < inputRight && iconRect.right > inputLeft
      const inRightZone = iconRect.left >= rightZoneLeft
      const reasonableSize =
        iconRect.width <= inputRect.height * 2 && iconRect.height <= inputRect.height * 2
      const isRightSideSibling =
        iconRect.left >= inputLeft + inputWidth * 0.5 && (buttonAnchor || icon).parentElement

      if ((overlapsTarget || insideInput || isRightSideSibling) && inRightZone && reasonableSize) {
        const shift = targetRect.right - iconRect.left + gap
        if (shift > maxShift) {
          maxShift = shift
          log.info(`Detected existing icon: ${icon.tagName}, shift: ${shift}px`)
        }
      }
    })

    return maxShift
  }

  /**
   * Calculate and apply position/size styles
   * Smart positioning to avoid overlapping with other extension icons
   * @private
   */
  updatePosition() {
    if (!this.hostElement || !this.imageElement) {
      log.error('Cannot update position: elements are null')
      return
    }

    const doc = this.input?.ownerDocument || document
    const win = doc.defaultView || window

    const inputRect = this.input.getBoundingClientRect()
    const computedStyle = win.getComputedStyle(this.input)
    const paddingRight = parseFloat(computedStyle.paddingRight || '0') || 0

    // Calculate logo size with fixed maximum and minimum
    let size = inputRect.height * LOGO_CONFIG.SIZE_RATIO

    // Enforce size constraints for consistent appearance
    if (size > LOGO_CONFIG.MAX_SIZE) {
      size = LOGO_CONFIG.MAX_SIZE
      log.info(
        `Logo size capped at MAX_SIZE: ${LOGO_CONFIG.MAX_SIZE}px (input height: ${inputRect.height}px)`
      )
    } else if (size < LOGO_CONFIG.MIN_SIZE) {
      // Avoid exceeding very short inputs (prevents icon spilling outside)
      size = Math.min(LOGO_CONFIG.MIN_SIZE, inputRect.height)
      log.info(
        `Logo size increased to MIN_SIZE: ${LOGO_CONFIG.MIN_SIZE}px (input height: ${inputRect.height}px)`
      )
    }

    const topPosition = inputRect.top + (inputRect.height - size) / 2 // Center vertically

    const defaultLeft = inputRect.left + inputRect.width - size - LOGO_CONFIG.OFFSET
    const targetRect = {
      left: defaultLeft,
      right: defaultLeft + size,
      top: topPosition,
      bottom: topPosition + size
    }

    // Detect existing icons and adjust position (collision-based)
    const existingShift = this.detectExistingIcons(inputRect, targetRect)
    const additionalOffset = Math.max(0, existingShift - paddingRight)

    // Calculate left position with collision and padding awareness
    const leftPosition = defaultLeft - additionalOffset

    if (additionalOffset > 0) {
      log.success(`Adjusted position to avoid overlap: -${additionalOffset}px`)
    }

    // Update host element position
    Object.assign(this.hostElement.style, {
      top: `${topPosition}px`,
      left: `${leftPosition}px`,
      width: `${size}px`,
      height: `${size}px`,
      zIndex: LOGO_CONFIG.Z_INDEX.toString()
    })

    // Update image size inside shadow DOM
    Object.assign(this.imageElement.style, {
      height: `${size}px`,
      width: `${size}px`
    })

    if (!this.hostElement.parentNode) {
      ;(doc.body || doc.documentElement).appendChild(this.hostElement)
    }
  }

  /**
   * Render the logo (create + position)
   */
  render() {
    this.createHostElement()
    this.createLogoElement()
    this.updatePosition()
    this.setupMutationProtection()

    const doc = this.input?.ownerDocument || document
    const win = doc.defaultView || window
    if (!this._onWinChange) {
      this._onWinChange = () => {
        if (this._raf) return
        this._raf = win.requestAnimationFrame(() => {
          this._raf = 0
          try {
            this.updatePosition()
          } catch {
            // ignore
          }
        })
      }
      win.addEventListener('scroll', this._onWinChange, true)
      win.addEventListener('resize', this._onWinChange, true)
    }
  }

  /**
   * Remove logo from DOM and cleanup
   */
  destroy() {
    const doc = this.input?.ownerDocument || document
    const win = doc.defaultView || window

    // Cleanup mutation observer
    if (this.mutationObserver) {
      this.mutationObserver.disconnect()
      this.mutationObserver = null
    }

    if (this._onWinChange) {
      try {
        win.removeEventListener('scroll', this._onWinChange, true)
        win.removeEventListener('resize', this._onWinChange, true)
      } catch {
        // ignore
      }
      this._onWinChange = null
    }
    if (this._raf) {
      try {
        win.cancelAnimationFrame(this._raf)
      } catch {
        // ignore
      }
      this._raf = 0
    }

    // Remove host element (this also removes shadow DOM)
    if (this.hostElement) {
      this.hostElement.remove()
      this.hostElement = null
    }

    this.shadowRoot = null
    this.imageElement = null
  }
}
