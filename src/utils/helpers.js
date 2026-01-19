import browser from 'webextension-polyfill'
import { parse } from 'tldts'
import { BROWSER_URL_PATTERNS } from './constants'
import Storage from '@/utils/storage'

export async function generatePassword() {
  const chars = {
    alphabet: 'abcdefghijklmnopqrstuvwxyz',
    numeric: '0123456789',
    special: '_-+=)/(*&^%$#@%!?~'
  }

  let complexities = [
    { name: 'abc', value: chars.alphabet, checked: true, visible: false },
    { name: 'Numbers', value: chars.numeric, checked: true },
    { name: 'Symbols', value: chars.special, checked: false },
    { name: 'Capital Letters', value: chars.alphabet.toUpperCase(), checked: true }
  ]

  let passwordLength = 10

  const storagePasswordLength = await Storage.getItem('passwordLength')
  if (storagePasswordLength !== null) {
    passwordLength = storagePasswordLength
  }

  const storageComplexities = await Storage.getItem('complexities')
  if (storageComplexities !== null) {
    complexities = storageComplexities
  }

  const charSet = complexities
    .filter(item => item.checked)
    .reduce((acc, current) => {
      return acc + current.value
    }, '')

  const minLength = 12
  const finalLength = Math.max(passwordLength, minLength)
  const lowerSet = chars.alphabet
  const upperSet = chars.alphabet.toUpperCase()
  const numberSet = chars.numeric
  const specialSet = chars.special

  const getRandomChar = (set) => set.charAt(Math.floor(Math.random() * set.length))
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  const requiredChars = [
    getRandomChar(lowerSet),
    getRandomChar(upperSet),
    getRandomChar(numberSet),
    getRandomChar(specialSet)
  ]

  const remainingLength = Math.max(finalLength - requiredChars.length, 0)
  const passwordChars = [...requiredChars]

  for (let i = 0; i < remainingLength; i++) {
    passwordChars.push(getRandomChar(charSet || lowerSet + upperSet + numberSet + specialSet))
  }

  const generatedPassword = shuffle(passwordChars).join('')

  return generatedPassword
}

export function isValidHttpUrl(string) {
  let url

  try {
    url = new URL(string)
  } catch (_) {
    return false
  }

  return url.protocol === 'http:' || url.protocol === 'https:'
}

export function parseHostName(string) {
  try {
    const { hostname } = new URL(string)
    return hostname
  } catch (error) {
    return string
  }
}

export function textEllipsis(str, maxLength, { side = 'end', ellipsis = '...' } = {}) {
  const safe = (str ?? '').toString()
  if (safe.length > maxLength) {
    switch (side) {
      case 'start':
        return ellipsis + safe.slice(-(maxLength - ellipsis.length))
      case 'end':
      default:
        return safe.slice(0, maxLength - ellipsis.length) + ellipsis
    }
  }
  return safe
}

/**
 * Extract hostname from URL (full subdomain)
 * Example: https://signin.aws.amazon.com → signin.aws.amazon.com
 */
export function getHostName(url) {
  if (url == null || url.length === 0) {
    return null
  }
  
  var match = url.match(/:\/\/(www[0-9]?\.)?(.[^/:]+)/i)
  if (match != null && match.length > 2 && typeof match[2] === 'string' && match[2].length > 0) {
    return match[2]
  } else {
    return null
  }
}

/**
 * Extract base domain from URL using tldts library (Bitwarden-style)
 * Removes subdomains and returns only the main domain
 * 
 * Uses the official Public Suffix List for accurate TLD detection
 * 
 * Examples:
 *   https://signin.aws.amazon.com → amazon.com
 *   https://www.amazon.com → amazon.com
 *   https://eu-north-1.signin.aws.amazon.com → amazon.com
 *   https://accounts.google.com → google.com
 *   https://login.microsoftonline.com → microsoftonline.com
 *   https://giris.hepsiburada.com.tr → hepsiburada.com.tr (double TLD)
 *   https://secure.example.co.uk → example.co.uk (double TLD)
 * 
 * @param {string} url - Full URL string
 * @returns {string|null} Base domain or null
 */
export function getDomain(url) {
  if (url == null || url.length === 0) {
    return null
  }

  // Handle data: and about: URLs
  if (url.startsWith('data:') || url.startsWith('about:')) {
    return null
  }

  try {
    // Parse URL using tldts (same library as Bitwarden)
    const parseResult = parse(url, {
      allowPrivateDomains: true, // Allow private/local domains
    })

    if (parseResult != null && parseResult.hostname != null) {
      // Handle localhost and IP addresses
      if (parseResult.hostname === 'localhost' || parseResult.isIp) {
        return parseResult.hostname
      }

      // Return the domain (e.g., amazon.com, hepsiburada.com.tr)
      if (parseResult.domain != null) {
        return parseResult.domain
      }

      return null
    }
  } catch (error) {
    console.error('Error parsing domain:', error)
    return null
  }

  return null
}

export async function getCurrentTab() {
  return browser.tabs.query({ currentWindow: true, active: true }).then(([tab]) => {
    if (!BROWSER_URL_PATTERNS.some(pattern => pattern.test(tab.url))) {
      return tab
    }
    return null
  })
}

export function messageToBackground(data = {}) {
  return browser.runtime.sendMessage({ ...data, who: 'popup' })
}

/**
 *
 * @param {HTMLElement} el
 *
 */
export function getOffset(el) {
  const rect = el.getBoundingClientRect()

  return {
    left: rect.left + window.scrollX,
    top: rect.top + window.scrollY,
    width: rect.width,
    height: rect.height
  }
}

export class PFormParseError extends Error {
  /**
   *
   * @param {string} message
   * @param {('NO_PASSWORD_FIELD')} type
   */
  constructor(message, type) {
    super(message)
    this.name = 'PFormParseError'
    this.type = type
  }
}

export class RequestError extends Error {
  /**
   *
   * @param {string} message
   * @param {('NO_AUTH' | 'NO_LOGINS' | 'AUTH_EXPIRED' | 'FETCH_ERROR' | 'SAVE_ERROR' | 'VALIDATION_ERROR')} type
   */
  constructor(message, type) {
    super(message)
    this.type = type
  }
}

/**
 * Create a minimal, non-sensitive error shape for logging.
 * IMPORTANT: Never log raw Axios errors (they may include request headers/tokens).
 * @param {any} err
 * @returns {{name?: string, message?: string, code?: string, type?: string, status?: number}}
 */
export function toSafeError(err) {
  const status = err?.response?.status
  return {
    name: typeof err?.name === 'string' ? err.name : undefined,
    message: typeof err?.message === 'string' ? err.message : undefined,
    code: typeof err?.code === 'string' ? err.code : undefined,
    type: typeof err?.type === 'string' ? err.type : undefined,
    status: typeof status === 'number' ? status : undefined
  }
}

/**
 *
 * @param {RuntimeRequest} data
 * @returns {Promise<any>}
 */
export async function sendPayload(data) {
  const response = await browser.runtime.sendMessage({ ...data, who: 'content-script' })
  
  // If response contains an error, throw it as a RequestError
  if (response && response.error) {
    throw new RequestError(response.error, response.errorType)
  }
  
  return response
}
