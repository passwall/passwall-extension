const ITEMS = [
  {
    id: 1,
    created_at: "2020-05-02T17:47:42.739124+03:00",
    updated_at: "2020-05-02T17:47:42.739124+03:00",
    deleted_at: null,
    title: "Passwall Server",
    ip: "192.68.1.1",
    username: "passwall",
    password: "password123",
    url: "https://passwall.io",
    hosting_username: "hostuser",
    hosting_password: "hostpass",
    admin_username: "adminuser",
    admin_password: "adminpass",
    extra: "passwall extra notes",
  },
  {
    id: 2,
    created_at: "2020-05-02T17:47:42.739124+03:00",
    updated_at: "2020-05-02T17:47:42.739124+03:00",
    deleted_at: null,
    title: "Google Server",
    ip: "127.0.0.1",
    username: "passwall",
    password: "password123",
    url: "https://passwall.io",
    hosting_username: "hostuser",
    hosting_password: "hostpass",
    admin_username: "adminuser",
    admin_password: "adminpass",
    extra: "passwall extra notes",
  },
];

export default {
  namespaced: true,

  state() {
    return {
      items: ITEMS,
      detail: ITEMS[0],
    };
  },
  mutations: {},
  actions: {
    setDetail({ state }, id) {
      state.detail = state.items.find((l) => l.id === id);
    },
  },
};
