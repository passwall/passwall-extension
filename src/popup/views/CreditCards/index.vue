<template>
  <div class="container">
    <div class="mx-3">
      <div class="py-3 head">
        <span class="fw-bold h5">Credit Cards</span>
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
import { mapActions, mapState } from 'vuex'
import ListMixin from '@/mixins/list'

export default {
  mixins: [ListMixin],
  name: 'CreditCards', // it uses for loading state !! important
  methods: {
    ...mapActions('CreditCards', ['FetchAll']),
    clickItem(detail) {
      this.$router.push({ name: 'CreditCardDetail', params: { detail, id: detail.id } })
    }
  },
  computed: {
    ...mapState('CreditCards', ['ItemList'])
  }
}
</script>

<style scoped lang="scss"></style>