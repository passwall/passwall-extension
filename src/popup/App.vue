<template>
  <div>
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
  min-height: 490px;
  max-height: 560px;
  background-color: $color-gray-500;
}
</style>
