import { createApp } from 'vue'
import App from './App.vue'

import '@/styles/app.scss'

import storage from '@/utils/storage'

const app = createApp(App)

// Global properties
app.config.globalProperties.$storage = storage

app.mount('#app')
