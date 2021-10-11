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

export default new Vuex.Store({
  state() {
    return {
      access_token: '',
      refresh_token: '',
      transmission_key: '',
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
      CryptoUtils.transmissionKey = await Storage.getItem('transmission_key')

      state.access_token = await Storage.getItem('access_token')
      state.refresh_token = await Storage.getItem('refresh_token')
      state.transmission_key = await Storage.getItem('transmission_key')
      state.master_hash = await Storage.getItem('master_hash')
      state.user = await Storage.getItem('user')

      if (state.user !== null) {
        state.pro = state.user.type == 'pro'
      }
    },

    async RefreshToken({ state }, payload) {
      var token = await Storage.getItem('refresh_token')
      const { data } = await AuthService.Refresh({ refresh_token: token })

      state.access_token = data.access_token
      state.refresh_token = data.refresh_token
      state.transmission_key = data.transmission_key.substr(0, 32)
      CryptoUtils.transmissionKey = state.transmission_key

      // P.S.: Because we don't have a payload, we didn't update the master hash

      await Promise.all([
        Storage.setItem('access_token', data.access_token),
        Storage.setItem('refresh_token', data.refresh_token),
        Storage.setItem('transmission_key', state.transmission_key)
      ])

      HTTPClient.setHeader('Authorization', `Bearer ${state.access_token}`)
    },

    async Login({ state }, payload) {
      payload.master_password = CryptoUtils.sha256Encrypt(payload.master_password)

      const { data } = await AuthService.Login(payload)

      state.access_token = data.access_token
      state.refresh_token = data.refresh_token
      state.transmission_key = data.transmission_key.substr(0, 32)
      state.master_hash = CryptoUtils.pbkdf2Encrypt(data.secret, payload.master_password)
      CryptoUtils.encryptKey = state.master_hash
      CryptoUtils.transmissionKey = state.transmission_key
      state.user = data
      state.pro = state.user.type == 'pro'

      await Promise.all([
        Storage.setItem('email', payload.email),
        Storage.setItem('server', payload.server),
        Storage.setItem('access_token', data.access_token),
        Storage.setItem('refresh_token', data.refresh_token),
        Storage.setItem('user', data),
        Storage.setItem('master_hash', state.master_hash),
        Storage.setItem('transmission_key', state.transmission_key)
      ])

      HTTPClient.setHeader('Authorization', `Bearer ${state.access_token}`)
    },

    async Logout({ state }) {
      const email = await Storage.getItem('email')
      const server = await Storage.getItem('server')
      await Storage.clear()
      state.access_token = null
      state.refresh_token = null
      state.transmission_key = null
      state.master_hash = null
      state.user = null
      await Storage.setItem('email', email)
      await Storage.setItem('server', server)
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
    ChangeMasterPassword
  }
})
