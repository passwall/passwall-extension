<template>
  <div class="container">
    <div class="mx-3">
      <div class="py-3 head">
        <span class="fw-bold fs-big c-white">Notes ({{ filteredList.length }})</span>
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
import { useNotesStore } from '@/stores/notes'
import { storeToRefs } from 'pinia'
import ListMixin from '@/mixins/list'

export default {
  mixins: [ListMixin],
  name: 'Notes', // it uses for loading state !! important
  setup() {
    const notesStore = useNotesStore()
    const { itemList } = storeToRefs(notesStore)
    
    return {
      notesStore,
      ItemList: itemList,
      FetchAll: notesStore.fetchAll
    }
  },
  methods: {
    clickItem(detail) {
      this.notesStore.setDetail(detail)
      this.$router.push({ name: 'NoteDetail', params: { id: detail.id } })
    }
  }
}
</script>

<style scoped lang="scss"></style>
