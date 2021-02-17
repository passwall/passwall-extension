import { mapState } from 'vuex'

export default {
  beforeRouteUpdate(to, _, next) {
    if (to.params.refresh) {
      this.fetchAll()
    }
    next()
  },

  created() {
    this.fetchAll()
  },

  methods: {
    async fetchAll() {
      try {
        await this.$request(this.FetchAll, this.$waiters[this.$options.name].ALL)
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
