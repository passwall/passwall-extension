import { authenticator } from '@otplib/preset-browser'

/**
 * TOTP (Time-based One-Time Password) Utility
 * Handles TOTP code generation and management
 */
class TotpService {
  constructor() {
    // Configure TOTP settings
    authenticator.options = {
      digits: 6,        // 6-digit code
      step: 30,         // 30 seconds
      window: 1         // 1 window tolerance
    }
  }

  /**
   * Generates TOTP code from secret
   * @param {string} secret - Base32 encoded secret or otpauth:// URL
   * @returns {string|null} 6-digit TOTP code or null
   */
  generateCode(secret) {
    try {
      if (!secret) return null

      // If otpauth:// URL, extract the secret
      const actualSecret = this.extractSecretFromUrl(secret)
      
      // Remove spaces and dashes
      const cleanSecret = actualSecret.replace(/[\s-]/g, '').toUpperCase()
      
      // Generate TOTP code
      const token = authenticator.generate(cleanSecret)
      return token
    } catch (error) {
      console.error('TOTP code generation error:', error)
      return null
    }
  }

  /**
   * Formats TOTP code (3-3 format: 123 456)
   * @param {string} code - 6-digit code
   * @returns {string} Formatted code
   */
  formatCode(code) {
    if (!code || code.length !== 6) return code
    return `${code.substring(0, 3)} ${code.substring(3, 6)}`
  }

  /**
   * Verifies TOTP code validity
   * @param {string} token - Token to verify
   * @param {string} secret - Secret key
   * @returns {boolean}
   */
  verify(token, secret) {
    try {
      const actualSecret = this.extractSecretFromUrl(secret)
      const cleanSecret = actualSecret.replace(/[\s-]/g, '').toUpperCase()
      return authenticator.verify({ token, secret: cleanSecret })
    } catch (error) {
      console.error('TOTP verification error:', error)
      return false
    }
  }

  /**
   * Calculates remaining time in current TOTP period (in seconds)
   * @returns {number} Remaining seconds (0-30 range)
   */
  getRemainingSeconds() {
    const epoch = Math.floor(Date.now() / 1000)
    const step = 30
    return step - (epoch % step)
  }

  /**
   * Calculates percentage value for progress bar
   * @returns {number} Percentage (0-100 range)
   */
  getProgress() {
    const remaining = this.getRemainingSeconds()
    return Math.floor((remaining / 30) * 100)
  }

  /**
   * Checks if code is about to expire (last 5 seconds)
   * @returns {boolean}
   */
  isExpiringSoon() {
    return this.getRemainingSeconds() <= 5
  }

  /**
   * Extracts secret from otpauth:// URL, or returns input directly if not a URL
   * @private
   * @param {string} input - Secret or otpauth URL
   * @returns {string} Secret
   */
  extractSecretFromUrl(input) {
    try {
      if (input.startsWith('otpauth://')) {
        const url = new URL(input)
        return url.searchParams.get('secret') || input
      }
      return input
    } catch (error) {
      return input
    }
  }

  /**
   * Checks if secret is valid
   * @param {string} secret - Secret to validate
   * @returns {boolean}
   */
  isValidSecret(secret) {
    try {
      if (!secret) return false
      const actualSecret = this.extractSecretFromUrl(secret)
      const cleanSecret = actualSecret.replace(/[\s-]/g, '').toUpperCase()
      
      // Check Base32 format (only A-Z and 2-7 digits)
      const base32Regex = /^[A-Z2-7]+=*$/
      return base32Regex.test(cleanSecret) && cleanSecret.length >= 16
    } catch (error) {
      return false
    }
  }

  /**
   * Returns TOTP information reactively
   * @param {string} secret - TOTP secret
   * @returns {Object} TOTP information
   */
  getTotpInfo(secret) {
    const code = this.generateCode(secret)
    const remaining = this.getRemainingSeconds()
    const progress = this.getProgress()
    const expiring = this.isExpiringSoon()

    return {
      code,                           // 6-digit code
      formattedCode: this.formatCode(code),  // Formatted code
      remaining,                      // Remaining seconds
      progress,                       // Progress percentage
      expiring,                       // Is expiring soon
      isValid: this.isValidSecret(secret)    // Is secret valid
    }
  }
}

// Singleton instance
const totpService = new TotpService()

export default totpService

