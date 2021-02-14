const ITEMS = [
  {
    id: 1,
    created_at: '2020-05-02T17:47:42.739124+03:00',
    updated_at: '2020-05-02T17:47:42.739124+03:00',
    deleted_at: null,
    title: 'Enpara',
    account_name: 'Erhan Yakut',
    account_number: '1183452934',
    iban: 'TR65 0001 2001 1234 0001 1234 80',
    currency: 'TL',
    password: '123456'
  },
  {
    id: 2,
    created_at: '2020-05-02T17:47:42.739124+03:00',
    updated_at: '2020-05-02T17:47:42.739124+03:00',
    deleted_at: null,
    title: 'Garanti',
    account_name: 'Ömer Faruk',
    account_number: '1183452934',
    iban: 'TR65 0001 2001 3333 1111 2222 80',
    currency: 'TL',
    password: '123456'
  }
]

export default {
  namespaced: true,

  state() {
    return {
      items: ITEMS,
      detail: ITEMS[0]
    }
  },
  mutations: {},
  actions: {
    setDetail({ state }, id) {
      state.detail = state.items.find(l => l.id === id)
    }
  }
}
