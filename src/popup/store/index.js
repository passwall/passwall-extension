import Vue from 'vue'
import Vuex from 'vuex'
Vue.use(Vuex)

import CryptoUtils from '@/utils/crypto'
import HTTPClient from '@/api/HTTPClient'
import AuthService from '@/api/services/Auth'

import Logins from '@p/views/Logins/store'
import CreditCards from '@/popup/views/CreditCards/store'
import Emails from '@p/views/Emails/store'
import BankAccounts from '@p/views/BankAccounts/store'
import Notes from '@p/views/Notes/store'
import Servers from '@p/views/Servers/store'

export default new Vuex.Store({
  state() {
    CryptoUtils.encryptKey = localStorage.master_hash
    CryptoUtils.transmissionKey = localStorage.transmission_key

    return {
      access_token: localStorage.access_token,
      refresh_token: localStorage.refresh_token,
      transmission_key: localStorage.transmission_key,
      master_hash: localStorage.master_hash,
      searchQuery: '',

      user: {
        // TODO : User bilgisi dinamik yapılacak.
        name: 'Erhan Yakut'
      }
    }
  },
  getters: {
    hasProPlan(state) {
      return state.user.status == 'active'
    }
  },

  actions: {
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

      localStorage.email = payload.email
      localStorage.server = payload.server
      localStorage.access_token = data.access_token
      localStorage.refresh_token = data.refresh_token
      if (process.env.NODE_ENV !== 'production') {
        localStorage.master_hash = state.master_hash
        localStorage.transmission_key = state.transmission_key
      }

      HTTPClient.setHeader('Authorization', `Bearer ${state.access_token}`)
    },

    Logout({ state }) {
      state.access_token = null
      state.refresh_token = null
      state.transmission_key = null
      state.master_hash = null
      state.user = null
      const lsKeys = Object.keys(localStorage).filter(
        key => ['email', 'server'].includes(key) === false
      )
      lsKeys.forEach(key => localStorage.removeItem(key))
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
    Servers
  }
})
