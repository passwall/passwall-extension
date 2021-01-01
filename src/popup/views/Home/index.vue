<template>
  <div class="content">
    <Header />
    <div class="mx-3">
      <VFormSearch
        class="mt-2"
        v-model="searchText"
        theme="black"
        size="medium"
        name="search"
        placeholder="Search"
      />
      <VIcon name="lock" />
      <VIcon name="credit-card" />
      <VIcon name="credit-card" />
      <VIcon name="credit-card" />
      <VIcon name="credit-card" />
    </div>
    <RouterView />
    <FABButton class="fab" />
  </div>
</template>

<script>
import Header from "./header";

export default {
  components: { Header },
  data() {
    return {
      searchText: "",
    };
  },
};
</script>

<style lang="scss">
.content {
  .fab {
    position: absolute;
    bottom: 16px;
    right: 16px;
    cursor: pointer;
  }
}
</style>
