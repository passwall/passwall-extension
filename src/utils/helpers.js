import browser from 'webextension-polyfill'
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

  let generatedPassword = ''
  for (let i = 0; i < passwordLength; i++) {
    generatedPassword += charSet.charAt(Math.floor(Math.random() * charSet.length))
  }
    
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
  if (str.length > maxLength) {
    switch (side) {
      case 'start':
        return ellipsis + str.slice(-(maxLength - ellipsis.length))
      case 'end':
      default:
        return str.slice(0, maxLength - ellipsis.length) + ellipsis
    }
  }
  return str
}

export function getHostName(url) {
  var match = url.match(/:\/\/(www[0-9]?\.)?(.[^/:]+)/i)
  if (match != null && match.length > 2 && typeof match[2] === 'string' && match[2].length > 0) {
    return match[2]
  } else {
    return null
  }
}

export function getDomain(url = "") {
  var hostName = getHostName(url)
  var domain = hostName

  if (hostName != null) {
    var parts = hostName.split('.').reverse()

    if (parts != null && parts.length > 1) {
      domain = parts[1] + '.' + parts[0]

      if (hostName.toLowerCase().indexOf('.co.uk') != -1 && parts.length > 2) {
        domain = parts[2] + '.' + domain
      }
    }
  }

  return domain
}

export async function getCurrentTab() {
  return browser.tabs.query({ currentWindow: true, active: true }).then(([tab]) => {
    if (!BROWSER_URL_PATTERNS.some(pattern => pattern.test(tab.url))) {
      return tab
    }
    return null
  })
}
