<template>
  <div class="d-flex flex-items-center flex-justify-between header px-3" v-bind="$attrs">
    <slot name="content">
      <div class="d-flex flex-items-center c-pointer" @click="$emit('header-click')">
        <VAvatar :name="safeUser.name" class="mr-1" />
        <div class="d-flex flex-column ml-2 mt-1">
          <span class="fs-x-big fw-semibold ff-inter">{{ safeUser.name }}</span>
          <div class="mt-2">
            <span class="fs-x-big fw-semibold ff-inter c-secondary">FREE</span>
            <span class="fs-x-big fw-semibold ff-inter h6 c-gray-300 ml-1">9 days left</span>
          </div>
        </div>
      </div>
      <VIcon name="settings" color="white" class="c-pointer" width="10px" />
    </slot>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'Header',
  computed: {
    ...mapGetters(['safeUser'])
  }
}
</script>

<style lang="scss">
.header {
  height: 95px;
  border-bottom: 2px solid $color-black;
}
</style>
