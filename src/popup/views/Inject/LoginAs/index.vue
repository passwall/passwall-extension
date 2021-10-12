<template>
  <div ref="window" class="px-3 py-4 window">
    <h1>Login AS</h1>
  </div>
</template>

<script>
export default {
  name: 'LoginAsPopup',
  mounted() {
    // Tell dynamic height to content scirpt.
    const resizeObserver = new ResizeObserver(([box]) => {
      const currentHeight = box.borderBoxSize[0].blockSize
      this.messageToBackground({
        type: 'LOGIN_AS_POPUP_RESIZE',
        payload: { height: currentHeight }
      })
    })
    resizeObserver.observe(this.$refs.window)
  }
}
</script>

<style lang="scss" scoped></style>
