<template>
  <h1>options page</h1>
</template>

<script>
export default {
  created() {
    this.$storage.getItem('email').then(console.log)
  }
}
</script>

<style lang="scss">
html,
body {
  background-color: $color-gray-500;
  scrollbar-width: none; /* Firefox */
}
</style>
