<template>
  <svg
    :width="width || size"
    :height="height || size"
    :transform="`rotate(${rotation} 0 0)`"
    v-bind="$attrs"
    class="v-icon no-select"
    preserveAspectRatio="xMidYMid meet"
    :viewBox="getViewBox"
  >
    <use :xlink:href="`#${name}`" />
  </svg>
</template>

<script>
export default {
  name: 'VIcon',
  inheritAttrs: false,
  
  props: {
    name: String,
    width: [String, Number],
    height: [String, Number],
    rotation: {
      type: [String, Number],
      default: '0'
    },
    size: {
      type: [String, Number],
      default: '24px'
    }
  },

  computed: {
    getViewBox() {
      // Most icons are 24x24, but some have different viewBox
      const iconViewBoxMap = {
        'settings': '0 0 6 20',
        'lock': '0 0 24 24',
        'duplicate': '0 0 20 20',
        'cogs': '0 0 24 24',
        'trash': '0 0 24 24',
        'external-link': '0 0 20 20',
        'logout': '0 0 24 24',
        'logo-simple': '0 0 40 40',
        'arrow-left': '0 0 24 24',
        'arrow-right': '0 0 32 32'
      }
      
      return iconViewBoxMap[this.name] || '0 0 24 24'
    }
  }
}
</script>
