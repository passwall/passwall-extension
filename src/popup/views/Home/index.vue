<template>
  <div class="content">
    <Header />
    <div class="mx-3">
      <VFormSearch
        v-model="searchText"
        theme="black"
        size="medium"
        name="search"
        placeholder="Search"
      />
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
