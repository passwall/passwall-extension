import Vue from 'vue'
import Vuex from 'vuex'
Vue.use(Vuex)

import CryptoUtils from '@/utils/crypto'
import HTTPClient from '@/api/HTTPClient'
import AuthService from '@/api/services/Auth'

import Storage from '@/utils/storage'

import Logins from '@p/views/Logins/store'
import CreditCards from '@/popup/views/CreditCards/store'
import Emails from '@p/views/Emails/store'
import BankAccounts from '@p/views/BankAccounts/store'
import Notes from '@p/views/Notes/store'
import Servers from '@p/views/Servers/store'
import ChangeMasterPassword from '@p/views/ChangeMasterPassword/store'
import Migration from '@p/views/Migration/store'
import * as Helpers from '@/utils/helpers'
import { EVENT_TYPES } from '@/utils/constants'

export default new Vuex.Store({
  state() {
    return {
      access_token: '',
      refresh_token: '',
      master_hash: '',
      searchQuery: '',
      pro: false,

      user: {}
    }
  },
  getters: {
    hasProPlan(state) {
      return state.pro
    }
  },

  actions: {
    async init({ state }) {
      CryptoUtils.encryptKey = await Storage.getItem('master_hash')

      state.access_token = await Storage.getItem('access_token')
      state.refresh_token = await Storage.getItem('refresh_token')
      state.master_hash = await Storage.getItem('master_hash')
      state.user = await Storage.getItem('user')

      const server = await Storage.getItem('server')
      HTTPClient.setBaseURL(server)

      if (state.user !== null) {
        state.pro = state.user.type == 'pro'
      }
    },

    async RefreshToken({ state }, payload) {
      var token = await Storage.getItem('refresh_token')
      const { data } = await AuthService.Refresh({ refresh_token: token })

      state.access_token = data.access_token
      state.refresh_token = data.refresh_token

      // P.S.: Because we don't have a payload, we didn't update the master hash

      await Promise.all([
        Storage.setItem('access_token', data.access_token),
        Storage.setItem('refresh_token', data.refresh_token),
      ])

      HTTPClient.setHeader('Authorization', `Bearer ${state.access_token}`)
      Helpers.messageToBackground({ type: EVENT_TYPES.REFRESH_TOKENS })
    },

    async Login({ state }, payload) {
      payload.master_password = CryptoUtils.sha256Encrypt(payload.master_password)

      const { data } = await AuthService.Login(payload)

      state.access_token = data.access_token
      state.refresh_token = data.refresh_token
      state.master_hash = CryptoUtils.pbkdf2Encrypt(data.secret, payload.master_password)
      CryptoUtils.encryptKey = state.master_hash
      state.user = data
      state.pro = state.user.type == 'pro'

      await Promise.all([
        Storage.setItem('email', payload.email),
        Storage.setItem('server', payload.server),
        Storage.setItem('access_token', data.access_token),
        Storage.setItem('refresh_token', data.refresh_token),
        Storage.setItem('user', data),
        Storage.setItem('master_hash', state.master_hash),
        Storage.setItem('is_migrated', data.is_migrated),
      ])

      HTTPClient.setHeader('Authorization', `Bearer ${state.access_token}`)
      Helpers.messageToBackground({ type: EVENT_TYPES.LOGIN })
    },

    async Logout({ state }) {
      const email = await Storage.getItem('email')
      const server = await Storage.getItem('server')
      await Storage.clear()
      state.access_token = null
      state.refresh_token = null
      state.master_hash = null
      state.user = null
      await Storage.setItem('email', email)
      await Storage.setItem('server', server)
      Helpers.messageToBackground({ type: EVENT_TYPES.LOGOUT })
    },
    async loadStore({ state }) {
      state.user = await Storage.getItem('user')
    }
  },
  mutations: {
    onInputSearchQuery(state, event) {
      state.searchQuery = event.target.value
    }
  },

  modules: {
    Logins,
    CreditCards,
    Emails,
    BankAccounts,
    Notes,
    Servers,
    ChangeMasterPassword,
    Migration
  }
})
