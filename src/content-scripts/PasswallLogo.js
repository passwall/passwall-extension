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
   * Detect existing icons from other extensions (LastPass, Bitwarden, etc.)
   * @private
   * @returns {number} Additional offset needed to avoid overlap
   */
  detectExistingIcons() {
    const inputRect = this.input.getBoundingClientRect()
    const inputRight = inputRect.right
    const inputTop = inputRect.top
    const inputBottom = inputRect.bottom
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/53a1b74f-c462-4c55-a5b3-a9a7d396f665',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PasswallLogo.js:detectExistingIcons',message:'Starting icon detection',data:{inputId:this.input.id,inputName:this.input.name,inputRect:{top:inputTop,right:inputRight,bottom:inputBottom,left:inputRect.left}},timestamp:Date.now(),sessionId:'debug-session',runId:'icon-collision-debug',hypothesisId:'P'})}).catch(()=>{});
    // #endregion
    
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
    let foundIcons = []
    
    // Check each selector
    iconSelectors.forEach(selector => {
      try {
        const icons = document.querySelectorAll(selector)
        // #region agent log
        if (icons.length > 0) {
          fetch('http://127.0.0.1:7242/ingest/53a1b74f-c462-4c55-a5b3-a9a7d396f665',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PasswallLogo.js:detectExistingIcons',message:'Found icons with selector',data:{selector:selector,count:icons.length},timestamp:Date.now(),sessionId:'debug-session',runId:'icon-collision-debug',hypothesisId:'P'})}).catch(()=>{});
        }
        // #endregion
        
        icons.forEach(icon => {
          // Skip our own icon
          if (icon === this.imageElement) return
          
          const iconRect = icon.getBoundingClientRect()
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/53a1b74f-c462-4c55-a5b3-a9a7d396f665',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PasswallLogo.js:detectExistingIcons',message:'Checking icon position',data:{iconTag:icon.tagName,iconClass:icon.className,iconId:icon.id,iconRect:{top:iconRect.top,left:iconRect.left,right:iconRect.right,width:iconRect.width,height:iconRect.height}},timestamp:Date.now(),sessionId:'debug-session',runId:'icon-collision-debug',hypothesisId:'P'})}).catch(()=>{});
          // #endregion
          
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
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/53a1b74f-c462-4c55-a5b3-a9a7d396f665',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PasswallLogo.js:detectExistingIcons',message:'Icon proximity check',data:{sameVerticalArea:sameVerticalArea,nearInput:nearInput,willAdjust:sameVerticalArea&&nearInput},timestamp:Date.now(),sessionId:'debug-session',runId:'icon-collision-debug',hypothesisId:'P'})}).catch(()=>{});
          // #endregion
          
          if (sameVerticalArea && nearInput) {
            // Calculate how much space this icon takes
            const iconWidth = iconRect.width
            const iconOffset = inputRight - iconRect.left + 10 // 10px gap
            
            foundIcons.push({tag: icon.tagName, class: icon.className, offset: iconOffset})
            
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
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/53a1b74f-c462-4c55-a5b3-a9a7d396f665',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PasswallLogo.js:detectExistingIcons',message:'Detection complete',data:{maxOffset:maxOffset,foundIconsCount:foundIcons.length,foundIcons:foundIcons},timestamp:Date.now(),sessionId:'debug-session',runId:'icon-collision-debug',hypothesisId:'P'})}).catch(()=>{});
    // #endregion
    
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
    const size = height * LOGO_CONFIG.SIZE_RATIO
    const topPosition = top + (height * (1 - LOGO_CONFIG.SIZE_RATIO)) / 2
    
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
