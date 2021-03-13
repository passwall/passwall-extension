import store from '@p/store'

export default () => {
  store.commit('onInputSearchQuery', { target: { value: '' } })
}
