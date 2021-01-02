<template>
  <div class="d-flex flex-column flex-items-center content">
    <p class="c-gray-300 fw-medium h6 mt-4">
      No login info yet...
    </p>
    <VIcon
      class="arrow"
      name="fancy-arrow"
      height="190px"
      width="130px"
      color="#5707FF"
    />
  </div>
</template>

<script>
export default {
  name: "EmptyState",
};
</script>

<style lang="scss" scoped>
.content {
  position: relative;
  height: 300px;

  .arrow {
    position: absolute;
    bottom: 55px;
    right: 45px;
  }
}
</style>
