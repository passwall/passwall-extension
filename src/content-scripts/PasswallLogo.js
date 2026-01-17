import { getOffset } from '@/utils/helpers'

// Use extension's 48px icon for crisp appearance
const PASSWALL_LOGO_URL = chrome.runtime.getURL('icons/48.png')

const LOGO_CONFIG = {
  ID: 'passwall-input-icon',
  SIZE_RATIO: 0.7,
  MAX_SIZE: 32, // Maximum logo size in pixels (fixed)
  MIN_SIZE: 20, // Minimum logo size in pixels
  OFFSET: 5,
  Z_INDEX: 99999
}

// Development logging
const DEV_MODE = false // Set to false for production
const log = {
  info: (...args) => DEV_MODE && console.log('🔵 [Logo]', ...args),
  success: (...args) => DEV_MODE && console.log('✅ [Logo]', ...args),
  error: (...args) => console.error('❌ [Logo]', ...args)
}

/**
 * PasswallLogo - Renders Passwall icon next to input fields
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
    this.imageElement = null
  }

  /**
   * Get the target input element
   * @returns {HTMLInputElement}
   */
  get targetElement() {
    return this.input
  }

  /**
   * Create the logo image element
   * @private
   */
  createLogoElement() {
    const img = document.createElement('img')

    img.setAttribute('id', LOGO_CONFIG.ID)
    img.alt = 'Passwall'
    img.src = PASSWALL_LOGO_URL

    // Apply all styles directly to ensure they work
    Object.assign(img.style, {
      cursor: 'pointer',
      position: 'absolute',
      zIndex: LOGO_CONFIG.Z_INDEX.toString(),
      pointerEvents: 'auto',
      display: 'block',
      // Smooth rendering for crisp logo appearance
      imageRendering: 'auto',
      // Prevent image dragging
      userSelect: 'none',
      WebkitUserDrag: 'none'
    })

    if (this.onClick) {
      img.addEventListener('click', (event) => {
        log.info('🖱️ Logo clicked! Calling onClick handler')
        this.onClick(event)
      })
    }

    this.imageElement = img
    return img
  }

  /**
   * Detect existing icons from other extensions (LastPass, Bitwarden, etc.)
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

    // Common selectors for other password manager icons
    const iconSelectors = [
      'img[data-lastpass-icon-root]', // LastPass
      'span[data-lastpass-icon-root]', // LastPass
      'div[data-lastpass-icon-root]', // LastPass
      '[class*="bitwarden"]', // Bitwarden
      '[id*="bitwarden"]', // Bitwarden
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
        const icons = document.querySelectorAll(selector)

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
      document.body
    if (container === this.input) {
      container = this.input.parentElement || document.body
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
      if (icon === this.imageElement || icon === this.input) return

      const buttonAnchor =
        typeof icon.closest === 'function'
          ? icon.closest('button, [role="button"]')
          : null
      const iconRect = (buttonAnchor || icon).getBoundingClientRect()
      if (!iconRect.width || !iconRect.height) return

      const sameVerticalArea = iconRect.top < inputBottom && iconRect.bottom > inputTop
      if (!sameVerticalArea) return

      const overlapsTarget =
        targetRect.left < iconRect.right && targetRect.right > iconRect.left
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
    if (!this.imageElement) {
      log.error('Cannot update position: imageElement is null')
      return
    }

    const { top, left, height, width } = getOffset(this.input)
    const inputRect = this.input.getBoundingClientRect()
    const computedStyle = window.getComputedStyle(this.input)
    const paddingRight = parseFloat(computedStyle.paddingRight || '0') || 0

    // Calculate logo size with fixed maximum and minimum
    let size = height * LOGO_CONFIG.SIZE_RATIO

    // Enforce size constraints for consistent appearance
    if (size > LOGO_CONFIG.MAX_SIZE) {
      size = LOGO_CONFIG.MAX_SIZE
      log.info(
        `Logo size capped at MAX_SIZE: ${LOGO_CONFIG.MAX_SIZE}px (input height: ${height}px)`
      )
    } else if (size < LOGO_CONFIG.MIN_SIZE) {
      size = LOGO_CONFIG.MIN_SIZE
      log.info(
        `Logo size increased to MIN_SIZE: ${LOGO_CONFIG.MIN_SIZE}px (input height: ${height}px)`
      )
    }

    const topPosition = top + (height - size) / 2 // Center vertically

    const defaultLeft = left + width - size - LOGO_CONFIG.OFFSET
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

    Object.assign(this.imageElement.style, {
      top: `${topPosition}px`,
      left: `${leftPosition}px`,
      height: `${size}px`,
      width: `${size}px`,
      zIndex: LOGO_CONFIG.Z_INDEX.toString()
    })

    if (!this.imageElement.parentNode) {
      document.body.appendChild(this.imageElement)
    }
  }

  /**
   * Render the logo (create + position)
   */
  render() {
    this.createLogoElement()
    this.updatePosition()
  }

  /**
   * Remove logo from DOM and cleanup
   */
  destroy() {
    if (this.imageElement) {
      this.imageElement.remove()
      this.imageElement = null
    }
  }
}
