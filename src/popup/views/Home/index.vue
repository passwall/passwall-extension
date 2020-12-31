<template>
  <div>
    <div class="d-flex flex-items-center header px-3">
      <VAvatar name="Ömer Faruk" />
    </div>
    <RouterView />
  </div>
</template>

<script>
export default {};
</script>

<style lang="scss">
.header {
  height: 95px;
  border-bottom: 2px solid $color-black;
}
</style>
