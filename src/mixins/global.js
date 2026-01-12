import Vue from 'vue'
import browser from 'webextension-polyfill'

Vue.mixin({
  data() {
    return {
      listeners: {}
    }
  },
  created() {
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
      const eventFunc = this.listeners[request.type]
      if (eventFunc) eventFunc(request, sender, sendResponse)
    })
  },
  methods: {
    messageToBackground(data = {}) {
      browser.runtime.sendMessage({ ...data, who: 'popup' })
    },
    messageToContentScript(data = {}) {
      const parentOrigin = window.location?.ancestorOrigins?.[0] || '*'
      const nonce = window.__PASSWALL_NONCE
      const payload = nonce ? { ...data, nonce } : data
      window.parent.postMessage(JSON.stringify(payload), parentOrigin)
    },
    on(event, func) {
      this.listeners[event] = func
    }
  }
})
