<template>
  <li
    class="d-flex flex-justify-between flex-content-center py-3 c-pointer item"
    v-bind="$attrs"
    v-on="$listeners"
  >
    <CompanyLogo :url="url" />
    <div class="flex-auto ml-3">
      <p class="fs-medium fw-medium" v-text="title" />
      <p class="fs-small fw-medium c-gray-300 mt-1" v-text="username" />
    </div>
    <VIcon name="arrow-right" />
  </li>
</template>

<script>
export default {
  name: "ListItem",

  props: {
    url: {
      type: String,
      default: "",
    },
    username: {
      type: String,
      default: "",
    },
    title: {
      type: String,
      default: "",
    },
  },
};
</script>

<style lang="scss" scoped>
.item {
  border-bottom: 2px solid $color-black;
}
</style>
