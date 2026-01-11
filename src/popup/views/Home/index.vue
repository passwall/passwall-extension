<template>
  <div class="content">
    <Header v-on:header-click="showSettings = !showSettings" />
    <div v-if="showSettings" ref="overlay" class="d-flex flex-column px-3 overlay">
      <div class="menu flex-self-center p-4" v-click-outside="closeSettings">
        <div
          class="menu-item c-pointer my-2 d-flex flex-items-center"
          data-testid="password-generator-btn"
          @click="passwordGenerator"
        >
          <VIcon name="lock" width="20px" height="20px" class="mr-2" />
          <span class="fs-big">Password Generator</span>
        </div>

        <div class="bg-black w-100" style="height: 1px" />

        <div class="menu-item c-pointer my-2 d-flex flex-items-center mt-3" @click="goToVault">
          <VIcon name="external-link" size="20px" class="mr-2" />
          <span class="fs-big">Open Vault</span>
        </div>

        <div class="bg-black w-100" style="height: 1px" />

        <div class="menu-item c-pointer my-2 d-flex flex-items-center mt-3" @click="goToAbout">
          <VIcon name="logo-simple" size="18px" class="mr-2 about-icon" />
          <span class="fs-big">About Passwall (v{{ version }})</span>
        </div>

        <div class="bg-black w-100" style="height: 1px" />

        <div
          class="menu-item c-pointer my-2 d-flex flex-items-center mt-3"
          data-testid="logout-btn"
          @click="logout"
        >
          <VIcon name="logout" size="20px" class="mr-2" />
          <span class="fs-big">Log out</span>
        </div>
      </div>
    </div>
    <div class="scroll">
      <div class="mx-3 sticky-list-header">
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
import Tabs from './tabs.vue'
import { useAuthStore } from '@/stores/auth'
import { storeToRefs } from 'pinia'
import { getDomain } from '@/utils/helpers'
import browser from 'webextension-polyfill'
import packageJson from '../../../../package.json'

export default {
  components: { Tabs },
  setup() {
    const authStore = useAuthStore()
    const { searchQuery, user, hasProPlan } = storeToRefs(authStore)

    return {
      authStore,
      searchQuery,
      user,
      hasProPlan,
      onInputSearchQuery: authStore.setSearchQuery
    }
  },
  data() {
    return {
      searchText: '',
      showSettings: false,
      version: packageJson.version
    }
  },

  async mounted() {
    // Auto-fill search with current tab's domain
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true })
      if (tabs && tabs[0] && tabs[0].url) {
        const currentUrl = tabs[0].url
        const domain = getDomain(currentUrl)

        if (domain && domain !== 'chrome' && domain !== 'edge') {
          // Set search query to domain for auto-filtering
          this.authStore.searchQuery = domain
        }
      }
    } catch (error) {
      console.error('Failed to get current tab domain:', error)
    }
  },
  methods: {
    closeSettings(e) {
      if (e.target === this.$refs.overlay) {
        this.showSettings = false
      }
    },

    goToVault() {
      this.$browser.tabs.create({
        url: 'https://vault.passwall.io'
      })
      this.showSettings = false
    },

    goToAbout() {
      this.$router.push({ name: 'About' })
      this.showSettings = false
    },

    logout() {
      this.authStore.logout().then(() => this.$router.push('Login'))
    },

    passwordGenerator() {
      this.$router.push({ name: 'Generator' })
      this.showSettings = false
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

  .menu-item {
    color: $color-white;

    svg {
      color: $color-white;
      transition: color 0.2s;
    }

    .about-icon {
      color: $color-secondary; // Passwall logo her zaman turkuaz
    }

    span {
      color: $color-white;
    }

    &:hover {
      svg {
        color: $color-secondary;
      }
    }
  }
}
</style>
