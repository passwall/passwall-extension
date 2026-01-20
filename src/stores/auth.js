/**
 * Auth Store
 * Zero-Knowledge Architecture
 */

import { defineStore } from 'pinia'
import { cryptoService, SymmetricKey, DEFAULT_KDF_CONFIG, PBKDF2_MIN_ITERATIONS } from '@/utils/crypto'
import HTTPClient from '@/api/HTTPClient'
import AuthService from '@/api/services/Auth'
import Storage from '@/utils/storage'
import SessionStorage, { SESSION_KEYS } from '@/utils/session-storage'
import * as Helpers from '@/utils/helpers'
import { EVENT_TYPES } from '@/utils/constants'
import { PIN_STORAGE_KEYS, clearPinData, hasPinProtection } from '@/utils/pin-storage'

// Build-time injected dev flag (guarded for tests)
const DEV_MODE = typeof __DEV_MODE__ !== 'undefined' ? __DEV_MODE__ : false

const isUUID = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''))

const createUUIDv4 = () => {
  const buf = new Uint8Array(16)
  crypto.getRandomValues(buf)
  // RFC 4122 v4
  buf[6] = (buf[6] & 0x0f) | 0x40
  buf[8] = (buf[8] & 0x3f) | 0x80
  const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20)}`
}

async function getOrCreateExtensionDeviceId(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const key = `passwall:extension:device_id:${normalizedEmail}`

  const existing = await Storage.getItem(key)
  if (existing && isUUID(existing)) return existing

  const newId =
    globalThis.crypto && 'randomUUID' in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : createUUIDv4()
  await Storage.setItem(key, newId)
  return newId
}

const PIN_KDF_ITERATIONS = 300000
const PIN_MIN_LENGTH = 4
const PIN_MAX_LENGTH = 12
const PIN_LOCK_THRESHOLD = 5

const normalizePin = (pin) => String(pin || '').trim()

const isValidPin = (pin) => /^\d+$/.test(pin) && pin.length >= PIN_MIN_LENGTH && pin.length <= PIN_MAX_LENGTH

async function persistSessionKeys(userKey, masterKey) {
  const userKeyB64 = userKey ? cryptoService.arrayToBase64(userKey.toBytes()) : null
  const masterKeyB64 = masterKey ? cryptoService.arrayToBase64(masterKey) : null

  if (SessionStorage.isSupported()) {
    try {
      await SessionStorage.setAccessLevelTrustedContexts()
      const items = []
      if (userKeyB64) items.push(SessionStorage.setItem(SESSION_KEYS.userKey, userKeyB64))
      if (masterKeyB64) items.push(SessionStorage.setItem(SESSION_KEYS.masterKey, masterKeyB64))
      await Promise.all(items)
      return
    } catch {
      // Fallback
    }
  }

  if (userKeyB64) {
    window?.sessionStorage?.setItem?.('userKey', userKeyB64)
  }
  if (masterKeyB64) {
    window?.sessionStorage?.setItem?.('masterKey', masterKeyB64)
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    access_token: '',
    refresh_token: '',
    // Keys (stored in session)
    userKey: null, // SymmetricKey instance
    masterKey: null, // Uint8Array
    // User data
    user: null,
    pro: false,
    searchQuery: ''
  }),

  getters: {
    hasProPlan: (state) => state.pro,
    isAuthenticated: (state) => !!state.access_token && !!state.userKey,
    currentUser: (state) => state.user,
    hasUserKey: (state) => state.userKey !== null
  },

  actions: {
    /**
     * Initialize auth store from storage
     */
    async init() {
      const [access_token, refresh_token, user, server] = await Promise.all([
        Storage.getItem('access_token'),
        Storage.getItem('refresh_token'),
        Storage.getItem('user'),
        Storage.getItem('server')
      ])

      this.access_token = access_token || ''
      this.refresh_token = refresh_token || ''
      this.user = user

      // Try to restore keys from extension session storage (survives MV3 SW restarts)
      const sessionSupported = SessionStorage.isSupported()
      try {
        if (sessionSupported) {
          await SessionStorage.setAccessLevelTrustedContexts()

          const [userKeyBase64, masterKeyBase64] = await Promise.all([
            SessionStorage.getItem(SESSION_KEYS.userKey),
            SessionStorage.getItem(SESSION_KEYS.masterKey)
          ])

          if (userKeyBase64) {
            const userKeyBytes = cryptoService.base64ToArray(userKeyBase64)
            this.userKey = SymmetricKey.fromBytes(userKeyBytes)
          }

          if (masterKeyBase64) {
            this.masterKey = cryptoService.base64ToArray(masterKeyBase64)
          }
        }

        // Secondary fallback for older builds or environments without storage.session.
        if (!this.userKey || !this.masterKey) {
          const userKeyFallback = window?.sessionStorage?.getItem?.('userKey')
          const masterKeyFallback = window?.sessionStorage?.getItem?.('masterKey')

          if (!this.userKey && userKeyFallback) {
            const userKeyBytes = cryptoService.base64ToArray(userKeyFallback)
            this.userKey = SymmetricKey.fromBytes(userKeyBytes)
          }
          if (!this.masterKey && masterKeyFallback) {
            this.masterKey = cryptoService.base64ToArray(masterKeyFallback)
          }
        }
      } catch (error) {
        if (DEV_MODE) {
          console.warn('Failed to restore keys from session:', Helpers.toSafeError(error))
        }
      }

      // Security check: If user is logged in but userKey is missing, allow PIN unlock if configured
      if (access_token && !this.userKey) {
        const hasPin = await hasPinProtection()
        if (!hasPin) {
          if (DEV_MODE) {
            console.warn('User key missing and no PIN. Forcing logout for security...')
          }
          await this.logout()
          return
        }
      }

      // Configure HTTP client
      if (server) {
        HTTPClient.setBaseURL(server)
      }

      if (access_token) {
        HTTPClient.setHeader('Authorization', `Bearer ${access_token}`)
      }

      // Set pro status
      if (this.user !== null) {
        this.pro = true
      }
    },

    /**
     * Sign In
     */
    async signIn(payload) {
      const { email, master_password, server } = payload

      // Configure HTTP client
      HTTPClient.setBaseURL(server)

      // 1. Get KDF config from server (PreLogin)
      const { data: kdfConfig } = await AuthService.PreLogin(email)

      // Validate KDF config (prevent downgrade attack)
      if (kdfConfig.kdf_type === 0 && kdfConfig.kdf_iterations < PBKDF2_MIN_ITERATIONS) {
        throw new Error(
          `KDF iterations too low (${kdfConfig.kdf_iterations}). ` +
            `Minimum required: ${PBKDF2_MIN_ITERATIONS}. ` +
            `This may be a downgrade attack!`
        )
      }

      // 2. Derive Master Key (client-side, never sent)
      this.masterKey = await cryptoService.makeMasterKey(
        master_password,
        kdfConfig.kdf_salt,
        kdfConfig
      )

      // 3. Generate Auth Key for server authentication
      const authKey = await cryptoService.hashMasterKey(this.masterKey)
      const authKeyBase64 = cryptoService.arrayToBase64(authKey)

      // 4. Sign in with server
      const deviceId = await getOrCreateExtensionDeviceId(email)
      const { data } = await AuthService.SignIn({
        email,
        master_password_hash: authKeyBase64,
        device_id: deviceId,
        app: 'extension'
      })

      // 5. Unwrap User Key (decrypt with Master Key)
      const stretchedMasterKey = await cryptoService.stretchMasterKey(this.masterKey)
      this.userKey = await cryptoService.unwrapUserKey(data.protected_user_key, stretchedMasterKey)

      // 6. Store tokens and user data
      this.access_token = data.access_token
      this.refresh_token = data.refresh_token
      this.user = data.user // Fix: Use data.user instead of data
      this.pro = true

      // 7. Configure HTTP client
      HTTPClient.setHeader('Authorization', `Bearer ${this.access_token}`)

      // 8. Persist to storage
      await Promise.all([
        Storage.setItem('email', email),
        Storage.setItem('server', server),
        Storage.setItem('access_token', data.access_token),
        Storage.setItem('refresh_token', data.refresh_token),
        Storage.setItem('user', data.user)
      ])

      // 9. Store keys in session storage (cleared on browser close)
      await persistSessionKeys(this.userKey, this.masterKey)

      // 10. Notify background script
      Helpers.messageToBackground({ type: EVENT_TYPES.LOGIN })
    },

    /**
     * Sign Up
     */
    async signUp(payload) {
      const { email, name, master_password, server } = payload

      // Configure HTTP client
      HTTPClient.setBaseURL(server)

      // 1. Generate random KDF salt (client-side)
      const kdfSalt = cryptoService.generateRandomHex(32) // 32 bytes = 64 hex chars

      // 2. Use default KDF config
      const kdfConfig = { ...DEFAULT_KDF_CONFIG, kdf_salt: kdfSalt }

      // 3. Derive Master Key (client-side, never sent)
      this.masterKey = await cryptoService.makeMasterKey(master_password, kdfSalt, kdfConfig)

      // 4. Generate Auth Key for server authentication
      const authKey = await cryptoService.hashMasterKey(this.masterKey)
      const authKeyBase64 = cryptoService.arrayToBase64(authKey)

      // 5. Stretch Master Key (HKDF)
      const stretchedMasterKey = await cryptoService.stretchMasterKey(this.masterKey)

      // 6. Generate User Key (random, once)
      this.userKey = await cryptoService.makeUserKey()

      // 7. Protect User Key with Master Key
      const protectedUserKey = await cryptoService.protectUserKey(this.userKey, stretchedMasterKey)

      // 8. Sign up with server
      const { data } = await AuthService.SignUp({
        email,
        name,
        master_password_hash: authKeyBase64,
        protected_user_key: protectedUserKey,
        kdf_salt: kdfSalt,
        kdf_config: {
          kdf_type: kdfConfig.kdf_type,
          kdf_iterations: kdfConfig.kdf_iterations
        }
      })

      // 9. Store tokens and user data
      this.access_token = data.access_token
      this.refresh_token = data.refresh_token
      this.user = data
      this.pro = true

      // 10. Configure HTTP client
      HTTPClient.setHeader('Authorization', `Bearer ${this.access_token}`)

      // 11. Persist to storage
      await Promise.all([
        Storage.setItem('email', email),
        Storage.setItem('server', server),
        Storage.setItem('access_token', data.access_token),
        Storage.setItem('refresh_token', data.refresh_token),
        Storage.setItem('user', data)
      ])

      // 12. Store keys in session storage
      await persistSessionKeys(this.userKey, this.masterKey)

      // 13. Notify background script
      Helpers.messageToBackground({ type: EVENT_TYPES.LOGIN })
    },

    /**
     * Login - Compatibility wrapper
     */
    async login(payload) {
      await this.signIn(payload)
    },

    /**
     * Refresh access token
     */
    async refreshToken() {
      const token = await Storage.getItem('refresh_token')

      if (!token) {
        throw new Error('No refresh token available')
      }

      const { data } = await AuthService.Refresh({ refresh_token: token })

      this.access_token = data.access_token
      this.refresh_token = data.refresh_token

      await Promise.all([
        Storage.setItem('access_token', data.access_token),
        Storage.setItem('refresh_token', data.refresh_token)
      ])

      HTTPClient.setHeader('Authorization', `Bearer ${this.access_token}`)
      Helpers.messageToBackground({ type: EVENT_TYPES.REFRESH_TOKENS })
    },

    /**
     * Logout user
     */
    async logout() {
      // Clear state first
      this.access_token = ''
      this.refresh_token = ''
      this.userKey = null
      this.masterKey = null
      this.user = null
      this.pro = false
      this.searchQuery = ''

      // Clear HTTP client
      HTTPClient.setHeader('Authorization', '')

      // Clear session keys (do not clear all session storage)
      if (SessionStorage.isSupported()) {
        try {
          await SessionStorage.removeItems([SESSION_KEYS.userKey, SESSION_KEYS.masterKey])
        } catch {
          // Fallback
          window?.sessionStorage?.removeItem?.('userKey')
          window?.sessionStorage?.removeItem?.('masterKey')
        }
      } else {
        // Fallback
        window?.sessionStorage?.removeItem?.('userKey')
        window?.sessionStorage?.removeItem?.('masterKey')
      }

      await clearPinData()

      // Preserve email and server for convenience
      const email = await Storage.getItem('email')
      const server = await Storage.getItem('server')

      await Storage.clear()

      await Promise.all([Storage.setItem('email', email), Storage.setItem('server', server)])

      Helpers.messageToBackground({ type: EVENT_TYPES.LOGOUT })
    },

    /**
     * Protect user key with a PIN (stored locally, encrypted)
     */
    async setPin(pin) {
      if (!this.userKey) {
        throw new Error('User key not available')
      }

      const normalizedPin = normalizePin(pin)
      if (!isValidPin(normalizedPin)) {
        throw new Error('PIN must be 4-12 digits')
      }

      const saltBytes = crypto.getRandomValues(new Uint8Array(16))
      const pinKeyBytes = await cryptoService.pbkdf2(
        normalizedPin,
        saltBytes,
        PIN_KDF_ITERATIONS,
        64,
        'SHA-256'
      )
      const pinKey = SymmetricKey.fromBytes(pinKeyBytes)
      const protectedUserKey = await cryptoService.encryptAesCbcHmac(
        this.userKey.toBytes(),
        pinKey
      )

      await Promise.all([
        Storage.setItem(PIN_STORAGE_KEYS.protectedUserKey, protectedUserKey),
        Storage.setItem(PIN_STORAGE_KEYS.kdfSalt, cryptoService.arrayToBase64(saltBytes)),
        Storage.setItem(PIN_STORAGE_KEYS.kdfIterations, PIN_KDF_ITERATIONS),
        Storage.setItem(PIN_STORAGE_KEYS.failedAttempts, 0),
        Storage.setItem(PIN_STORAGE_KEYS.lockUntil, null)
      ])
    },

    /**
     * Unlock with PIN and restore user key into session storage
     */
    async unlockWithPin(pin) {
      const [protectedUserKey, saltBase64, iterations] = await Promise.all([
        Storage.getItem(PIN_STORAGE_KEYS.protectedUserKey),
        Storage.getItem(PIN_STORAGE_KEYS.kdfSalt),
        Storage.getItem(PIN_STORAGE_KEYS.kdfIterations)
      ])

      if (!protectedUserKey || !saltBase64 || !iterations) {
        throw new Error('PIN unlock not configured')
      }

      const lockUntil = Number(await Storage.getItem(PIN_STORAGE_KEYS.lockUntil)) || 0
      if (lockUntil && Date.now() < lockUntil) {
        const err = new Error('PIN temporarily locked')
        err.type = 'PIN_LOCKED'
        err.lockUntil = lockUntil
        throw err
      }

      const normalizedPin = normalizePin(pin)
      if (!isValidPin(normalizedPin)) {
        throw new Error('PIN must be 4-12 digits')
      }

      const saltBytes = cryptoService.base64ToArray(saltBase64)
      try {
        const pinKeyBytes = await cryptoService.pbkdf2(
          normalizedPin,
          saltBytes,
          Number(iterations),
          64,
          'SHA-256'
        )
        const pinKey = SymmetricKey.fromBytes(pinKeyBytes)
        const userKeyBytes = await cryptoService.decryptAesCbcHmac(protectedUserKey, pinKey)

        this.userKey = SymmetricKey.fromBytes(userKeyBytes)
        this.masterKey = null
        await persistSessionKeys(this.userKey, null)
        await Promise.all([
          Storage.setItem(PIN_STORAGE_KEYS.failedAttempts, 0),
          Storage.setItem(PIN_STORAGE_KEYS.lockUntil, null)
        ])

        Helpers.messageToBackground({ type: EVENT_TYPES.LOGIN })
        return true
      } catch (error) {
        const currentAttempts = Number(await Storage.getItem(PIN_STORAGE_KEYS.failedAttempts)) || 0
        const attempts = currentAttempts + 1
        let lockUntilValue = null

        if (attempts >= PIN_LOCK_THRESHOLD) {
          const lockSeconds = Math.min(900, 30 * 2 ** (attempts - PIN_LOCK_THRESHOLD))
          lockUntilValue = Date.now() + lockSeconds * 1000
        }

        await Promise.all([
          Storage.setItem(PIN_STORAGE_KEYS.failedAttempts, attempts),
          Storage.setItem(PIN_STORAGE_KEYS.lockUntil, lockUntilValue)
        ])

        const err = new Error('Invalid PIN')
        err.type = 'INVALID_PIN'
        err.lockUntil = lockUntilValue
        throw err
      }
    },

    /**
     * Load user data from storage
     */
    async loadStore() {
      this.user = await Storage.getItem('user')
      if (this.user !== null) {
        this.pro = true
      }
    },

    /**
     * Change Master Password
     */
    async changeMasterPassword(payload) {
      if (!this.userKey || !this.masterKey) {
        throw new Error('User not authenticated or keys not loaded')
      }

      const { old_password, new_password } = payload

      // 1. Verify old password
      const email = await Storage.getItem('email')
      const { data: kdfConfig } = await AuthService.PreLogin(email)

      const oldMasterKey = await cryptoService.makeMasterKey(
        old_password,
        kdfConfig.kdf_salt,
        kdfConfig
      )

      if (!cryptoService.constantTimeEqual(oldMasterKey, this.masterKey)) {
        throw new Error('Old password is incorrect')
      }

      // 2. Generate new KDF salt (optional, can reuse old)
      const newKdfSalt = cryptoService.generateRandomHex(32)

      // 3. Derive new Master Key
      const newMasterKey = await cryptoService.makeMasterKey(new_password, newKdfSalt, kdfConfig)

      // 4. Stretch new Master Key
      const newStretchedKey = await cryptoService.stretchMasterKey(newMasterKey)

      // 5. Re-wrap User Key with new Master Key
      const newProtectedUserKey = await cryptoService.protectUserKey(this.userKey, newStretchedKey)

      // 6. Generate new Auth Key
      const newAuthKey = await cryptoService.hashMasterKey(newMasterKey)
      const newAuthKeyBase64 = cryptoService.arrayToBase64(newAuthKey)

      // 7. Send to server
      await AuthService.ChangeMasterPassword({
        new_master_password_hash: newAuthKeyBase64,
        new_protected_user_key: newProtectedUserKey,
        new_kdf_salt: newKdfSalt
      })

      // 8. Update local state
      this.masterKey = newMasterKey
      const masterKeyB64 = cryptoService.arrayToBase64(newMasterKey)
      if (SessionStorage.isSupported()) {
        try {
          await SessionStorage.setItem(SESSION_KEYS.masterKey, masterKeyB64)
        } catch {
          window?.sessionStorage?.setItem?.('masterKey', masterKeyB64)
        }
      } else {
        window?.sessionStorage?.setItem?.('masterKey', masterKeyB64)
      }

      // No console logs in production; UI should provide feedback if needed.
      if (DEV_MODE) {
        console.log('Master password changed successfully')
      }
    },

    setSearchQuery(event) {
      this.searchQuery = event.target.value
    }
  }
})

