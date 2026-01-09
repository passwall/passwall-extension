<template>
  <div class="container">
    <div class="mx-3">
      <div class="py-3 head">
        <span class="fw-bold fs-big c-white">Payment Cards ({{ filteredList.length }})</span>
      </div>

      <ListLoader v-if="isLoading" />
      <EmptyState v-if="!isLoading && filteredList.length <= 0" />
      <ul class="items" v-else>
        <ListItem
          v-for="item in filteredList"
          :key="item.id"
          :url="item.title"
          :title="item.title"
          :subtitle="item.card_number"
          @click="clickItem(item)"
        />
      </ul>
    </div>
  </div>
</template>

<script>
import { useItemsStore, ItemType } from '@/stores/items'
import { useAuthStore } from '@/stores/auth'
import { storeToRefs } from 'pinia'

export default {
  name: 'PaymentCards',
  
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
      _listFetched: false
    }
  },

  mounted() {
    const hasCards = this.ItemList?.filter(item => item.item_type === ItemType.Card).length > 0
    
    if (!this._listFetched && !hasCards) {
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
      
      const cardItems = this.ItemList.filter(item => item.item_type === ItemType.Card)
      
      const filtered = cardItems.filter(item =>
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
    }
  },

  methods: {
    async fetchAll() {
      try {
        await this.itemsStore.fetchItems({ type: ItemType.Card })
      } catch (error) {
        console.error('Failed to fetch cards:', error)
        this.$notifyError?.('Failed to load payment cards')
      }
    },

    clickItem(item) {
      this.$router.push({ name: 'CardDetail', params: { id: item.id } })
    }
  }
}
</script>

<style scoped lang="scss"></style>