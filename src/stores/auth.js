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
        console.warn('Failed to restore keys from session:', error)
      }

      // Security check: If user is logged in but userKey is missing, force logout
      if (access_token && !this.userKey) {
        console.error('User key missing but access token exists. Forcing logout for security...')
        await this.logout()
        return
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
      const { data } = await AuthService.SignIn({
        email,
        master_password_hash: authKeyBase64
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
      const userKeyB64 = cryptoService.arrayToBase64(this.userKey.toBytes())
      const masterKeyB64 = cryptoService.arrayToBase64(this.masterKey)

      if (SessionStorage.isSupported()) {
        try {
          await SessionStorage.setAccessLevelTrustedContexts()
          await Promise.all([
            SessionStorage.setItem(SESSION_KEYS.userKey, userKeyB64),
            SessionStorage.setItem(SESSION_KEYS.masterKey, masterKeyB64)
          ])
        } catch {
          // Fallback
          window?.sessionStorage?.setItem?.('userKey', userKeyB64)
          window?.sessionStorage?.setItem?.('masterKey', masterKeyB64)
        }
      } else {
        // Fallback for environments without storage.session
        window?.sessionStorage?.setItem?.('userKey', userKeyB64)
        window?.sessionStorage?.setItem?.('masterKey', masterKeyB64)
      }

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
      const userKeyB64 = cryptoService.arrayToBase64(this.userKey.toBytes())
      const masterKeyB64 = cryptoService.arrayToBase64(this.masterKey)

      if (SessionStorage.isSupported()) {
        try {
          await SessionStorage.setAccessLevelTrustedContexts()
          await Promise.all([
            SessionStorage.setItem(SESSION_KEYS.userKey, userKeyB64),
            SessionStorage.setItem(SESSION_KEYS.masterKey, masterKeyB64)
          ])
        } catch {
          // Fallback
          window?.sessionStorage?.setItem?.('userKey', userKeyB64)
          window?.sessionStorage?.setItem?.('masterKey', masterKeyB64)
        }
      } else {
        // Fallback for environments without storage.session
        window?.sessionStorage?.setItem?.('userKey', userKeyB64)
        window?.sessionStorage?.setItem?.('masterKey', masterKeyB64)
      }

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

      // Preserve email and server for convenience
      const email = await Storage.getItem('email')
      const server = await Storage.getItem('server')

      await Storage.clear()

      await Promise.all([Storage.setItem('email', email), Storage.setItem('server', server)])

      Helpers.messageToBackground({ type: EVENT_TYPES.LOGOUT })
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

      console.log('✅ Master password changed successfully')
    },

    setSearchQuery(event) {
      this.searchQuery = event.target.value
    }
  }
})

