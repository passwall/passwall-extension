import Vue from 'vue'
import store from '@p/store'
import router from '@p/router'

import browser from 'webextension-polyfill'
Vue.prototype.$browser = browser

import * as Waiters from '@/utils/waiters'
Vue.prototype.$waiters = Waiters

import * as Constants from '@/utils/constants'
Vue.prototype.$c = Constants

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

import Notifications from 'vue-notification'
Vue.use(Notifications, { duration: 2500 })
Vue.prototype.$notifyError = text => Vue.prototype.$notify({ type: 'error', text })

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

Vue.prototype.$request = async (callback, waitKey, errorCallback = null) => {
  try {
    window.wait.start(waitKey)
    await callback()
  } catch (error) {
    console.log(error)

    if (error.response) {
      console.log(error.response)
      if (error.response.status === 401 && !router.app._route.meta.auth) {
        store.dispatch('Logout')
        return router.push({ name: 'Login' })
      }

      if (errorCallback) {
        errorCallback(error)
      } else if (error.response.status >= 500) {
        Vue.prototype.$notifyError(i18n.t('API500ErrorMessage'))
      } else if (error.response.data.Message && error.response.status != 401) {
        Vue.prototype.$notifyError(error.response.data.Message)
      }
    } else {
      Vue.prototype.$notifyError('Network Error !')
    }
  } finally {
    window.wait.end(waitKey)
  }
}
