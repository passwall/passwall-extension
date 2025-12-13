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
  
  computed: {
    isLoading() {
      return this.$wait.is(this.$waiters.Logins.All)
    }
  },
  
  methods: {
    clickItem(detail) {
      this.loginsStore.setDetail(detail)
      this.$router.push({ 
        name: 'LoginDetail', 
        params: { id: detail.id }
      })
    }
  }
}
</script>

<style scoped lang="scss"></style>
