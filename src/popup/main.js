import Vue from 'vue'
import './config'

import App from './App.vue'
import router from '@p/router'
import store from '@p/store'
import i18n from '@/i18n'
import HTTPClient from '@/api/HTTPClient'
import '../styles/app.scss'

if (localStorage.access_token) {
  HTTPClient.setHeader('Authorization', `Bearer ${localStorage.access_token}`)
}

/* eslint-disable no-new */
new Vue({
  router,
  store,
  i18n,
  wait: window.wait,
  el: '#app',
  render: h => h(App)
})
