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
      window.parent.postMessage(JSON.stringify(data), '*')
    },
    on(event, func) {
      this.listeners[event] = func
    }
  }
})
