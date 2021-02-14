<template>
  <div class="container">
    <div class="mx-3">
      <div class="py-3 head">
        <span class="fw-bold h5">Servers</span>
      </div>

      <EmptyState v-if="items.length <= 0" />

      <ul class="items" v-else>
        <ListItem
          v-for="item in items"
          :key="item.id"
          :url="item.url"
          :title="item.title"
          :subtitle="item.ip"
          @click="clickItem(item.id)"
        />
      </ul>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'

export default {
  computed: {
    ...mapState('Servers', ['items'])
  },
  methods: {
    clickItem(id) {
      this.$store.dispatch('Servers/setDetail', id)
      this.$router.push({ name: 'ServerDetail', params: { id } })
    }
  }
}
</script>

<style scoped lang="scss"></style>
