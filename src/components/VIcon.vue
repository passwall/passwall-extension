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
        'passwall-logo': '0 0 32 32',
        'passwall-with-text': '0 0 136 32',
        'fancy-arrow': '0 0 120 192',
        'arrow-left': '0 0 24 24',
        'arrow-right': '0 0 32 32',
        'eye': '0 0 20 20',
        'eye-off': '0 0 20 20',
        'camera': '0 0 20 20',
        'refresh': '0 0 20 20',
        'check': '0 0 20 20',
        'shield-check': '0 0 25 24',
        'clipboard-secure': '0 0 25 24',
        'terminal': '0 0 24 24',
        'at-symbol': '0 0 25 24',
        'credit-card': '0 0 25 24',
        'x-icon': '0 0 24 24',
        'down-arrow': '0 0 24 24',
        'cross': '0 0 24 24',
        'upgrade': '0 0 24 24',
        'star': '0 0 16 16',
        'plus': '0 0 22 22',
        'search': '0 0 24 24'
      }
      
      return iconViewBoxMap[this.name] || '0 0 24 24'
    }
  }
}
</script>
