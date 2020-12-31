<template>
  <div>
    <Header />
    <RouterView />
  </div>
</template>

<script>
import Header from "./header";

export default {
  components: { Header },
};
</script>

<style lang="scss">
.header {
  height: 95px;
  border-bottom: 2px solid $color-black;
}
</style>
