<template>
  <div class="container">
    <div class="mx-3">
      <div class="py-3 head">
        <span class="fw-bold fs-big c-white">Passwords ({{ filteredList.length }})</span>
      </div>
      <div v-if="isLoading">
        <ListLoader />
      </div>
      <div v-else-if="filteredList.length === 0">
        <button
          v-if="showDomainEmptyState"
          class="empty-domain-card"
          type="button"
          @click="openCreate"
        >
          <VIcon name="lock" size="22px" class="card-icon" />
          <div class="card-text">
            <p class="domain">{{ currentDomain }}</p>
            <p class="subtitle">Add new password</p>
          </div>
          <VIcon name="plus" size="18px" class="card-plus" />
        </button>
        <EmptyState v-else />
      </div>
      <ul v-else class="items" data-testid="result">
        <ListItem
          v-for="item in filteredList"
          :key="item.id"
          :url="item.url"
          :title="$helpers.textEllipsis(item.title || item.url, 30)"
          :subtitle="item.username"
          :item-data="item"
          @edit="handleEdit"
          @delete="handleDelete"
        />
      </ul>
    </div>

    <!-- Delete Confirmation Dialog -->
    <ConfirmDialog
      v-model:show="showDeleteConfirm"
      title="Delete Password?"
      :message="deleteConfirmMessage"
      confirm-text="Delete"
      cancel-text="Cancel"
      confirm-theme="danger"
      icon="trash"
      icon-class="icon-danger"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>

<script>
import { useItemsStore, ItemType } from '@/stores/items'
import { useAuthStore } from '@/stores/auth'
import { storeToRefs } from 'pinia'
import browser from 'webextension-polyfill'
import { getDomain } from '@/utils/helpers'

export default {
  name: 'Passwords',
  
  setup() {
    const itemsStore = useItemsStore()
    const authStore = useAuthStore()
    const { items } = storeToRefs(itemsStore)
    
    return {
      itemsStore,
      authStore,
      ItemList: items,
      onInputSearchQuery: authStore.setSearchQuery
    }
  },

  data() {
    return {
      showDeleteConfirm: false,
      deleteItem: null,
      _listFetched: false,
      currentDomain: ''
    }
  },

  mounted() {
    // Always fetch on mount so list is complete after create (store may contain only the newly created item).
    if (!this._listFetched) {
      this.fetchAll()
      this._listFetched = true
    }

    this.loadCurrentDomain()
  },
  
  computed: {
    isLoading() {
      return this.itemsStore.isLoading
    },

    searchQuery() {
      return this.authStore.searchQuery
    },

    filteredList() {
      if (!this.ItemList) return []
      
      const filtered = this.ItemList.filter(item =>
        Object.values(item).some(value =>
          (value || '')
            .toString()
            .toLowerCase()
            .includes(this.searchQuery.toLowerCase())
        )
      )
      
      const sorted = [...filtered].sort((a, b) => {
        const key = (item) => (
          item.title ||
          item.url ||
          item.username ||
          ''
        ).toString().toLowerCase()
        return key(a).localeCompare(key(b))
      })

      return sorted
    },

    showDomainEmptyState() {
      if (!this.currentDomain) return false
      if (!this.searchQuery) return true
      return this.searchQuery.toLowerCase() === this.currentDomain.toLowerCase()
    },

    deleteConfirmMessage() {
      if (!this.deleteItem) return ''
      const name = this.deleteItem.title || this.deleteItem.url
      return 'Are you sure you want to delete "' + name + '"?\n\nThis action cannot be undone.'
    }
  },
  
  methods: {
    async loadCurrentDomain() {
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true })
        if (tabs && tabs[0] && tabs[0].url) {
          const domain = getDomain(tabs[0].url)
          if (domain && domain !== 'chrome' && domain !== 'edge') {
            this.currentDomain = domain
          }
        }
      } catch (error) {
        console.error('Failed to get current tab domain:', error)
      }
    },
    openCreate() {
      this.$router.push({ name: 'PasswordCreate' })
    },
    getLoadPasswordsErrorMessage(error) {
      const status = error?.response?.status

      if (status === 401) {
        return 'Session expired. Please sign in again.'
      }
      if (status === 403) {
        return 'Access denied. Please check your permissions.'
      }
      if (typeof status === 'number' && status >= 500) {
        return 'Server error. Please try again later.'
      }
      if (!error?.response) {
        return 'Cannot reach server. Please check your connection.'
      }

      const apiMessage = error?.response?.data?.message || error?.response?.data?.Message
      if (apiMessage) {
        return `Failed to load passwords: ${apiMessage}`
      }
      return 'Failed to load passwords.'
    },
    async fetchAll() {
      try {
        await this.itemsStore.fetchItems({ 
          type: ItemType.Password,
          per_page: 10000 // Fetch all passwords (no pagination)
        })
      } catch (error) {
        console.error('Failed to fetch passwords:', error)
        this.$notifyError?.(this.getLoadPasswordsErrorMessage(error))
      }
    },

    handleEdit(item) {
      this.$router.push({ 
        name: 'PasswordDetail', 
        params: { id: item.id }
      })
    },
    
    handleDelete(item) {
      this.deleteItem = item
      this.showDeleteConfirm = true
    },

    async confirmDelete() {
      if (!this.deleteItem) return

      try {
        await this.itemsStore.deleteItem(this.deleteItem.id)
        this.$notifySuccess?.('Password deleted successfully')
      } catch (error) {
        console.error('Failed to delete password:', error)
        this.$notifyError?.('Failed to delete password')
      }
      
      this.deleteItem = null
    },

    cancelDelete() {
      this.deleteItem = null
    }
  }
}
</script>

<style scoped lang="scss">
.empty-domain-card {
  width: 100%;
  border: 1px solid $color-gray-500;
  background: $color-gray-600;
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: $color-white;
  cursor: pointer;
  text-align: left;
}

.empty-domain-card:hover {
  border-color: $color-gray-400;
}

.card-icon {
  color: $color-white;
  flex-shrink: 0;
}

.card-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.domain {
  font-weight: 600;
}

.subtitle {
  color: $color-gray-300;
  font-size: 12px;
}

.card-plus {
  margin-left: auto;
  color: $color-white;
}
</style>
