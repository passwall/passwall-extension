<template>
  <div>
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
.header {
  height: 95px;
  border-bottom: 2px solid $color-black;
}
</style>
