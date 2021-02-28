<template>
  <div class="container">
    <div class="mx-3">
      <div class="py-3 head">
        <span class="fw-bold h5">Notes</span>
      </div>

      <ListLoader v-if="$wait.is($waiters.Emails.All)" />
      <EmptyState v-if="filteredList.length <= 0" />
      <ul class="items" v-else>
        <ListItem
          v-for="item in filteredList"
          :key="item.id"
          :url="item.title"
          :title="item.title"
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
  name: 'Notes', // it uses for loading state !! important
  methods: {
    ...mapActions('Notes', ['FetchAll']),
    clickItem(detail) {
      this.$router.push({ name: 'NoteDetail', params: { detail, id: detail.id } })
    }
  },
  computed: {
    ...mapState('Notes', ['ItemList'])
  }
}
</script>

<style scoped lang="scss"></style>
