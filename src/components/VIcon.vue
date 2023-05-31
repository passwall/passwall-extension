<template>
  <svg
    :width="width || size"
    :height="height || size"
    :transform="`rotate(${rotation} 0 0)`"
    v-on="$attrs"
    class="v-icon no-select"
  >
    <use :xlink:href="`#${name}`" />
  </svg>
</template>

<script>
export default {
  name: 'VIcon',
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
  }
}
</script>
