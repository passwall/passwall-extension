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
      img.addEventListener('click', () => {
        log.info('🖱️ Logo clicked! Calling onClick handler')
        this.onClick()
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
  detectExistingIcons() {
    const inputRect = this.input.getBoundingClientRect()
    const inputRight = inputRect.right
    const inputTop = inputRect.top
    const inputBottom = inputRect.bottom
    
    // Common selectors for other password manager icons
    const iconSelectors = [
      'img[data-lastpass-icon-root]',  // LastPass
      'span[data-lastpass-icon-root]', // LastPass
      'div[data-lastpass-icon-root]',  // LastPass
      '[class*="bitwarden"]',          // Bitwarden
      '[id*="bitwarden"]',             // Bitwarden
      '[class*="1password"]',          // 1Password
      '[id*="1password"]',             // 1Password
      '[class*="dashlane"]',           // Dashlane
      '[id*="keeper"]',                // Keeper
      'input + img',                   // Generic icon after input
      'input + span > img'             // Generic icon in span after input
    ]
    
    let maxOffset = 0
    
    // Check each selector
    iconSelectors.forEach(selector => {
      try {
        const icons = document.querySelectorAll(selector)
        
        icons.forEach(icon => {
          // Skip our own icon
          if (icon === this.imageElement) return
          
          const iconRect = icon.getBoundingClientRect()
          
          // Check if icon is in the same vertical area as our input
          const sameVerticalArea = (
            iconRect.top < inputBottom &&
            iconRect.bottom > inputTop
          )
          
          // Check if icon is positioned inside or near the input field
          const nearInput = (
            iconRect.left >= inputRect.left - 50 &&
            iconRect.left <= inputRight + 50
          )
          
          if (sameVerticalArea && nearInput) {
            // Calculate how much space this icon takes
            const iconWidth = iconRect.width
            const iconOffset = inputRight - iconRect.left + 10 // 10px gap
            
            if (iconOffset > maxOffset) {
              maxOffset = iconOffset
              log.info(`Detected existing icon: ${icon.tagName}, offset: ${iconOffset}px`)
            }
          }
        })
      } catch (e) {
        // Ignore selector errors
      }
    })
    
    return maxOffset
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
    
    // Calculate logo size with fixed maximum and minimum
    let size = height * LOGO_CONFIG.SIZE_RATIO
    
    // Enforce size constraints for consistent appearance
    if (size > LOGO_CONFIG.MAX_SIZE) {
      size = LOGO_CONFIG.MAX_SIZE
      log.info(`Logo size capped at MAX_SIZE: ${LOGO_CONFIG.MAX_SIZE}px (input height: ${height}px)`)
    } else if (size < LOGO_CONFIG.MIN_SIZE) {
      size = LOGO_CONFIG.MIN_SIZE
      log.info(`Logo size increased to MIN_SIZE: ${LOGO_CONFIG.MIN_SIZE}px (input height: ${height}px)`)
    }
    
    const topPosition = top + (height - size) / 2 // Center vertically
    
    // Detect existing icons and adjust position
    const existingIconOffset = this.detectExistingIcons()
    const additionalOffset = existingIconOffset > 0 ? existingIconOffset + size : 0
    
    // Calculate left position with collision avoidance
    const leftPosition = left + width - size - LOGO_CONFIG.OFFSET - additionalOffset
    
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
