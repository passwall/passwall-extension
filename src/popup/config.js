import Vue from 'vue'
import store from '@p/store'
import router from '@p/router'

import browser from 'webextension-polyfill'
Vue.prototype.$browser = browser

import '@/mixins/global'

import * as Waiters from '@/utils/waiters'
Vue.prototype.$waiters = Waiters

import * as Constants from '@/utils/constants'
Vue.prototype.$c = Constants

import storage from '@/utils/storage'
Vue.prototype.$storage = storage

import * as Helpers from '@/utils/helpers'
Vue.prototype.$helpers = Helpers

import VeeValidate from 'vee-validate'
Vue.use(VeeValidate, { events: 'input|blur' })

import VueClipboard from 'vue-clipboard2'
Vue.use(VueClipboard)

import VTooltip from 'v-tooltip'
Vue.use(VTooltip)

import VueWait from 'vue-wait'
Vue.use(VueWait)

import vOutsideEvents from 'vue-outside-events'
Vue.use(vOutsideEvents)

import Notifications from 'vue-notification'
Vue.use(Notifications, { duration: 3000 })
Vue.prototype.$notifyError = text => Vue.prototype.$notify({ type: 'error', text })
Vue.prototype.$notifyWarn = text => Vue.prototype.$notify({ type: 'warn', text })
Vue.prototype.$notifySuccess = text => Vue.prototype.$notify({ type: 'success', text })

window.wait = new VueWait({
  registerComponent: false,
  registerDirective: false
})

Vue.directive('click-outside', {
  bind: function(el, binding, vnode) {
    el.clickOutsideEvent = function(event) {
      // here I check that click was outside the el and his children
      if (!(el == event.target || el.contains(event.target))) {
        // and if it did, call method provided in attribute value
        vnode.context[binding.expression](event)
      }
    }
    document.body.addEventListener('click', el.clickOutsideEvent)
  },
  unbind: function(el) {
    document.body.removeEventListener('click', el.clickOutsideEvent)
  }
})
// Auto register all components
const requireComponent = require.context('../components', true, /\.(vue)$/)
requireComponent.keys().forEach(fileName => {
  const componentConfig = requireComponent(fileName)
  Vue.component(componentConfig.default.name, componentConfig.default)
})

Vue.prototype.$request = async (callback, waitKey, errorCallback = null, retry = false) => {
  window.wait.start(waitKey)

  try {
    await callback()
  } catch (error) {
    console.error(error)

    // No connection
    if (!error.response) {
      Vue.prototype.$notifyError('Network Error !')
      Vue.prototype.$wait.end(waitKey)
      return
    }

    if (error.response.status === 401 && !router.app._route.meta.auth && !retry) {
      // Refresh token
      try {
        await store.dispatch('RefreshToken')
        Helpers.messageToBackground({ type: 'REFRESH_TOKENS' })
        // Retry the connection
        return Vue.prototype.$request(callback, waitKey, errorCallback, true)
      } catch (refreshError) {
        Vue.prototype.$notifyError('Authorization expired.')

        // Reset all tokens
        await store.dispatch('Logout')
        return router.push({ name: 'Login' })
      }
    }

    if (errorCallback) {
      errorCallback(error)
    } else if (error.response.status >= 500) {
      Vue.prototype.$notifyError(i18n.t('API500ErrorMessage'))
    } else if (error.response.data.Message && error.response.status != 401) {
      Vue.prototype.$notifyError(error.response.data.Message)
    }
  } finally {
    window.wait.end(waitKey)
  }
}

if (
  // From testing the following conditions seem to indicate that the popup was opened on a secondary monitor
  window.screenLeft < 0 ||
  window.screenTop < 0 ||
  window.screenLeft > window.screen.width ||
  window.screenTop > window.screen.height
) {
  chrome.runtime.getPlatformInfo(function(info) {
    if (info.os === 'mac') {
      const fontFaceSheet = new CSSStyleSheet()
      fontFaceSheet.insertRule(`
        @keyframes redraw {
          0% {
            opacity: 1;
          }
          100% {
            opacity: .99;
          }
        }
      `)
      fontFaceSheet.insertRule(`
        html {
          animation: redraw 1s linear infinite;
        }
      `)
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, fontFaceSheet]
    }
  })
}
