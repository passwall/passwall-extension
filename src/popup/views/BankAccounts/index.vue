<template>
  <div class="container">
    <div class="mx-3">
      <div class="py-3 head">
        <span class="fw-bold fs-big c-white">Bank Accounts ({{ filteredList.length }})</span>
      </div>

      <ListLoader v-if="$wait.is($waiters.BankAccounts.All)" />
      <EmptyState v-if="filteredList.length <= 0" />
      <ul class="items" v-else>
        <ListItem
          v-for="item in filteredList"
          :key="item.id"
          :url="item.title"
          :title="item.title"
          :subtitle="item.iban"
          @click="clickItem(item)"
        />
      </ul>
    </div>
  </div>
</template>

<script>
import { useBankAccountsStore } from '@/stores/bankAccounts'
import { storeToRefs } from 'pinia'
import ListMixin from '@/mixins/list'

export default {
  mixins: [ListMixin],
  name: 'BankAccounts', // it uses for loading state !! important
  setup() {
    const bankAccountsStore = useBankAccountsStore()
    const { itemList } = storeToRefs(bankAccountsStore)
    
    return {
      bankAccountsStore,
      ItemList: itemList,
      FetchAll: bankAccountsStore.fetchAll
    }
  },
  methods: {
    clickItem(detail) {
      this.bankAccountsStore.setDetail(detail)
      this.$router.push({ name: 'BankAccountDetail', params: { id: detail.id } })
    }
  }
}
</script>

<style lang="scss"></style>
