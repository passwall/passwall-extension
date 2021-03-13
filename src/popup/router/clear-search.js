import store from '@p/store'

export default (_, __, next) => {
  store.commit('onInputSearchQuery', { target: { value: '' } })
  next()
}
