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
import ListMixin from '@/mixins/list'

import { getCurrentTab, getHostName } from '@/utils/helpers'

export default {
  mixins: [ListMixin],
  name: 'Logins', // it uses for loading state !! important,
  beforeRouteEnter: (_, from, next) => {
    next(vm => {
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
    sendLogins() {
      if (this.ItemList.length === 0) {
        return
      } 
      this.$browser.runtime
        .sendMessage({
          message: 'fill-hashmap-from-popup',
          data: this.ItemList
        })
        .then(() => {
          console.log('Form data sent successfully')
        })
        .catch((error) => {
          console.error('Can not send data to background script Error: ', error)
        })
    }
  },
  computed: {
    ...mapState('Logins', ['ItemList'])
  },
  created: function() {
    this.fetchAll().then(
       () => this.sendLogins()
    )
  }
}
</script>

<style scoped lang="scss"></style>
