import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@p': resolve(__dirname, 'src/popup'),
      '@/api': resolve(__dirname, 'src/api'),
      '@/components': resolve(__dirname, 'src/components'),
      '@/mixins': resolve(__dirname, 'src/mixins'),
      '@/utils': resolve(__dirname, 'src/utils'),
      '@/i18n': resolve(__dirname, 'src/i18n'),
      '@/styles': resolve(__dirname, 'src/styles'),
    }
  }
})

