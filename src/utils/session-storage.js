import browser from 'webextension-polyfill'

/**
 * Session-only storage wrapper for MV3 extensions.
 *
 * Goal:
 * - Keep decrypted keys in memory for the *browser session*,
 * - Survive MV3 service worker restarts,
 * - Avoid persisting secrets to disk.
 *
 * Notes:
 * - Chrome MV3: chrome.storage.session persists across SW restarts, cleared on browser close.
 * - Firefox: browser.storage.session exists (115+), also cleared on browser close.
 * - We intentionally keep values as strings (base64) to avoid structured-clone pitfalls.
 */

function getSessionArea() {
  // webextension-polyfill exposes `browser.storage.session` when supported.
  if (browser?.storage?.session) return browser.storage.session

  // Fallback for environments where polyfill doesn't expose it but Chrome API exists.
  // eslint-disable-next-line no-undef
  if (typeof chrome !== 'undefined' && chrome?.storage?.session) return chrome.storage.session

  return null
}

const SESSION_AREA = getSessionArea()

const KEY_PREFIX = 'pw_session_'

function k(key) {
  return `${KEY_PREFIX}${key}`
}

async function setAccessLevelTrustedContexts() {
  // Prevent content scripts from reading session storage even if the browser allows it.
  // Best-effort: some browsers may not implement this.
  try {
    if (!SESSION_AREA?.setAccessLevel) return
    await SESSION_AREA.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
  } catch {
    // ignore
  }
}

async function getItem(key) {
  if (!SESSION_AREA) return null
  const result = await SESSION_AREA.get(k(key))
  const value = result?.[k(key)]
  return value !== undefined ? value : null
}

async function setItem(key, value) {
  if (!SESSION_AREA) return
  await SESSION_AREA.set({ [k(key)]: value })
}

async function removeItem(key) {
  if (!SESSION_AREA) return
  await SESSION_AREA.remove(k(key))
}

async function removeItems(keys) {
  if (!SESSION_AREA) return
  await SESSION_AREA.remove(keys.map(k))
}

export const SESSION_KEYS = Object.freeze({
  userKey: 'userKey',
  masterKey: 'masterKey',
})

export default {
  isSupported: () => Boolean(SESSION_AREA),
  setAccessLevelTrustedContexts,
  getItem,
  setItem,
  removeItem,
  removeItems,
}

