<template>
  <div class="container">
    <div class="mx-3">
      <div class="py-3 head">
        <span class="fw-bold fs-big c-white">Emails ({{ filteredList.length }})</span>
      </div>

      <ListLoader v-if="$wait.is($waiters.Emails.All)" />
      <EmptyState v-if="filteredList.length <= 0" />
      <ul class="items" v-else>
        <ListItem
          v-for="item in filteredList"
          :key="item.id"
          :url="item.title"
          :title="item.title"
          :subtitle="item.email"
          @click="clickItem(item)"
        />
      </ul>
    </div>
  </div>
</template>

<script>
import { useEmailsStore } from '@/stores/emails'
import { storeToRefs } from 'pinia'
import ListMixin from '@/mixins/list'

export default {
  mixins: [ListMixin],
  name: 'Emails', // it uses for loading state !! important
  setup() {
    const emailsStore = useEmailsStore()
    const { itemList } = storeToRefs(emailsStore)
    
    return {
      emailsStore,
      ItemList: itemList,
      FetchAll: emailsStore.fetchAll
    }
  },
  methods: {
    clickItem(detail) {
      this.emailsStore.setDetail(detail)
      this.$router.push({ name: 'EmailDetail', params: { id: detail.id } })
    }
  }
}
</script>

<style scoped lang="scss"></style>
