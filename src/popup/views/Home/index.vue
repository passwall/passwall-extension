<template>
  <div class="content">
    <Header v-on:header-click="showSettings = !showSettings" />
    <div v-if="showSettings" ref="overlay" class="d-flex flex-column px-3 overlay">
      <div class="menu flex-self-center p-4" v-click-outside="closeSettings">
        <div
          class="c-pointer my-2 d-flex flex-items-center"
          data-testid="password-generator-btn"
          @click="passwordGenerator"
        >
          <VIcon name="lock" size="20px" class="mr-2" />
          <span class="fs-big">Password Generator</span>
        </div>

         <div class="bg-black w-100" style="height: 1px" />
        <div
          class="c-pointer my-2 d-flex flex-items-center mt-3"
          @click="changeMasterPassword"
        >
          <VIcon name="cogs" size="20px" class="mr-2" />
          <span class="fs-big">Change Master Password</span>
        </div>

        <div class="bg-black w-100" style="height: 1px" />
        <div
          class="c-pointer my-2 d-flex flex-items-center mb-3 mt-3"
          v-if="!hasProPlan"
          @click="goUpgrade"
        >
          <VIcon name="upgrade" size="20px" class="mr-2" />
          <span class="fs-big">Upgrade Subscription</span>
        </div>
        <div
          class="c-pointer my-2 d-flex flex-items-center mb-3 mt-3"
          v-if="hasProPlan"
          @click="goUpdate"
        >
          <VIcon name="refresh" size="20px" class="mr-2" />
          <span class="fs-big">Update Subscription</span>
        </div>
        <div
          class="c-pointer my-2 d-flex flex-items-center mb-3 mt-3"
          v-if="hasProPlan"
          @click="goCancel"
        >
          <VIcon name="cross" size="20px" class="mr-2" />
          <span class="fs-big">Cancel Subscription</span>
        </div>

        <div class="bg-black w-100" style="height: 1px" />
        <div
          class="c-pointer my-2 d-flex flex-items-center mt-3"
          data-testid="logout-btn"
          @click="logout"
        >
          <VIcon name="logout" size="20px" class="mr-2" />
          <span class="fs-big">Log out</span>
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
import { mapActions, mapMutations, mapState, mapGetters } from 'vuex'

export default {
  components: { Tabs },
  data() {
    return {
      searchText: '',
      showSettings: false
    }
  },
  computed: {
    ...mapState(['searchQuery', 'user']),
    ...mapGetters(['hasProPlan'])
  },
  methods: {
    ...mapActions(['Logout']),
    ...mapMutations(['onInputSearchQuery']),

    closeSettings(e) {
      if (e.target === this.$refs.overlay) {
        this.showSettings = false
      }
    },

    goUpgrade() {
      this.$browser.tabs.create({
        url: 'https://passwall.io'
      })
    },

    changeMasterPassword: function () {
      this.$router.push({ name: 'ChangeMasterPassword' })
    },

    logout() {
      this.Logout().then(() => this.$router.push('Login'))
    },

    passwordGenerator() {
      this.$router.push({ name: 'Generator' })
    },
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
