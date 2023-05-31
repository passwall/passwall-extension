import { mapState } from 'vuex'

export default {
  beforeRouteEnter(to, from, next) {
    console.log('beforeRouteEnter')
    next(vm => {
      vm.fetchAll()
    })
  },
  methods: {
    fetchAll() {
      return this.$request(this.FetchAll, this.$waiters[this.$options.name].All)
    }
  },

  computed: {
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
