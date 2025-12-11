<template>
  <div class="container">
    <div class="mx-3">
      <div class="py-3 head">
        <span class="fw-bold fs-big c-white">Servers ({{ filteredList.length }})</span>
      </div>

      <ListLoader v-if="$wait.is($waiters.Logins.All)" />
      <EmptyState v-if="filteredList.length <= 0" />
      <ul class="items" v-else>
        <ListItem
          v-for="item in filteredList"
          :key="item.id"
          :url="item.url"
          :title="item.title"
          :subtitle="item.ip"
          @click="clickItem(item)"
        />
      </ul>
    </div>
  </div>
</template>

<script>
import { useServersStore } from '@/stores/servers'
import { storeToRefs } from 'pinia'
import ListMixin from '@/mixins/list'

export default {
  mixins: [ListMixin],
  name: 'Servers', // it uses for loading state !! important
  setup() {
    const serversStore = useServersStore()
    const { itemList } = storeToRefs(serversStore)
    
    return {
      serversStore,
      ItemList: itemList,
      FetchAll: serversStore.fetchAll
    }
  },
  methods: {
    clickItem(detail) {
      this.serversStore.setDetail(detail)
      this.$router.push({ name: 'ServerDetail', params: { id: detail.id } })
    }
  }
}
</script>

<style scoped lang="scss"></style>
