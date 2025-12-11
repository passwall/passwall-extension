<template>
  <div>
    <!-- Content -->
    <transition name="fade" mode="out-in">
      <router-view />
    </transition>

    <notifications width="100%" position="top right" />
    <!--  Hidden -->
    <TheIcons />
  </div>
</template>

<script>
import { useAuthStore } from '@/stores/auth'

export default {
  name: 'App',
  setup() {
    const authStore = useAuthStore()
    
    return {
      loadStore: authStore.loadStore
    }
  },
  created() {
    this.messageToBackground({ type: 'POPUP_INITAL' })
    this.loadStore()
  }
}
</script>

<style lang="scss">
html,
body {
  width: 350px;
  min-height: 490px;
  max-height: 560px;
  background-color: $color-gray-500;
  scrollbar-width: none; /* Firefox */
}
</style>
