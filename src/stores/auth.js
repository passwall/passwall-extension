import { defineStore } from 'pinia'
import CryptoUtils from '@/utils/crypto'
import HTTPClient from '@/api/HTTPClient'
import AuthService from '@/api/services/Auth'
import Storage from '@/utils/storage'
import * as Helpers from '@/utils/helpers'
import { EVENT_TYPES } from '@/utils/constants'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    access_token: '',
    refresh_token: '',
    master_hash: '',
    searchQuery: '',
    pro: false,
    user: null
  }),

  getters: {
    hasProPlan: (state) => state.pro,
    isAuthenticated: (state) => !!state.access_token,
    currentUser: (state) => state.user
  },

  actions: {
    /**
     * Initialize auth store from storage
     * Called on app startup to restore authentication state
     */
    async init() {
      // Load all auth data in parallel for better performance
      const [access_token, refresh_token, master_hash, user, server] = await Promise.all([
        Storage.getItem('access_token'),
        Storage.getItem('refresh_token'),
        Storage.getItem('master_hash'),
        Storage.getItem('user'),
        Storage.getItem('server')
      ])

      this.access_token = access_token || ''
      this.refresh_token = refresh_token || ''
      this.master_hash = master_hash || ''
      this.user = user

      // Set crypto key for decryption
      if (master_hash) {
        CryptoUtils.encryptKey = master_hash
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
        this.pro = this.user.type === 'pro'
      }
    },

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
     * Login user with email and master password
     * @param {Object} payload - Login credentials
     * @param {string} payload.email - User email
     * @param {string} payload.master_password - Master password (will be hashed)
     * @param {string} payload.server - Server URL
     */
    async login(payload) {
      // Hash master password for API
      const hashedPassword = CryptoUtils.sha256Encrypt(payload.master_password)
      
      const { data } = await AuthService.Login({
        ...payload,
        master_password: hashedPassword
      })

      // Generate master hash for encryption/decryption
      this.master_hash = CryptoUtils.pbkdf2Encrypt(data.secret, hashedPassword)
      this.access_token = data.access_token
      this.refresh_token = data.refresh_token
      this.user = data
      this.pro = this.user.type === 'pro'

      // Configure crypto and HTTP client
      CryptoUtils.encryptKey = this.master_hash
      HTTPClient.setHeader('Authorization', `Bearer ${this.access_token}`)
      HTTPClient.setBaseURL(payload.server)

      // Persist to storage
      await Promise.all([
        Storage.setItem('email', payload.email),
        Storage.setItem('server', payload.server),
        Storage.setItem('access_token', data.access_token),
        Storage.setItem('refresh_token', data.refresh_token),
        Storage.setItem('user', data),
        Storage.setItem('master_hash', this.master_hash),
        Storage.setItem('is_migrated', data.is_migrated)
      ])

      // Notify background script
      Helpers.messageToBackground({ type: EVENT_TYPES.LOGIN })
    },

    async logout() {
      // Clear state first
      this.access_token = ''
      this.refresh_token = ''
      this.master_hash = ''
      this.user = null
      this.pro = false
      this.searchQuery = ''
      CryptoUtils.encryptKey = null
      HTTPClient.setHeader('Authorization', '')
      
      // Preserve email and server for convenience
      const email = await Storage.getItem('email')
      const server = await Storage.getItem('server')
      
      await Storage.clear()
      
      await Promise.all([
        Storage.setItem('email', email),
        Storage.setItem('server', server)
      ])
      
      Helpers.messageToBackground({ type: EVENT_TYPES.LOGOUT })
    },

    /**
     * Load user data from storage
     * Used by App.vue to refresh user state on popup open
     */
    async loadStore() {
      this.user = await Storage.getItem('user')
      if (this.user !== null) {
        this.pro = this.user.type === 'pro'
      }
    },

    setSearchQuery(event) {
      this.searchQuery = event.target.value
    }
  }
})

