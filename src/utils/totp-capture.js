import QrScanner from 'qr-scanner'
import browser from 'webextension-polyfill'

/**
 * TOTP QR Code Capture Service
 * Browser-native QR code reading using qr-scanner
 */
class TotpCaptureService {
  /**
   * Captures QR code from active tab and returns TOTP secret
   * @returns {Promise<string|null>} otpauth:// URL or null
   */
  async captureTotpSecret() {
    try {
      // Capture screenshot of active tab
      const screenshot = await this.captureVisibleTab()

      // Load screenshot as image element
      const imageElement = await this.loadImageElement(screenshot)

      // Parse QR code
      const result = await QrScanner.scanImage(imageElement, {
        returnDetailedScanResult: true // Get detailed result with data property
      })

      if (!result || !result.data) {
        return null
      }

      const qrData = result.data
      const url = new URL(qrData)

      // Check for otpauth:// protocol and secret parameter
      if (url.protocol === 'otpauth:' && url.searchParams.has('secret')) {
        return qrData
      }

      return null
    } catch (error) {
      console.error('TOTP QR code capture error:', error)
      throw new Error(
        'Could not read QR code. Please ensure the QR code is clearly visible on screen.'
      )
    }
  }

  /**
   * Loads Base64 image as HTMLImageElement
   * @private
   * @param {string} dataUrl - Base64 encoded image
   * @returns {Promise<HTMLImageElement>}
   */
  async loadImageElement(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = dataUrl
    })
  }

  /**
   * Extracts secret key from otpauth:// URL
   * @param {string} otpauthUrl - URL in otpauth://totp/... format
   * @returns {string|null} Base32 encoded secret
   */
  extractSecret(otpauthUrl) {
    try {
      const url = new URL(otpauthUrl)
      if (url.protocol === 'otpauth:' && url.searchParams.has('secret')) {
        return url.searchParams.get('secret')
      }
      return null
    } catch (error) {
      console.error('Secret extraction error:', error)
      return null
    }
  }

  /**
   * Captures screenshot of active tab
   * @private
   * @returns {Promise<string>} Base64 encoded image
   */
  async captureVisibleTab() {
    try {
      // Capture active tab using Chrome/Firefox API
      const tabs = await browser.tabs.query({ active: true, currentWindow: true })

      if (!tabs || tabs.length === 0) {
        throw new Error('Active tab not found')
      }

      // Take screenshot
      const dataUrl = await browser.tabs.captureVisibleTab(null, {
        format: 'png'
      })

      return dataUrl
    } catch (error) {
      console.error('Screenshot capture error:', error)
      throw new Error(
        'Could not capture screenshot. Please ensure the extension has necessary permissions.'
      )
    }
  }

  /**
   * Checks if TOTP QR code capture feature is available
   * @returns {boolean}
   */
  canCaptureTotp() {
    // Check for browser API availability
    return !!(browser && browser.tabs && browser.tabs.captureVisibleTab)
  }
}

// Singleton instance
const totpCaptureService = new TotpCaptureService()

export default totpCaptureService
