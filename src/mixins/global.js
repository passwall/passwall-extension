import Vue from 'vue'
Vue.mixin({
  methods: {
    messageToBackground(data = {}) {
      this.$browser.runtime.sendMessage({ ...data, who: 'popup' })
    }
  }
})
