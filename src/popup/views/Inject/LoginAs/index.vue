<template>
  <div ref="window" class="px-3 py-4 window">
    <header class="d-flex flex-items-center flex-justify-between">
      <div class="d-flex flex-row flex-items-center">
        <VIcon name="passwall-logo" size="32px" />
        <p class="fs-medium fw-bold ml-2 c-white">LOG IN AS</p>
      </div>
      <VIcon name="cross" size="20px" class="c-gray-300 mr-2 c-pointer" @click="closePopup" />
    </header>

    <!-- Authentication Required Message -->
    <div v-if="authError === 'NO_AUTH'" class="mt-3 p-4 bg-black-400 radius text-center">
      <div class="mb-3" style="font-size: 48px;">🔒</div>
      <p class="fs-large fw-bold mb-2 c-white">Authentication Required</p>
      <p class="c-white mb-1" style="font-size: 14px;">Please log in to Passwall extension</p>
      <p class="c-white" style="font-size: 14px;">to access your passwords.</p>
      <p class="mt-3 fw-medium" style="font-size: 14px; color: #a78bfa;">Click the Passwall icon to sign in →</p>
    </div>

    <!-- No Logins Found Message -->
    <div v-else-if="authError === 'NO_LOGINS'" class="mt-3 p-4 bg-black-400 radius text-center">
      <div class="mb-3" style="font-size: 48px;">📝</div>
      <p class="fs-large fw-bold mb-2 c-white">No Passwords Found</p>
      <p class="c-white mb-1" style="font-size: 14px;">You don't have any saved passwords</p>
      <p class="c-white" style="font-size: 14px;">for this website.</p>
      <p class="mt-3 fw-medium" style="font-size: 14px; color: #a78bfa;">Add one from the Passwall extension →</p>
    </div>

    <!-- Login List -->
    <ul v-else class="mt-2">
      <li
        v-for="login in logins"
        :key="login.id"
        class="d-flex flex-row bg-black-400 p-3 w-100 flex-items-center flex-justify-between radius c-pointer no-select mb-2"
        @click="onClickItem(login)"
      >
        <div class="d-flex flex-row">
          <CompanyLogo :url="login.url" check />
          <div class="ml-2">
            <p>{{ login.title || login.url }}</p>
            <p class="c-gray-300">{{ login.username }}</p>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  name: 'LoginAsPopup',
  data() {
    return {
      logins: [],
      authError: null
    }
  },
  created() {
    console.log('🚀 [LoginAs] Component created! Listening for messages...')

    this.on('LOGIN_AS_POPUP_FETCH', request => {
      const payload = request.payload || {}
      const logins = payload.logins || []
      const authError = payload.authError || null
      
      console.log('📨 [LoginAs] Received message:', logins.length, 'logins, authError:', authError)
      this.logins = logins
      this.authError = authError
      console.log('✅ [LoginAs] State updated:', this.logins.length, 'logins')
    })

    console.log('📤 [LoginAs] Requesting logins from content script...')
    this.messageToContentScript({ type: 'LOGIN_AS_POPUP_FETCH' })
  },
  mounted() {
    // Tell dynamic height to content scirpt.
    const resizeObserver = new ResizeObserver(([box]) => {
      const currentHeight = box.borderBoxSize[0].blockSize
      this.messageToContentScript({
        type: 'LOGIN_AS_POPUP_RESIZE',
        payload: { height: currentHeight }
      })
    })
    resizeObserver.observe(this.$refs.window)
  },
  methods: {
    closePopup() {
      this.messageToContentScript({ type: 'LOGIN_AS_POPUP_CLOSE' })
    },
    onClickItem(item) {
      this.messageToContentScript({ type: 'LOGIN_AS_POPUP_FILL_FORM', payload: item })
    }
  }
}
</script>

<style lang="scss" scoped>
ul {
  max-height: 300px;
  overflow-y: auto;
  
  li:last-child {
    margin-bottom: 0;
  }
}
</style>
