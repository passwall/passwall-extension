export default {
  data() {
    return {
      form: {}
    }
  },

  beforeRouteEnter(to, from, next) {
    next(vm => {
      vm.form = to.params.detail
    })
  }
}
