<template>
  <div class="d-flex flex-items-center flex-justify-between header px-3" v-bind="$attrs">
    <slot name="content">
      <div
        v-if="user"
        class="d-flex flex-items-center"
      >
        <VAvatar :name="user.name" class="mr-1" />
        <div class="d-flex flex-column ml-2 mt-1">
          <span class="fs-x-big fw-semibold ff-inter c-white" data-testid="username-label">{{
            user.name
          }}</span>
          <div class="mt-2">
            <span class="fs-x-big fw-semibold ff-inter c-secondary">{{
              hasProPlan ? 'PRO' : 'FREE'
            }}</span>
          </div>
        </div>
      </div>
      <VIcon 
        name="settings" 
        color="white" 
        class="c-pointer" 
        width="10px"
        data-testid="settings-click"
        @click="$emit('header-click')"
      />
    </slot>
  </div>
</template>

<script>
import { useAuthStore } from '@/stores/auth'
import { storeToRefs } from 'pinia'

export default {
  name: 'Header',
  setup() {
    const authStore = useAuthStore()
    const { user, hasProPlan } = storeToRefs(authStore)
    
    return {
      user,
      hasProPlan
    }
  }
}
</script>

<style lang="scss">
.header {
  height: 95px;
  border-bottom: 2px solid $color-black;
}
</style>
