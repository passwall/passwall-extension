<template>
  <div class="d-flex flex-items-center flex-justify-between header px-3">
    <slot name="content">
      <div class="d-flex flex-items-center ">
        <VAvatar :name="user.name" class="mr-1" />
        <div class="d-flex flex-column ml-2 mt-1">
          <span class="fs-x-big fw-semibold ff-inter">{{ user.name }}</span>
          <div class="mt-2">
            <span class="fs-x-big fw-semibold ff-inter c-secondary">FREE</span>
            <span class="fs-x-big fw-semibold ff-inter h6 c-gray-300 ml-1"
              >9 days left</span
            >
          </div>
        </div>
      </div>
      <VIcon name="settings" color="white" class="c-pointer" />
    </slot>
  </div>
</template>

<script>
import { mapState } from "vuex";

export default {
  computed: {
    ...mapState(["user"]),
  },
};
</script>

<style lang="scss">
.header {
  height: 95px;
  border-bottom: 2px solid $color-black;
}
</style>
