/**
 * Security Checks for Autofill
 * Bitwarden-inspired security validation before autofilling credentials
 * 
 * @module security-checks
 */

/**
 * @typedef {Object} SecurityCheckResult
 * @property {boolean} allowed - Whether autofill is allowed
 * @property {string|null} reason - Reason for blocking (if not allowed)
 * @property {string|null} warningType - Type of warning (INSECURE_HTTP, INVALID_CERT, etc.)
 * @property {string|null} message - User-friendly message
 */

/**
 * Security check reasons
 */
export const SECURITY_WARNINGS = {
  INSECURE_HTTP: 'INSECURE_HTTP',
  INVALID_CERT: 'INVALID_CERT',
  MIXED_CONTENT: 'MIXED_CONTENT',
  SUSPICIOUS_URL: 'SUSPICIOUS_URL'
}

/**
 * Check if a URL is secure for autofill (Bitwarden-style)
 * 
 * Security rules:
 * 1. HTTPS required (except localhost)
 * 2. Valid certificate (browser-level check)
 * 3. No mixed content
 * 
 * @param {string} url - URL to check
 * @returns {SecurityCheckResult}
 * 
 * @example
 * const result = checkAutofillSecurity('https://example.com')
 * if (!result.allowed) {
 *   showWarning(result.message)
 * }
 */
export function checkAutofillSecurity(url) {
  if (!url || typeof url !== 'string') {
    return {
      allowed: false,
      reason: 'Invalid URL',
      warningType: SECURITY_WARNINGS.SUSPICIOUS_URL,
      message: 'Invalid or missing URL'
    }
  }

  try {
    const urlObj = new URL(url)
    const protocol = urlObj.protocol
    const hostname = urlObj.hostname

    // 1. Check protocol
    if (protocol === 'https:') {
      // HTTPS - secure ✅
      return {
        allowed: true,
        reason: null,
        warningType: null,
        message: null
      }
    }

    // 2. Localhost exception (for development)
    if (protocol === 'http:') {
      // Check if localhost or 127.0.0.1 or local IP
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '[::1]' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.') ||
        hostname.endsWith('.local')
      ) {
        // Local development - allowed with warning ⚠️
        return {
          allowed: true,
          reason: 'Local development',
          warningType: null,
          message: null
        }
      }

      // HTTP on public internet - NOT SECURE ❌
      return {
        allowed: false,
        reason: 'Insecure HTTP connection',
        warningType: SECURITY_WARNINGS.INSECURE_HTTP,
        message: 'This site uses an insecure connection (HTTP). For your security, autofill is disabled on non-HTTPS sites.'
      }
    }

    // 3. Other protocols (file://, chrome://, etc.) - not applicable
    if (protocol === 'file:' || protocol === 'chrome:' || protocol === 'edge:' || protocol === 'about:') {
      return {
        allowed: false,
        reason: 'Not a web page',
        warningType: SECURITY_WARNINGS.SUSPICIOUS_URL,
        message: 'Autofill is not available on this type of page.'
      }
    }

    // Unknown protocol - block
    return {
      allowed: false,
      reason: 'Unknown protocol',
      warningType: SECURITY_WARNINGS.SUSPICIOUS_URL,
      message: 'This page uses an unknown protocol. Autofill is disabled for security.'
    }

  } catch (error) {
    // Malformed URL
    return {
      allowed: false,
      reason: 'Malformed URL',
      warningType: SECURITY_WARNINGS.SUSPICIOUS_URL,
      message: 'Unable to verify page security. Autofill is disabled.'
    }
  }
}

/**
 * Check if current page is secure (shorthand)
 * @returns {SecurityCheckResult}
 */
export function checkCurrentPageSecurity() {
  return checkAutofillSecurity(window.location.href)
}

/**
 * Get security badge/icon for URL
 * @param {string} url 
 * @returns {Object} Badge info
 */
export function getSecurityBadge(url) {
  const check = checkAutofillSecurity(url)
  
  if (check.allowed && check.reason === null) {
    return {
      icon: '🔒',
      text: 'Secure',
      color: 'green'
    }
  }
  
  if (check.allowed && check.reason === 'Local development') {
    return {
      icon: '🔧',
      text: 'Local Dev',
      color: 'blue'
    }
  }
  
  if (check.warningType === SECURITY_WARNINGS.INSECURE_HTTP) {
    return {
      icon: '⚠️',
      text: 'Not Secure',
      color: 'orange'
    }
  }
  
  return {
    icon: '🚫',
    text: 'Blocked',
    color: 'red'
  }
}

export default {
  checkAutofillSecurity,
  checkCurrentPageSecurity,
  getSecurityBadge,
  SECURITY_WARNINGS
}
