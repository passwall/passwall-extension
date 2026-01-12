import browser from 'webextension-polyfill'

// Global mixin for Vue 3
export default {
  data() {
    return {
      listeners: {}
    }
  },
  created() {
    try {
      const url = new URL(window.location.href)
      const nonceFromUrl = url.searchParams.get('pw_nonce')
      if (nonceFromUrl) {
        window.__PASSWALL_NONCE = nonceFromUrl
      }
    } catch {
      // ignore
    }

    // Listen to messages from background script
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
      const eventFunc = this.listeners[request.type]
      if (eventFunc) eventFunc(request, sender, sendResponse)
    })

    // Listen to messages from content script (via window.postMessage)
    const messageHandler = (event) => {
      if (typeof event.data !== 'string') return

      try {
        const message = JSON.parse(event.data)

        // Handshake from content script: sets per-iframe nonce for outbound messages
        if (message?.type === 'PASSWALL_HANDSHAKE' && typeof message?.nonce === 'string') {
          window.__PASSWALL_NONCE = message.nonce
          return
        }

        const eventFunc = this.listeners[message.type]

        if (eventFunc) {
          eventFunc(message, event)
        }
      } catch (error) {
        // Not a valid JSON message, ignore
      }
    }

    window.addEventListener('message', messageHandler)
  },
  methods: {
    messageToBackground(data = {}) {
      return browser.runtime.sendMessage({ ...data, who: 'popup' })
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
}
