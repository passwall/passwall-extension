<template>
  <div ref="window" class="px-3 py-4 window">
    <header class="d-flex flex-items-center flex-justify-between">
      <div class="d-flex flex-row flex-items-center">
        <VIcon name="passwall-logo" size="32px" />
        <p class="fs-medium fw-bold ml-2 c-white">LOG IN AS</p>
      </div>
      <VIcon name="cross" size="20px" class="c-gray-300 mr-2 c-pointer" @click="closePopup" />
    </header>

    <!-- Search Box (only show if logins exist and no auth error) -->
    <div v-if="!authError && logins.length > 0" class="mt-3">
      <div class="search-container">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="Search logins..."
          @input="onSearchInput"
        />
        <button v-if="searchQuery" class="clear-btn" @click="clearSearch" title="Clear search">
          ×
        </button>
      </div>
      <p v-if="searchQuery && filteredLogins.length === 0" class="mt-2 c-gray-300" style="font-size: 13px; text-align: center;">
        No results for "{{ searchQuery }}"
      </p>
    </div>

    <!-- Authentication Required Message -->
    <div v-if="authError === 'NO_AUTH'" class="mt-3 p-4 bg-black-400 radius text-center">
      <div class="mb-3" style="font-size: 48px;">🔒</div>
      <p class="fs-large fw-bold mb-2 c-white">Authentication Required</p>
      <p class="c-white mb-1" style="font-size: 14px;">Please log in to Passwall extension</p>
      <p class="c-white" style="font-size: 14px;">to access your passwords.</p>
      <p class="mt-3 fw-medium" style="font-size: 14px; color: #a78bfa;">Click the Passwall icon to sign in →</p>
    </div>

    <!-- No Logins Found Message -->
    <div v-else-if="authError === 'NO_LOGINS'" class="mt-3 p-4 bg-black-400 radius text-center">
      <div class="mb-3" style="font-size: 48px;">📝</div>
      <p class="fs-large fw-bold mb-2 c-white">No Passwords Found</p>
      <p class="c-white mb-1" style="font-size: 14px;">You don't have any saved passwords</p>
      <p class="c-white" style="font-size: 14px;">for this website.</p>
      <p class="mt-3 fw-medium" style="font-size: 14px; color: #a78bfa;">Add one from the Passwall extension →</p>
    </div>

    <!-- Login List -->
    <ul v-else class="mt-2">
      <li
        v-for="login in filteredLogins"
        :key="login.id"
        class="d-flex flex-row bg-black-400 p-3 w-100 flex-items-center flex-justify-between radius c-pointer no-select mb-2"
        @click="onClickItem(login)"
      >
        <div class="d-flex flex-row">
          <CompanyLogo :url="login.url" check />
          <div class="ml-2">
            <p>{{ login.title || login.url }}</p>
            <p class="c-gray-300">{{ login.username }}</p>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  name: 'LoginAsPopup',
  data() {
    return {
      logins: [],
      authError: null,
      searchQuery: ''
    }
  },
  computed: {
    /**
     * Filter logins based on search query
     * Searches in: title, url, username
     */
    filteredLogins() {
      if (!this.searchQuery || this.searchQuery.trim() === '') {
        return this.logins
      }

      const query = this.searchQuery.toLowerCase().trim()
      
      return this.logins.filter(login => {
        const title = (login.title || '').toLowerCase()
        const url = (login.url || '').toLowerCase()
        const username = (login.username || '').toLowerCase()
        
        return (
          title.includes(query) ||
          url.includes(query) ||
          username.includes(query)
        )
      })
    }
  },
  created() {
    console.log('🚀 [LoginAs] Component created! Listening for messages...')

    this.on('LOGIN_AS_POPUP_FETCH', request => {
      const payload = request.payload || {}
      const logins = payload.logins || []
      const authError = payload.authError || null
      
      console.log('📨 [LoginAs] Received message:', logins.length, 'logins, authError:', authError)
      this.logins = logins
      this.authError = authError
      console.log('✅ [LoginAs] State updated:', this.logins.length, 'logins')
    })

    console.log('📤 [LoginAs] Requesting logins from content script...')
    this.messageToContentScript({ type: 'LOGIN_AS_POPUP_FETCH' })
  },
  mounted() {
    // Tell dynamic height to content script
    const resizeObserver = new ResizeObserver(([box]) => {
      const currentHeight = box.borderBoxSize[0].blockSize
      this.messageToContentScript({
        type: 'LOGIN_AS_POPUP_RESIZE',
        payload: { height: currentHeight }
      })
    })
    resizeObserver.observe(this.$refs.window)
    
    // Auto-focus search input if multiple logins
    this.$nextTick(() => {
      if (this.logins.length > 3 && this.$refs.searchInput) {
        this.$refs.searchInput.focus()
      }
    })
  },
  methods: {
    closePopup() {
      this.messageToContentScript({ type: 'LOGIN_AS_POPUP_CLOSE' })
    },
    onClickItem(item) {
      this.messageToContentScript({ type: 'LOGIN_AS_POPUP_FILL_FORM', payload: item })
    },
    clearSearch() {
      this.searchQuery = ''
      this.$refs.searchInput?.focus()
    },
    onSearchInput() {
      // Search input changed - filtered list will auto-update via computed property
      console.log(`🔍 [LoginAs] Searching: "${this.searchQuery}" - ${this.filteredLogins.length} results`)
    }
  }
}
</script>

<style lang="scss" scoped>
.search-container {
  position: relative;
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px 12px;
  transition: all 0.2s ease;

  &:focus-within {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(147, 51, 234, 0.5);
    box-shadow: 0 0 0 3px rgba(147, 51, 234, 0.1);
  }

  .search-icon {
    margin-right: 8px;
    flex-shrink: 0;
    color: rgba(255, 255, 255, 0.5);
    stroke: currentColor;
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: white;
    font-size: 14px;
    font-family: inherit;
    padding: 0;

    &::placeholder {
      color: rgba(255, 255, 255, 0.4);
    }
  }

  .clear-btn {
    background: none;
    border: none;
    padding: 4px 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.2s ease;
    margin-left: 4px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 20px;
    line-height: 1;
    font-weight: 300;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.8);
    }
  }
}

ul {
  max-height: 300px;
  overflow-y: auto;
  
  li:last-child {
    margin-bottom: 0;
  }
}
</style>
