export default {
  data() {
    return {
      form: {}
    }
  },

  beforeRouteEnter(to, from, next) {
    console.log('🔵 Detail mixin beforeRouteEnter, params:', to.params)
    next(vm => {
      if (to.params.detail) {
        console.log('✅ Setting form from route params:', to.params.detail)
        vm.form = to.params.detail
      } else {
        console.log('⚠️ No detail in route params!')
      }
    })
  },
  
  mounted() {
    console.log('🔵 Detail mounted, form:', this.form)
  }
}
