import LocalForage from 'localforage'

export default LocalForage.createInstance({
  driver: LocalForage.INDEXEDDB,
  name: 'Passwall Storage',
  storeName: "login_data"
})
