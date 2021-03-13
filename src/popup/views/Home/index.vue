<template>
  <div class="content">
    <Header v-on:header-click="showSettings = !showSettings" />
    <div v-if="showSettings" ref="overlay" class="d-flex flex-column px-3 overlay">
      <div class="menu flex-self-center p-4" v-click-outside="closeSettings">
        <div class="c-pointer" data-testid="logout-btn" @click="logout">
          <VIcon name="logout" size="24px" />
          Log out
        </div>
      </div>
    </div>
    <div class="scroll">
      <div class="mx-3">
        <VFormSearch
          class="mt-2"
          :value="searchQuery"
          @input="onInputSearchQuery"
          theme="black"
          size="medium"
          name="search"
          placeholder="Search"
          data-testid="searchbar"
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
import Tabs from './tabs'
import { mapActions, mapMutations, mapState } from 'vuex'


export default {
  components: { Tabs },
  data() {
    return {
      searchText: '',
      showSettings: false
    }
  },
  computed: {
    ...mapState(['searchQuery'])
  },
  methods: {
    ...mapActions(['Logout']),
    ...mapMutations(['onInputSearchQuery']),

    closeSettings(e) {
      if (e.target === this.$refs.overlay) {
        this.showSettings = false
      }
    },

    logout() {
      this.Logout().then(() => this.$router.push('Login'))
    }
  }
}
</script>

<style lang="scss">
.content {
  .fab {
    position: absolute;
    bottom: 16px;
    right: 16px;
    cursor: pointer;
  }
}
.overlay {
  position: absolute;
  top: 0;
  background: rgba(0, 0, 0, 0.6);
  width: 100%;
  height: 100%;
  z-index: 9999;

  .menu {
    margin-top: 96px;
    background-color: $color-gray-500;
    border: 2px solid $color-gray-400;
    width: 100%;
    border-radius: 16px;
  }
}
</style>
