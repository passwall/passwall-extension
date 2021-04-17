import { mapState } from 'vuex'

export default {
  beforeRouteEnter(to, from, next) {
    next(vm => {
        vm.fetchAll()
    })
  },
  methods: {
    async fetchAll() {
      try {
        await this.$request(this.FetchAll, this.$waiters[this.$options.name].All)
      } catch (error) {
        console.log(error)
      }
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
