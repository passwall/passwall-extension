import { useAuthStore } from '@/stores/auth'

export default {
  data() {
    return {
      _listFetched: false
    }
  },

  beforeRouteEnter(to, from, next) {
    next(vm => vm.fetchAll())
  },
  
  mounted() {
    if (!this._listFetched && (!this.ItemList || this.ItemList.length === 0)) {
      this.fetchAll()
      this._listFetched = true
    }
  },

  methods: {
    fetchAll() {
      return this.$request(this.FetchAll, this.$waiters[this.$options.name].All)
    }
  },

  computed: {
    searchQuery() {
      const authStore = useAuthStore()
      return authStore.searchQuery
    },
    
    filteredList() {
      if (!this.ItemList) return []
      
      const filtered = this.ItemList.filter(item =>
        Object.values(item).some(value =>
          (value || '')
            .toString()
            .toLowerCase()
            .includes(this.searchQuery.toLowerCase())
        )
      )
      
      const sorted = [...filtered].sort((a, b) => {
        const key = (item) => (
          item.title ||
          item.url ||
          item.email ||
          item.username ||
          ''
        ).toString().toLowerCase()
        return key(a).localeCompare(key(b))
      })

      return sorted
    }
  }
}
