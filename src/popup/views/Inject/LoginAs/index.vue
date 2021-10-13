<template>
  <div ref="window" class="px-3 py-4 window">
    <header class="d-flex flex-items-center flex-justify-between">
      <div class="d-flex flex-row flex-items-center">
        <VIcon name="passwall-logo" size="32px" />
        <p class="fs-medium fw-bold ml-2">LOG IN AS</p>
      </div>
      <VIcon name="cross" size="20px" class="c-gray-300 mr-2 c-pointer" @click="closePopup" />
    </header>
    <ul class="mt-2">
      <li
        v-for="login in logins"
        :key="login.id"
        class="d-flex flex-row bg-black p-3 w-100 flex-items-center flex-justify-between radius c-pointer no-select"
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
      logins: []
    }
  },
  created() {
    this.on('LOGIN_AS_POPUP_FETCH', request => {
      this.logins = request.payload
      console.log(request.payload)
    })
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
}
</style>
