<template>
  <div>
    <!-- Content -->
    <transition name="fade" mode="out-in">
      <router-view />
    </transition>

    <notifications width="100%" position="top right" />
    <!--  Hidden -->
    <TheIcons />
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style lang="scss">
html,
body {
  width: 350px;
  min-height: 490px;
  max-height: 560px;
  background-color: $color-gray-500;
}
</style>
