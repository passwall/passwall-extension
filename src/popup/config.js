import { createApp } from 'vue'
import browser from 'webextension-polyfill'
import { notify } from '@kyvg/vue3-notification'
import FloatingVue from 'floating-vue'
import VueClipboard from 'vue-clipboard3'
import Notifications from '@kyvg/vue3-notification'
import globalMixin from '@/mixins/global-vue3'

import * as Waiters from '@/utils/waiters'
import * as Constants from '@/utils/constants'
import storage from '@/utils/storage'
import * as Helpers from '@/utils/helpers'

import { reactive } from 'vue'

// Custom wait implementation to replace vue-wait (Vue 3 reactive)
class Wait {
  constructor() {
    this.state = reactive({
      waitingFor: new Set()
    })
  }

  start(key) {
    console.log('⏳ Wait START:', key)
    this.state.waitingFor.add(key)
  }

  end(key) {
    console.log('✅ Wait END:', key)
    this.state.waitingFor.delete(key)
  }

  is(key) {
    const waiting = this.state.waitingFor.has(key)
    console.log('🔍 Wait.is(' + key + '):', waiting)
    return waiting
  }

  any() {
    return this.state.waitingFor.size > 0
  }
}

import { useAuthStore } from '@/stores/auth'

export function setupPlugins(app, router, pinia, i18n) {
  // Register global mixin
  app.mixin(globalMixin)
  
  // Global properties (Vue 2: Vue.prototype.$x → Vue 3: app.config.globalProperties.$x)
  app.config.globalProperties.$browser = browser
  app.config.globalProperties.$waiters = Waiters
  app.config.globalProperties.$c = Constants
  app.config.globalProperties.$storage = storage
  app.config.globalProperties.$helpers = Helpers
  
  // Wait functionality
  const wait = new Wait()
  app.config.globalProperties.$wait = wait
  window.wait = wait

  // Plugins
  app.use(FloatingVue, {
    themes: {
      tooltip: {
        delay: { show: 200, hide: 0 }
      }
    }
  })
  
  app.use(VueClipboard, {
    autoSetContainer: true
  })

  app.use(Notifications, { duration: 3000 })

  // Notification helpers
  app.config.globalProperties.$notify = notify
  app.config.globalProperties.$notifyError = (text) => notify({ type: 'error', text })
  app.config.globalProperties.$notifyWarn = (text) => notify({ type: 'warn', text })
  app.config.globalProperties.$notifySuccess = (text) => notify({ type: 'success', text })

  // Global directives
  app.directive('click-outside', {
    mounted(el, binding) {
      el.clickOutsideEvent = function(event) {
        if (!(el === event.target || el.contains(event.target))) {
          binding.value(event)
        }
      }
      document.body.addEventListener('click', el.clickOutsideEvent)
    },
    unmounted(el) {
      document.body.removeEventListener('click', el.clickOutsideEvent)
    }
  })

  // Auto-register components globally
  const componentModules = import.meta.glob('../components/**/*.vue', { eager: true })
  Object.entries(componentModules).forEach(([path, module]) => {
    const componentName = module.default.name || path.split('/').pop().replace(/\.\w+$/, '')
    app.component(componentName, module.default)
  })

  // Global request handler with loading states
  app.config.globalProperties.$request = async (callback, waitKey, errorCallback = null, retry = false) => {
    wait.start(waitKey)
    console.log('🔵 $request called, waitKey:', waitKey)

    try {
      await callback()
      console.log('✅ $request callback completed')
    } catch (error) {
      console.error('❌ $request error:', error)

      // No connection
      if (!error.response) {
        notify({ type: 'error', text: 'Network Error!' })
        wait.end(waitKey)
        return
      }

      if (error.response.status === 401 && !router.currentRoute.value.meta.auth && !retry) {
        // Refresh token
        try {
          const authStore = useAuthStore()
          console.log('🔄 Attempting token refresh...')
          await authStore.refreshToken()
          // Retry the connection
          return app.config.globalProperties.$request(callback, waitKey, errorCallback, true)
        } catch (refreshError) {
          notify({ type: 'error', text: 'Authorization expired.' })
          
          // Reset all tokens
          const authStore = useAuthStore()
          await authStore.logout()
          return router.push({ name: 'Login' })
        }
      }

      if (errorCallback) {
        errorCallback(error)
      } else if (error.response.status >= 500) {
        notify({ type: 'error', text: i18n.global.t('API500ErrorMessage') })
      } else if (error.response.data.Message && error.response.status !== 401) {
        notify({ type: 'error', text: error.response.data.Message })
      }
    } finally {
      wait.end(waitKey)
      console.log('🔵 $request completed, wait ended')
    }
  }

  // macOS secondary monitor fix
  if (
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
            0% { opacity: 1; }
            100% { opacity: .99; }
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
}

