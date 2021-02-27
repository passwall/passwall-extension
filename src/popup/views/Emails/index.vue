<template>
  <div class="container">
    <div class="mx-3">
      <div class="py-3 head">
        <span class="fw-bold h5">Emails</span>
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
import { mapActions, mapState } from 'vuex'
import ListMixin from '@/mixins/list'

export default {
  mixins: [ListMixin],
  name: 'Emails', // it uses for loading state !! important
  methods: {
    ...mapActions('Emails', ['FetchAll']),
    clickItem(detail) {
      this.$router.push({ name: 'EmailDetail', params: { detail, id: detail.id } })
    }
  },
  computed: {
    ...mapState('Emails', ['ItemList'])
  }
}
</script>

<style scoped lang="scss"></style>
