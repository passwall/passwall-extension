/**
 * Auth Store
 * Zero-Knowledge Architecture
 */

import { defineStore } from 'pinia'
import {
  cryptoService,
  SymmetricKey,
  DEFAULT_KDF_CONFIG,
  PBKDF2_MIN_ITERATIONS,
  generateOrganizationKey,
  wrapOrgKeyWithUserKey
} from '@/utils/crypto'
import HTTPClient from '@/api/HTTPClient'
import AuthService from '@/api/services/Auth'
import OrganizationsService from '@/api/services/Organizations'
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
  const normalizedEmail = String(email || '')
    .trim()
    .toLowerCase()
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

const isValidPin = (pin) =>
  /^\d+$/.test(pin) && pin.length >= PIN_MIN_LENGTH && pin.length <= PIN_MAX_LENGTH

async function persistUserKey(userKey) {
  const userKeyB64 = userKey ? cryptoService.arrayToBase64(userKey.toBytes()) : null
  if (!userKeyB64) return

  if (SessionStorage.isSupported()) {
    try {
      await SessionStorage.setAccessLevelTrustedContexts()
      await SessionStorage.setItem(SESSION_KEYS.userKey, userKeyB64)
      return
    } catch {
      // Fallback
    }
  }

  window?.sessionStorage?.setItem?.('userKey', userKeyB64)
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    access_token: '',
    refresh_token: '',
    // Keys (stored in session)
    userKey: null, // SymmetricKey instance
    // User data
    user: null,
    pro: false,
    searchQuery: '',
    /** @type {Array<{id: number, name: string, is_default: boolean, encrypted_org_key: string, plan: string}>} */
    organizations: [],
    /** @type {number|null} */
    defaultOrgId: null
  }),

  getters: {
    hasProPlan: (state) => state.pro,
    isAuthenticated: (state) => !!state.access_token && !!state.userKey,
    currentUser: (state) => state.user,
    hasUserKey: (state) => state.userKey !== null,
    /** Get the default organization */
    defaultOrganization: (state) =>
      state.organizations.find((o) => o.is_default) || state.organizations[0] || null,
    /** Get all org IDs */
    organizationIds: (state) => state.organizations.map((o) => o.id)
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

      // Try to restore userKey from extension session storage (survives MV3 SW restarts)
      try {
        if (SessionStorage.isSupported()) {
          await SessionStorage.setAccessLevelTrustedContexts()
          const userKeyBase64 = await SessionStorage.getItem(SESSION_KEYS.userKey)

          if (userKeyBase64) {
            const userKeyBytes = cryptoService.base64ToArray(userKeyBase64)
            this.userKey = SymmetricKey.fromBytes(userKeyBytes)
          }
        }

        // Secondary fallback for older builds or environments without storage.session.
        if (!this.userKey) {
          const userKeyFallback = window?.sessionStorage?.getItem?.('userKey')
          if (userKeyFallback) {
            const userKeyBytes = cryptoService.base64ToArray(userKeyFallback)
            this.userKey = SymmetricKey.fromBytes(userKeyBytes)
          }
        }
      } catch (error) {
        if (DEV_MODE) {
          console.warn('Failed to restore userKey from session:', Helpers.toSafeError(error))
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

      // Restore organizations from storage
      const orgs = await Storage.getItem('organizations')
      if (Array.isArray(orgs) && orgs.length > 0) {
        this.organizations = orgs
        const defaultOrg = orgs.find((o) => o.is_default) || orgs[0]
        this.defaultOrgId = defaultOrg?.id || null
      }

      // If authenticated, refresh orgs from server (non-blocking)
      if (access_token && this.userKey) {
        this.fetchOrganizations().catch(() => {})
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

      // 2. Derive Master Key (client-side, never sent, not persisted)
      const masterKey = await cryptoService.makeMasterKey(
        master_password,
        kdfConfig.kdf_salt,
        kdfConfig
      )

      // 3. Generate Auth Key for server authentication
      const authKey = await cryptoService.hashMasterKey(masterKey)
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
      const stretchedMasterKey = await cryptoService.stretchMasterKey(masterKey)
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

      // 9. Store userKey in session storage (cleared on browser close)
      await persistUserKey(this.userKey)

      // 10. Fetch organizations after login
      await this.fetchOrganizations()

      // 11. Notify background script
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

      // 3. Derive Master Key (client-side, never sent, not persisted)
      const masterKey = await cryptoService.makeMasterKey(master_password, kdfSalt, kdfConfig)

      // 4. Generate Auth Key for server authentication
      const authKey = await cryptoService.hashMasterKey(masterKey)
      const authKeyBase64 = cryptoService.arrayToBase64(authKey)

      // 5. Stretch Master Key (HKDF)
      const stretchedMasterKey = await cryptoService.stretchMasterKey(masterKey)

      // 6. Generate User Key (random, once)
      this.userKey = await cryptoService.makeUserKey()

      // 7. Protect User Key with Master Key
      const protectedUserKey = await cryptoService.protectUserKey(this.userKey, stretchedMasterKey)

      // 7.5 Generate Organization Key for the default (personal) organization
      const orgKey = await generateOrganizationKey()
      const encryptedOrgKey = await wrapOrgKeyWithUserKey(orgKey, this.userKey)

      // 8. Sign up with server
      const { data } = await AuthService.SignUp({
        email,
        name,
        master_password_hash: authKeyBase64,
        protected_user_key: protectedUserKey,
        encrypted_org_key: encryptedOrgKey,
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

      // 12. Store userKey in session storage
      await persistUserKey(this.userKey)

      // 12.5. Fetch organizations after signup
      await this.fetchOrganizations()

      // 13. Notify background script
      Helpers.messageToBackground({ type: EVENT_TYPES.LOGIN })
    },

    /**
     * Fetch all organizations the user belongs to from the server.
     * Stores them in state and persists to storage.
     */
    async fetchOrganizations() {
      try {
        const { data } = await OrganizationsService.GetAll()
        const orgs = Array.isArray(data) ? data : []
        this.organizations = orgs
        const defaultOrg = orgs.find((o) => o.is_default) || orgs[0]
        this.defaultOrgId = defaultOrg?.id || null
        await Storage.setItem('organizations', orgs)
      } catch (error) {
        if (DEV_MODE) {
          console.warn('Failed to fetch organizations:', Helpers.toSafeError(error))
        }
      }
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
     * Logout user (manual logout - clears ALL data including PIN)
     *
     * This is called when user explicitly clicks "Log out".
     * PIN data is intentionally cleared because user chose to fully log out.
     *
     * Note: When tokens expire (session timeout), HTTPClient triggers
     * AUTH_ERROR which calls background's handleSessionLock() instead.
     * That method preserves PIN data so users can unlock with PIN.
     */
    async logout() {
      // Clear state first
      this.access_token = ''
      this.refresh_token = ''
      this.userKey = null
      this.user = null
      this.pro = false
      this.searchQuery = ''
      this.organizations = []
      this.defaultOrgId = null

      // Clear HTTP client
      HTTPClient.setHeader('Authorization', '')

      // Clear session keys (do not clear all session storage)
      if (SessionStorage.isSupported()) {
        try {
          await SessionStorage.removeItem(SESSION_KEYS.userKey)
        } catch {
          // Fallback
          window?.sessionStorage?.removeItem?.('userKey')
        }
      } else {
        // Fallback
        window?.sessionStorage?.removeItem?.('userKey')
      }

      // Clear PIN data on manual logout (user chose to fully log out)
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
      const protectedUserKey = await cryptoService.encryptAesCbcHmac(this.userKey.toBytes(), pinKey)

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
        await persistUserKey(this.userKey)
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

    setSearchQuery(event) {
      this.searchQuery = event.target.value
    }
  }
})
