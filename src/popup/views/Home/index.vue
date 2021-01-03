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

      <transition name="fade" mode="out-in">
        <router-view />
      </transition>

      <FABButton class="fab" />
    </div>
  </div>
</template>

<script>
import Tabs from "./tabs";

export default {
  data() {
    return {
      searchText: "",
    };
  },
};
</script>

<style lang="scss">
.fade-enter-active,
.fade-leave-active {
  transition-duration: 0.3s;
  transition-property: opacity;
  transition-timing-function: ease;
}

.fade-enter,
.fade-leave-active {
  opacity: 0;
}

.content {
  .fab {
    position: absolute;
    bottom: 16px;
    right: 16px;
    cursor: pointer;
  }
  .scroll {
    overflow-y: auto;
    scrollbar-width: none; /* Firefox */
  }
}
</style>
