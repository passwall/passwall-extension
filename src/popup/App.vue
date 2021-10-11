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
import { mapActions } from 'vuex'

export default {
  name: 'App',
  methods: {
    ...mapActions(['loadStore'])
  },
  created() {
    this.messageToBackground({ type: 'POPUP_INITAL' })
    console.log('gitti')
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
