<template>
  <div
    class="fab-btn d-flex flex-justify-center flex-items-center"
    v-bind="$attrs"
  >
    <VIcon name="plus" />
  </div>
</template>

<script>
export default {
  name: "FABButton",
};
</script>

<style lang="scss">
.fab-btn {
  height: 48px;
  width: 48px;
  background-color: $color-primary;
  border-radius: 999px;
}
</style>
