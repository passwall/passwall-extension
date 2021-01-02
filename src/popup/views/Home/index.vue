<template>
  <div class="content">
    <Header />
    <div class="scroll">
      <div class="mx-3">
        <VFormSearch
          class="mt-2"
          v-model="searchText"
          theme="black"
          size="medium"
          name="search"
          placeholder="Search"
        />
        <Tabs class="mt-3" />
      </div>
      <RouterView />
      <FABButton class="fab" />
    </div>
  </div>
</template>

<script>
import Header from "./header";
import Tabs from "./tabs";

export default {
  components: { Header, Tabs },
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
  .scroll {
    overflow-y: auto;
    scrollbar-width: none;  /* Firefox */
  }
}
</style>
