import { getOffset } from '@/utils/helpers'
import { PASSWALL_ICON_BS64 } from '@/utils/constants'

const LOGO_CONFIG = {
  ID: 'passwall-input-icon',
  SIZE_RATIO: 0.7,
  OFFSET: 5,
  Z_INDEX: 99999
}

// Development logging
const DEV_MODE = true
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
   * Create the logo image element
   * @private
   */
  createLogoElement() {
    const img = document.createElement('img')
    
    img.setAttribute('id', LOGO_CONFIG.ID)
    img.alt = 'Passwall'
    img.src = PASSWALL_ICON_BS64
    
    // Apply all styles directly to ensure they work
    Object.assign(img.style, {
      cursor: 'pointer',
      position: 'absolute',
      zIndex: LOGO_CONFIG.Z_INDEX.toString(),
      pointerEvents: 'auto',
      display: 'block'
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
   * Calculate and apply position/size styles
   * @private
   */
  updatePosition() {
    if (!this.imageElement) {
      log.error('Cannot update position: imageElement is null')
      return
    }
    
    const { top, left, height, width } = getOffset(this.input)
    const size = height * LOGO_CONFIG.SIZE_RATIO
    const topPosition = top + (height * (1 - LOGO_CONFIG.SIZE_RATIO)) / 2
    const leftPosition = left + width - size - LOGO_CONFIG.OFFSET
    
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
