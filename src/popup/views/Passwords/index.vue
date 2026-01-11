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
        <EmptyState />
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
      _listFetched: false
    }
  },

  mounted() {
    const hasPasswords = this.ItemList?.filter(item => item.item_type === ItemType.Password).length > 0
    
    if (!this._listFetched && !hasPasswords) {
      this.fetchAll()
      this._listFetched = true
    }
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

    deleteConfirmMessage() {
      if (!this.deleteItem) return ''
      const name = this.deleteItem.title || this.deleteItem.url
      return 'Are you sure you want to delete "' + name + '"?\n\nThis action cannot be undone.'
    }
  },
  
  methods: {
    async fetchAll() {
      try {
        await this.itemsStore.fetchItems({ 
          type: ItemType.Password,
          per_page: 10000 // Fetch all passwords (no pagination)
        })
      } catch (error) {
        console.error('Failed to fetch passwords:', error)
        this.$notifyError?.('Failed to load passwords')
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

<style scoped lang="scss"></style>
