export default {
  data() {
    return {
      form: {}
    }
  },

  beforeRouteEnter(to, from, next) {
    next(vm => {
      if (to.params.detail) {
        vm.form = to.params.detail
      }
    })
  }
}
