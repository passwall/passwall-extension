<template>
  <li
    class="d-flex flex-justify-between flex-content-center py-3 c-pointer item"
    v-bind="$attrs"
    @click="handleClick"
  >
    <CompanyLogo :url="url" :check="check" />
    <div class="flex-auto ml-3">
      <p class="fs-medium fw-medium c-white" v-text="title" />
      <p class="fs-small fw-medium c-gray-300 mt-1" v-text="subtitle" />
    </div>
    <VIcon name="arrow-right" color="#8B93A1" />
  </li>
</template>

<script>
export default {
  name: 'ListItem',
  inheritAttrs: false, // Handle click manually

  emits: ['click'],
  
  props: {
    url: {
      type: String,
      default: ''
    },
    title: {
      type: String,
      default: ''
    },
    subtitle: {
      type: String,
      default: ''
    },
    check: {
      type: Boolean,
      default: true
    },
    itemData: {
      type: Object,
      default: () => ({})
    }
  },
  
  methods: {
    handleClick() {
      this.$emit('click', this.itemData)
    }
  }
}
</script>

<style lang="scss" scoped>
.item {
  border-bottom: 2px solid $color-black;
}
</style>
