<template>
  <div class="container">
    <div class="mx-3">
      <div class="py-3 head">
        <span class="fw-bold fs-big c-white">Logins ({{ filteredList.length }})</span>
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
          @click="clickItem"
        />
      </ul>
    </div>
  </div>
</template>

<script>
import { useLoginsStore } from '@/stores/logins'
import { useAuthStore } from '@/stores/auth'
import { storeToRefs } from 'pinia'
import ListMixin from '@/mixins/list'

import { getCurrentTab, getHostName } from '@/utils/helpers'

export default {
  mixins: [ListMixin],
  name: 'Logins', // it uses for loading state !! important,
  setup() {
    const loginsStore = useLoginsStore()
    const authStore = useAuthStore()
    
    console.log('🔵 Logins setup, store itemList:', loginsStore.itemList.length)
    
    return {
      loginsStore,
      authStore,
      FetchAll: loginsStore.fetchAll,
      onInputSearchQuery: authStore.setSearchQuery
    }
  },
  
  computed: {
    ItemList() {
      const list = this.loginsStore.itemList
      console.log('🔍 Computed ItemList called, length:', list?.length)
      return list
    },
    isLoading() {
      const loading = this.$wait.is(this.$waiters.Logins.All)
      console.log('🔍 isLoading computed:', loading, 'waitKey:', this.$waiters.Logins.All)
      return loading
    }
  },
  
  data() {
    return {
      hasFetched: false
    }
  },
  
  mounted() {
    console.log('🔵 Logins mounted, ItemList:', this.ItemList)
    console.log('🔵 Logins mounted, filteredList:', this.filteredList)
    
    // Fetch on mount if not already fetched and no items
    if (!this.hasFetched && this.ItemList.length === 0) {
      console.log('🔵 Mounting without data, triggering fetchAll...')
      this.fetchAll()
      this.hasFetched = true
    }
  },
  
  watch: {
    ItemList: {
      handler(newVal, oldVal) {
        console.log('⚠️ ItemList changed!', 'from:', oldVal?.length, 'to:', newVal?.length)
      },
      deep: true
    },
    filteredList(newVal, oldVal) {
      console.log('⚠️ filteredList changed!', 'from:', oldVal?.length, 'to:', newVal?.length)
    }
  },
  
  beforeRouteEnter: (to, from, next) => {
    console.log('🔵 Logins beforeRouteEnter hook, from:', from.path, 'to:', to.path)
    next()
  },
  methods: {
    clickItem(detail) {
      // Vue Router 4: Large objects in params can get lost
      // Save detail to store first
      this.loginsStore.setDetail(detail)
      
      // Navigate with just ID
      this.$router.push({ 
        name: 'LoginDetail', 
        params: { id: detail.id }
      })
    }
  }
}
</script>

<style scoped lang="scss"></style>
