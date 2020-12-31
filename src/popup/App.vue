<template>
  <div>
    <!--  <VIcon name="passwall-with-text" width="140px" height="32px" /> -->

    <!-- Content -->
    <RouterView />

    <!--  Hidden -->
    <TheIcons />
  </div>
</template>

<script>
export default {
  name: "App",
};
</script>

<style lang="scss">
html,
body {
  width: 350px;
  height: 500px;
  background-color: $color-gray-500;
}
</style>
