import { useAuthStore } from '@/stores/auth'
import { storeToRefs } from 'pinia'

export default {
  data() {
    return {
      _listFetched: false
    }
  },

  beforeRouteEnter(to, from, next) {
    next(vm => {
      console.log('🔵 List mixin beforeRouteEnter, calling fetchAll...')
      vm.fetchAll()
    })
  },
  
  mounted() {
    // Safety: if beforeRouteEnter didn't run (e.g., cached view), fetch once on mount
    if (!this._listFetched && (!this.ItemList || this.ItemList.length === 0)) {
      this.fetchAll()
      this._listFetched = true
    }
  },

  methods: {
    fetchAll() {
      console.log('🔵 List mixin fetchAll called for:', this.$options.name)
      console.log('🔵 FetchAll function:', this.FetchAll)
      console.log('🔵 Waiter key:', this.$waiters[this.$options.name].All)
      return this.$request(this.FetchAll, this.$waiters[this.$options.name].All)
    }
  },

  computed: {
    searchQuery() {
      // Get authStore directly in computed (not from setup)
      const authStore = useAuthStore()
      console.log('🔍 searchQuery value:', authStore.searchQuery)
      return authStore.searchQuery
    },
    filteredList() {
      if (!this.ItemList) {
        console.log('🔍 filteredList: ItemList is null/undefined')
        return []
      }
      
      console.log('🔍 ItemList length:', this.ItemList.length)
      console.log('🔍 searchQuery for filtering:', this.searchQuery)
      
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

      console.log('🔍 filteredList result:', sorted.length, 'items')
      return sorted
    }
  }
}
