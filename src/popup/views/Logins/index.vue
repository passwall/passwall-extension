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
import { useLoginsStore } from '@/stores/logins'
import { useAuthStore } from '@/stores/auth'
import { storeToRefs } from 'pinia'
import ListMixin from '@/mixins/list'

export default {
  mixins: [ListMixin],
  name: 'Logins',
  
  setup() {
    const loginsStore = useLoginsStore()
    const authStore = useAuthStore()
    const { itemList } = storeToRefs(loginsStore)
    
    return {
      loginsStore,
      authStore,
      ItemList: itemList,
      FetchAll: loginsStore.fetchAll,
      onInputSearchQuery: authStore.setSearchQuery
    }
  },

  data() {
    return {
      showDeleteConfirm: false,
      deleteItem: null
    }
  },
  
  computed: {
    isLoading() {
      return this.$wait.is(this.$waiters.Logins.All)
    },

    deleteConfirmMessage() {
      if (!this.deleteItem) return ''
      const name = this.deleteItem.title || this.deleteItem.url
      return 'Are you sure you want to delete "' + name + '"?\n\nThis action cannot be undone.'
    }
  },
  
  methods: {
    handleEdit(item) {
      this.loginsStore.setDetail(item)
      this.$router.push({ 
        name: 'LoginDetail', 
        params: { id: item.id }
      })
    },
    
    handleDelete(item) {
      this.deleteItem = item
      this.showDeleteConfirm = true
    },

    async confirmDelete() {
      if (!this.deleteItem) return

      const onSuccess = async () => {
        await this.loginsStore.delete(this.deleteItem.id)
        const index = this.ItemList.findIndex(i => i.id === this.deleteItem.id)
        if (index !== -1) {
          this.ItemList.splice(index, 1)
        }
        this.$notifySuccess?.('Password deleted successfully')
      }
      
      await this.$request(onSuccess, this.$waiters.Logins.Delete)
      this.deleteItem = null
    },

    cancelDelete() {
      this.deleteItem = null
    }
  }
}
</script>

<style scoped lang="scss"></style>
