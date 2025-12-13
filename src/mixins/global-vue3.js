import browser from 'webextension-polyfill'

// Global mixin for Vue 3
export default {
  data() {
    return {
      listeners: {}
    }
  },
  created() {
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
      window.parent.postMessage(JSON.stringify(data), '*')
    },
    on(event, func) {
      this.listeners[event] = func
    }
  }
}

