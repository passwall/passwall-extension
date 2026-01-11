<template>
  <div class="container">
    <Header class="bg-black-400">
      <template v-slot:content>
        <VIcon class="c-pointer c-white" name="arrow-left" @click="goBack" />
        <div class="d-flex flex-auto ml-2">
          <span class="fw-bold h5 ml-2 c-white">About</span>
        </div>
      </template>
    </Header>

    <div class="about-content">
      <!-- Logo -->
      <div class="logo-container">
        <VIcon name="passwall-with-text" width="136" height="32" class="passwall-logo" />
      </div>

      <!-- Version Info -->
      <p class="info-text">Version: {{ version }}</p>
      <p class="info-text">Built: {{ buildDate }}</p>

      <!-- Copyright -->
      <p class="info-text">Copyright 2020-{{ currentYear }} Passwall.</p>
      <p class="info-text">All Rights Reserved.</p>

      <!-- Support Link -->
      <a href="#" class="support-link" @click.prevent="openSupport">
        Click here to view the Passwall Knowledgebase
      </a>
    </div>
  </div>
</template>

<script>
import browser from 'webextension-polyfill'
import packageJson from '../../../../package.json'

export default {
  name: 'About',

  data() {
    return {
      version: packageJson.version,
      buildDate: 'Tue Dec 09 2025 17:40:19 GMT+0300',
      currentYear: new Date().getFullYear()
    }
  },

  methods: {
    goBack() {
      this.$router.push({ name: 'Home' })
    },

    openSupport() {
      browser.tabs.create({
        url: 'https://passwall.io/support'
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.about-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start; // Sola hizalı
  padding: 32px 24px;
  text-align: left; // Sola hizalı
}

.logo-container {
  margin-bottom: 24px;

  .passwall-logo {
    color: $color-white;
  }
}

.info-text {
  color: $color-gray-450; // #CECFD1 - Hafif gri
  font-size: 14px;
  line-height: 1.8;
  margin: 0;
  padding: 6px 0; // Tüm satırlar aynı boşluk
  font-weight: 400;
}

.support-link {
  color: $color-secondary; // #00FFD1 - Mavi
  font-size: 14px;
  line-height: 1.8;
  margin: 0;
  padding: 6px 0; // Aynı boşluk
  text-decoration: none;
  cursor: pointer;
  display: block;

  &:hover {
    text-decoration: underline;
  }
}
</style>
