<template>
  <div class="container">
    <div class="mx-3">
      <div class="py-3 head">
        <span class="fw-bold h5">Logins</span>
      </div>
      <ListLoader v-if="$wait.is($waiters.Logins.All)" />
      <EmptyState v-if="filteredList.length <= 0" />
      <ul class="items" data-testid="result" v-else>
        <ListItem
          v-for="item in filteredList"
          :key="item.id"
          :url="item.url"
          :title="$helpers.textEllipsis(item.title || item.url, 30)"
          :subtitle="item.username"
          @click="clickItem(item)"
        />
      </ul>
    </div>
  </div>
</template>

<script>
import { mapActions, mapState, mapMutations } from 'vuex'


import { getCurrentTab, getHostName } from '@/utils/helpers'

export default {
  // ...ListMixin,
  name: 'Logins', // it uses for loading state !! important,
  beforeRouteEnter: (_, from, next) => {
    next(vm => {
      vm.fetchAll()
      if (from.path === '/')
        getCurrentTab().then(tab => {
          if (tab) {
            vm.onInputSearchQuery({ target: { value: getHostName(tab.url) } })
          }
        })
    })
  },
  methods: {
    ...mapActions('Logins', ['FetchAll']),
    ...mapMutations(['onInputSearchQuery']),
    clickItem(detail) {
      this.$router.push({ name: 'LoginDetail', params: { detail, id: detail.id } })
    },
    fetchAll() {
      return this.$request(this.FetchAll, this.$waiters[this.$options.name].All)
    }
  },
  computed: {
    ...mapState('Logins', ['ItemList']),
    ...mapState(['searchQuery']),
    filteredList() {
      return this.ItemList.filter(item =>
        Object.values(item).some(value =>
          (value || '')
            .toString()
            .toLowerCase()
            .includes(this.searchQuery.toLowerCase())
        )
      )
    }
  }
}
</script>

<style scoped lang="scss"></style>
