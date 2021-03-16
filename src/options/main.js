import Vue from 'vue'
import App from './App.vue'

import '../styles/app.scss'

import storage from '@/utils/storage'
Vue.prototype.$storage = storage

/* eslint-disable no-new */
new Vue({
  el: '#app',
  render: h => h(App)
})
