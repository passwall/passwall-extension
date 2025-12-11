<template>
  <div class="container">
    <div class="mx-3">
      <div class="py-3 head">
        <span class="fw-bold fs-big c-white">Credit Cards ({{ filteredList.length }})</span>
      </div>

      <ListLoader v-if="$wait.is($waiters.CreditCards.All)" />
      <EmptyState v-if="filteredList.length <= 0" />
      <ul class="items" v-else>
        <ListItem
          v-for="item in filteredList"
          :key="item.id"
          :url="item.title"
          :title="item.title"
          :subtitle="item.number"
          @click="clickItem(item)"
        />
      </ul>
    </div>
  </div>
</template>

<script>
import { useCreditCardsStore } from '@/stores/creditCards'
import { storeToRefs } from 'pinia'
import ListMixin from '@/mixins/list'

export default {
  mixins: [ListMixin],
  name: 'CreditCards', // it uses for loading state !! important
  setup() {
    const creditCardsStore = useCreditCardsStore()
    const { itemList } = storeToRefs(creditCardsStore)
    
    return {
      creditCardsStore,
      ItemList: itemList,
      FetchAll: creditCardsStore.fetchAll
    }
  },
  methods: {
    clickItem(detail) {
      this.creditCardsStore.setDetail(detail)
      this.$router.push({ name: 'CreditCardDetail', params: { id: detail.id } })
    }
  }
}
</script>

<style scoped lang="scss"></style>