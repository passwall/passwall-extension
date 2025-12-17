<template>
  <div 
    ref="logoContainer"
    class="d-flex flex-justify-center flex-items-center flex-shrink-0 logoWrap"
  >
    <!-- Company logo via apistemic (free API) - Lazy loaded -->
    <img
      v-if="shouldLoadLogo && logoAvailable && check"
      class="logo"
      :src="logoUrl"
      :alt="`${domain} logo`"
      height="40"
      width="40"
      loading="lazy"
      @error="logoAvailable = false"
    />
    <span 
      v-else 
      class="fw-bold fs-big c-secondary" 
      v-text="logoLetter"
    />
  </div>
</template>

<script>
import { getDomain } from '@/utils/helpers'

const LOGO_API_CONFIG = {
  BASE_URL: 'https://logos-api.apistemic.com'
  // No token needed - completely free!
}

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
      shouldLoadLogo: false, // Lazy loading flag
      observer: null
    }
  },
  mounted() {
    // Use IntersectionObserver for lazy loading
    // Only fetch logos when they're visible (huge performance boost!)
    this.setupLazyLoading()
  },
  beforeUnmount() {
    // Clean up observer
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
  },
  methods: {
    setupLazyLoading() {
      // Create IntersectionObserver to detect when logo becomes visible
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              // Logo is visible - start loading!
              this.shouldLoadLogo = true
              
              // Stop observing after loading starts
              this.observer.unobserve(entry.target)
            }
          })
        },
        {
          rootMargin: '50px', // Start loading 50px before visible (smoother UX)
          threshold: 0.01     // Trigger when 1% visible
        }
      )
      
      // Start observing this logo container
      if (this.$refs.logoContainer) {
        this.observer.observe(this.$refs.logoContainer)
      }
    }
  },
  computed: {
    /**
     * Extract base domain from URL using tldts
     * Examples: signin.aws.amazon.com → amazon.com
     */
    domain() {
      if (!this.url) return null
      
      // Use tldts-based getDomain for accurate extraction
      const baseDomain = getDomain(this.url)
      
      // Return base domain or null
      return baseDomain || null
    },
    
    /**
     * First letter of domain for fallback display
     */
    logoLetter() {
      return this.domain?.[0]?.toUpperCase() || '?'
    },
    
    /**
     * apistemic Logo API URL
     * Format: domain:{domain}
     * Free tier - no API key needed!
     */
    logoUrl() {
      if (!this.domain) return ''
      
      return `${LOGO_API_CONFIG.BASE_URL}/domain:${this.domain}`
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
