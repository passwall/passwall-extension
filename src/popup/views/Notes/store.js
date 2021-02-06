const ITEMS = [
  {
    id: 1,
    title: "Toplantı Notları",
    note:
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's",
  },
  {
    id: 2,
    title: "Genel Değerlendirme",
    note:
      "Lorem Ipsum has been the industry's Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's",
  },
];

export default {
  namespaced: true,

  state() {
    return {
      items: ITEMS,
      detail: ITEMS[0]
    };
  },
  mutations: {
    setDetail(state, id) {
      state.detail = state.items.find((l) => l.id === id);
    },
  },
  actions: {
    setDetail({ commit }, id) {
      commit("setDetail", id);
    },
  },
};
