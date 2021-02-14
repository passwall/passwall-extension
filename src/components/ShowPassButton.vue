<template>
  <button
    type="button"
    class="showpass-btn"
    v-tooltip="$t(isShow ? 'Hide' : 'Show')"
    v-on="inputListeners"
  >
    <VIcon class="c-pointer" :name="isShow ? 'eye-off' : 'eye'" size="20px" />
  </button>
</template>

<script>
export default {
  name: 'ShowPassButton',
  data() {
    return { isShow: false }
  },
  computed: {
    inputListeners() {
      return Object.assign({}, this.$listeners, {
        click: event => {
          this.isShow = !this.isShow
          return this.$emit('click', this.isShow)
        }
      })
    }
  }
}
</script>

<style lang="scss">
.showpass-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background-color: $color-gray-500;
  color: $color-gray-300;
}
</style>
