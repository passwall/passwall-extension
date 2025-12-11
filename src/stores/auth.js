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
    async init() {
      CryptoUtils.encryptKey = await Storage.getItem('master_hash')

      this.access_token = await Storage.getItem('access_token')
      this.refresh_token = await Storage.getItem('refresh_token')
      this.master_hash = await Storage.getItem('master_hash')
      this.user = await Storage.getItem('user')

      const server = await Storage.getItem('server')
      HTTPClient.setBaseURL(server)

      if (this.user !== null) {
        this.pro = this.user.type === 'pro'
      }
    },

    async refreshToken(payload) {
      const token = await Storage.getItem('refresh_token')
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

    async login(payload) {
      payload.master_password = CryptoUtils.sha256Encrypt(payload.master_password)

      const { data } = await AuthService.Login(payload)

      this.access_token = data.access_token
      this.refresh_token = data.refresh_token
      this.master_hash = CryptoUtils.pbkdf2Encrypt(data.secret, payload.master_password)
      CryptoUtils.encryptKey = this.master_hash
      this.user = data
      this.pro = this.user.type === 'pro'

      await Promise.all([
        Storage.setItem('email', payload.email),
        Storage.setItem('server', payload.server),
        Storage.setItem('access_token', data.access_token),
        Storage.setItem('refresh_token', data.refresh_token),
        Storage.setItem('user', data),
        Storage.setItem('master_hash', this.master_hash),
        Storage.setItem('is_migrated', data.is_migrated)
      ])

      HTTPClient.setHeader('Authorization', `Bearer ${this.access_token}`)
      Helpers.messageToBackground({ type: EVENT_TYPES.LOGIN })
    },

    async logout() {
      const email = await Storage.getItem('email')
      const server = await Storage.getItem('server')
      
      await Storage.clear()
      
      this.access_token = null
      this.refresh_token = null
      this.master_hash = null
      this.user = null
      
      await Storage.setItem('email', email)
      await Storage.setItem('server', server)
      
      Helpers.messageToBackground({ type: EVENT_TYPES.LOGOUT })
    },

    async loadStore() {
      this.user = await Storage.getItem('user')
    },

    setSearchQuery(event) {
      this.searchQuery = event.target.value
    }
  }
})

