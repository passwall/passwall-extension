<template>
  <div
    ref="logoContainer"
    class="d-flex flex-justify-center flex-items-center flex-shrink-0 logoWrap"
  >
    <!-- Company logo - Lazy loaded with caching -->
    <img
      v-if="shouldLoadLogo && logoAvailable && check"
      class="logo"
      :src="logoUrl"
      :alt="`${domain} logo`"
      height="40"
      width="40"
      loading="lazy"
      @error="handleLogoError"
    />
    <span v-else class="fw-bold fs-big c-secondary" v-text="logoLetter" />
  </div>
</template>

<script>
import { getDomain } from '@/utils/helpers'
import Storage from '@/utils/storage'

// Icon cache configuration
const ICON_CACHE_NAME = 'passwall-icons-v1'
const ICON_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days in ms

// Fallback API (used if server URL not available)
const FALLBACK_ICON_API = 'https://www.google.com/s2/favicons?sz=128&domain_url='

export default {
  name: 'CompanyLogo',
  props: {
    url: {
      type: String,
      default: ''
    },
    check: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {
      logoAvailable: true,
      shouldLoadLogo: false,
      observer: null,
      serverUrl: null,
      cachedLogoUrl: null
    }
  },
  async mounted() {
    // Get server URL from storage
    await this.loadServerUrl()
    // Setup lazy loading
    this.setupLazyLoading()
  },
  beforeUnmount() {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
  },
  methods: {
    /**
     * Load server URL from storage
     */
    async loadServerUrl() {
      try {
        this.serverUrl = await Storage.getItem('server')
      } catch (e) {
        console.warn('Failed to get server URL for icons:', e)
        this.serverUrl = null
      }
    },

    /**
     * Setup IntersectionObserver for lazy loading
     */
    setupLazyLoading() {
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.shouldLoadLogo = true
              this.observer.unobserve(entry.target)
              // Try to load from cache first
              this.loadIconWithCache()
            }
          })
        },
        {
          rootMargin: '50px',
          threshold: 0.01
        }
      )

      if (this.$refs.logoContainer) {
        this.observer.observe(this.$refs.logoContainer)
      }
    },

    /**
     * Load icon with Cache API support
     */
    async loadIconWithCache() {
      if (!this.domain) return

      try {
        // Check if Cache API is available
        if ('caches' in window) {
          const cache = await caches.open(ICON_CACHE_NAME)
          const iconUrl = this.buildIconUrl()

          // Check cache first
          const cachedResponse = await cache.match(iconUrl)
          if (cachedResponse) {
            const cacheDate = cachedResponse.headers.get('x-cache-date')
            const isExpired = cacheDate && Date.now() - parseInt(cacheDate) > ICON_CACHE_DURATION

            if (!isExpired) {
              // Use cached icon - create blob URL
              const blob = await cachedResponse.blob()
              this.cachedLogoUrl = URL.createObjectURL(blob)
              return
            }
          }

          // Fetch and cache the icon
          this.fetchAndCacheIcon(cache, iconUrl)
        }
      } catch (e) {
        // Cache API not available or error - use direct URL
        console.debug('Cache API not available:', e)
      }
    },

    /**
     * Fetch icon and store in cache
     */
    async fetchAndCacheIcon(cache, iconUrl) {
      try {
        const response = await fetch(iconUrl, {
          mode: 'cors',
          credentials: 'omit'
        })

        if (response.ok) {
          // Clone response and add cache metadata
          const responseToCache = response.clone()
          const headers = new Headers(responseToCache.headers)
          headers.set('x-cache-date', Date.now().toString())

          const cachedResponse = new Response(await responseToCache.blob(), {
            status: responseToCache.status,
            statusText: responseToCache.statusText,
            headers
          })

          // Store in cache
          await cache.put(iconUrl, cachedResponse)
        }
      } catch (e) {
        console.debug('Failed to cache icon:', e)
      }
    },

    /**
     * Build the icon URL based on server availability
     */
    buildIconUrl() {
      if (!this.domain) return ''

      // Use Passwall server if available
      if (this.serverUrl) {
        // Remove trailing slash if present
        const baseUrl = this.serverUrl.replace(/\/$/, '')
        return `${baseUrl}/icons/${this.domain}`
      }

      // Fallback to Google Favicon API
      return `${FALLBACK_ICON_API}${this.domain}`
    },

    /**
     * Handle logo load error
     */
    handleLogoError() {
      this.logoAvailable = false

      // Clean up blob URL if exists
      if (this.cachedLogoUrl) {
        URL.revokeObjectURL(this.cachedLogoUrl)
        this.cachedLogoUrl = null
      }
    }
  },
  computed: {
    /**
     * Extract base domain from URL using tldts
     */
    domain() {
      if (!this.url) return null
      const baseDomain = getDomain(this.url)
      return baseDomain || null
    },

    /**
     * First letter of domain for fallback display
     */
    logoLetter() {
      return this.domain?.[0]?.toUpperCase() || '?'
    },

    /**
     * Icon URL - uses cached blob URL if available
     */
    logoUrl() {
      if (this.cachedLogoUrl) {
        return this.cachedLogoUrl
      }
      return this.buildIconUrl()
    }
  },
  watch: {
    // Reload icon when URL changes
    url() {
      this.logoAvailable = true
      if (this.shouldLoadLogo) {
        this.loadIconWithCache()
      }
    }
  }
}
</script>

<style lang="scss">
.logoWrap {
  width: 40px;
  height: 40px;
  background-color: $color-gray-400;
  border-radius: 8px;
}

.logo {
  border-radius: 8px;
}
</style>
