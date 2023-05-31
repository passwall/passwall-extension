import { createApp } from 'vue';
import './config'
import '../styles/app.scss'

import request from './config.js'
import App from './App.vue'
import router from '@p/router'
import store from '@p/store'
import i18n from '@/i18n'
import HTTPClient from '@/api/HTTPClient'
import Storage from '@/utils/storage'

import browser from 'webextension-polyfill'
import storage from '@/utils/storage'
import * as Waiters from '@/utils/waiters'
import * as Constants from '@/utils/constants'
import * as Helpers from '@/utils/helpers'
import * as VeeValidate from 'vee-validate'
import VueClipboard from 'vue-clipboard2'
import VTooltip from 'v-tooltip'
import Notifications from '@kyvg/vue3-notification'
import mixin from '@/mixins/global'

import { createVueWait } from 'vue-wait'
const VueWait = createVueWait()

const requireComponent = require.context('../components', true, /\.(vue)$/)

import { onUnmounted } from 'vue';

const clickOutsideEvent = (event, node, callback) => {
  // Check if the clicked element is outside the provided node
  if (node && !node.contains(event.target) && callback && typeof callback === 'function') {
    callback();
  }
}

const clickOutsideDirective = {
  mounted(el, binding) {
    const callback = binding.value;

    // Attach the click event listener
    const clickHandler = (event) => clickOutsideEvent(event, el, callback);
    document.body.addEventListener('click', clickHandler);

    // Cleanup on component unmount
    onUnmounted(() => {
      document.body.removeEventListener('click', clickHandler);
    })
  },
}

  ; (async () => {
    await store.dispatch('init')
    const token = await Storage.getItem('access_token')
    if (token) {
      HTTPClient.setHeader('Authorization', `Bearer ${token}`)
    }

    /* eslint-disable no-new */
    const app = createApp(App)
    app.use(router)
    app.use(store)
    app.use(i18n)
    app.use(VeeValidate, { events: 'input|blur' })
    app.use(VueClipboard)
    app.use(VTooltip)
    app.use(VueWait)
    app.use(Notifications, { duration: 3000 })
    app.use(request)

    app.config.globalProperties.$request = request
    app.config.globalProperties.$browser = browser
    app.config.globalProperties.$waiters = Waiters
    app.config.globalProperties.$c = Constants
    app.config.globalProperties.$storage = storage
    app.config.globalProperties.$helpers = Helpers
    app.config.globalProperties.$notifyError = text => app.config.globalProperties.$notify({ type: 'error', text })
    app.config.globalProperties.$notifyWarn = text => app.config.globalProperties.$notify({ type: 'warn', text })
    app.config.globalProperties.$notifySuccess = text => app.config.globalProperties.$notify({ type: 'success', text })

    window.wait = app.config.globalProperties.$wait

    app.directive('click-outside', clickOutsideDirective)

    // Auto register all components
    requireComponent.keys().forEach((fileName) => {
      const componentConfig = requireComponent(fileName)
      const component = componentConfig.default
      const componentName = component.name
      app.component(componentName, component)
    })

    app.mixin(mixin)

    app.mount('#app')
  })()


