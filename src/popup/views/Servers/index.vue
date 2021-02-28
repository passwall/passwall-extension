<template>
  <div class="container">
    <div class="mx-3">
      <div class="py-3 head">
        <span class="fw-bold h5">Servers</span>
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
import { mapActions, mapState } from 'vuex'
import ListMixin from '@/mixins/list'

export default {
  mixins: [ListMixin],
  name: 'Servers', // it uses for loading state !! important
  methods: {
    ...mapActions('Servers', ['FetchAll']),
    clickItem(detail) {
      this.$router.push({ name: 'ServerDetail', params: { detail, id: detail.id } })
    }
  },
  computed: {
    ...mapState('Servers', ['ItemList'])
  }
}
</script>

<style scoped lang="scss"></style>
