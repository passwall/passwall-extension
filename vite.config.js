import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { crx } from '@crxjs/vite-plugin'
import { resolve } from 'path'
import manifest from './src/manifest.json' with { type: 'json' }

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // Ensure all templates are pre-compiled (CSP compliant)
          isCustomElement: tag => tag.startsWith('custom-')
        }
      }
    }),
    crx({ manifest })
  ],
  
  define: {
    // Vue feature flags for CSP compliance
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    // Ensure production mode (no eval/Function)
    'process.env.NODE_ENV': JSON.stringify('production'),
    // Vue I18n flags
    __INTLIFY_PROD_DEVTOOLS__: false,
    __VUE_I18N_LEGACY_API__: false,
    __VUE_I18N_FULL_INSTALL__: false
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@p': resolve(__dirname, 'src/popup'),
      '@/api': resolve(__dirname, 'src/api'),
      '@/assets': resolve(__dirname, 'src/assets'),
      '@/components': resolve(__dirname, 'src/components'),
      '@/mixins': resolve(__dirname, 'src/mixins'),
      '@/utils': resolve(__dirname, 'src/utils'),
      '@/i18n': resolve(__dirname, 'src/i18n'),
      '@/styles': resolve(__dirname, 'src/styles'),
      // Use runtime-only build for CSP compliance in browser extensions
      'vue-i18n': 'vue-i18n/dist/vue-i18n.runtime.esm-bundler.js'
    }
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    sourcemap: false, // Disable source maps for CSP compliance
    rollupOptions: {
      output: {
        chunkFileNames: 'js/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.')
          let extType = info[info.length - 1]
          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name)) {
            extType = 'img'
          } else if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name)) {
            extType = 'fonts'
          }
          return `${extType}/[name].[ext]`
        }
      }
    }
  },

  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "./src/styles/config/variables.scss";`,
        silenceDeprecations: ['legacy-js-api', 'import'],
        quietDeps: true
      }
    }
  },

  server: {
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000
    }
  }
})

