// CRITICAL: Import polyfills FIRST before anything else
// This provides Buffer polyfill for @otplib/preset-browser
import '@/polyfills'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { setupPlugins } from './config'

import App from './App.vue'
import router from '@p/router'
import i18n from '@/i18n'
import HTTPClient from '@/api/HTTPClient'
import Storage from '@/utils/storage'
import { useAuthStore } from '@/stores/auth'
import '@/styles/app.scss'
import 'floating-vue/dist/style.css'

// Initialize app
const initApp = async () => {
  // Create Vue app
  const app = createApp(App)

  // Create and use Pinia
  const pinia = createPinia()
  app.use(pinia)

  // Use core plugins
  app.use(router)
  app.use(i18n)

  // Setup additional plugins and global properties
  setupPlugins(app, router, pinia, i18n)

  // Initialize auth store
  const authStore = useAuthStore()
  await authStore.init()

  // Set auth token if exists
  const token = await Storage.getItem('access_token')
  if (token) {
    HTTPClient.setHeader('Authorization', `Bearer ${token}`)
  }

  // Mount app
  app.mount('#app')
}

// Start app
initApp().catch((error) => {
  console.error('Failed to initialize app:', error)
})
