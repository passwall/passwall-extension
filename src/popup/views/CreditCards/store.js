const ITEMS = [
  {
    id: 1,
    created_at: "2020-05-02T17:47:42.739124+03:00",
    updated_at: "2020-05-02T17:47:42.739124+03:00",
    deleted_at: null,
    title: "Enpara",
    cardholder_name: "Ömer Faruk Oruç",
    type: "Matercard",
    number: "1234-5678-1234-5678",
    verification_number: "123",
    expiry_date: "12/2022",
  },
  {
    id: 2,
    created_at: "2020-05-02T17:47:42.739124+03:00",
    updated_at: "2020-05-02T17:47:42.739124+03:00",
    deleted_at: null,
    title: "İş Bankası",
    cardholder_name: "Ömer Faruk Oruç",
    type: "Matercard",
    number: "1234-5678-1234-5678",
    verification_number: "456",
    expiry_date: "12/2022",
  },
];

export default {
  namespaced: true,

  state() {
    return {
      items: ITEMS,
      detail: null,
    };
  },
  mutations: {},
  actions: {
    setDetail({ state }, id) {
      state.detail = state.items.find((l) => l.id === id);
    },
  },
};
