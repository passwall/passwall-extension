<template>
  <div class="container">
    <div class="mx-3">
      <div class="py-3 head">
        <span class="fw-bold fs-big c-white">Bank Accounts ({{ filteredList.length }})</span>
      </div>

      <ListLoader v-if="isLoading" />
      <EmptyState v-if="!isLoading && filteredList.length <= 0" />
      <ul class="items" v-else>
        <ListItem
          v-for="item in filteredList"
          :key="item.id"
          :url="item.title"
          :title="item.title"
          :subtitle="item.iban_number || item.account_number"
          :item-data="item"
          @edit="handleEdit"
          @delete="handleDelete"
          @click="clickItem(item)"
        />
      </ul>
    </div>

    <!-- Delete Confirmation Dialog -->
    <ConfirmDialog
      v-model:show="showDeleteConfirm"
      title="Delete Bank Account?"
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
  name: 'BankAccounts',
  
  setup() {
    const itemsStore = useItemsStore()
    const authStore = useAuthStore()
    const { items } = storeToRefs(itemsStore)
    
    return {
      itemsStore,
      authStore,
      ItemList: items
    }
  },

  data() {
    return {
      _listFetched: false,
      showDeleteConfirm: false,
      deleteItem: null
    }
  },

  mounted() {
    if (!this._listFetched) {
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
      
      const bankItems = this.ItemList.filter(item => item.item_type === ItemType.Bank)
      
      const filtered = bankItems.filter(item =>
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
          item.name ||
          ''
        ).toString().toLowerCase()
        return key(a).localeCompare(key(b))
      })

      return sorted
    },

    deleteConfirmMessage() {
      if (!this.deleteItem) return ''
      const name = this.deleteItem.title || this.deleteItem.name || 'this bank account'
      return 'Are you sure you want to delete "' + name + '"?\n\nThis action cannot be undone.'
    }
  },

  methods: {
    async fetchAll() {
      try {
        await this.itemsStore.fetchItems({ 
          type: ItemType.Bank,
          per_page: 10000 // Fetch all bank accounts (no pagination)
        })
      } catch (error) {
        console.error('Failed to fetch bank accounts:', error)
        this.$notifyError?.('Failed to load bank accounts')
      }
    },

    clickItem(item) {
      this.$router.push({ name: 'BankAccountDetail', params: { id: item.id } })
    },

    handleEdit(item) {
      this.$router.push({ name: 'BankAccountDetail', params: { id: item.id } })
    },

    handleDelete(item) {
      this.deleteItem = item
      this.showDeleteConfirm = true
    },

    async confirmDelete() {
      if (!this.deleteItem) return
      try {
        await this.itemsStore.deleteItem(this.deleteItem.id)
        this.$notifySuccess?.('Bank account deleted successfully')
      } catch (error) {
        console.error('Failed to delete bank account:', error)
        this.$notifyError?.('Failed to delete bank account')
      } finally {
        this.deleteItem = null
      }
    },

    cancelDelete() {
      this.deleteItem = null
    }
  }
}
</script>

<style lang="scss"></style>
