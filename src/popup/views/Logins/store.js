export default {
  namespaced: true,

  state() {
    return {
      items: [
        {
          id: 1,
          username: "yakuter@gmail.com",
          url: "https://slack.com/",
          title: "Slack",
          password: "passWorD123"
        },
        {
          id: 2,
          username: "yakuter@gmail.com",
          url: "https://www.gmail.com/",
          title: "Gmail",
          password: "passWorD123"
        },
        {
          id: 5,
          username: "yakuter@gmail.com",
          url: "https://9gag.com/",
          title: "9GAG",
          password: "passWorD123"
        },
        {
          id: 4,
          username: "yakuter@gmail.com",
          url: "https://www.twitter.com/",
          title: "Twitter",
          password: "passWorD123"
        },
        {
          id: 3,
          username: "yakuter@gmail.com",
          url: "https://www.spotify.com/tr/",
          title: "Spotify",
          password: "passWorD123"
        },

        {
          id: 6,
          username: "yakuter@gmail.com",
          url: "https://www.gmail.com/",
          title: "Gmail",
          password: "passWorD123"
        },
        {
          id: 7,
          username: "yakuter@gmail.com",
          url: "https://www.gmail.com/",
          title: "Gmail",
          password: "passWorD123"
        },
        {
          id: 8,
          username: "yakuter@gmail.com",
          url: "https://www.gmail.com/",
          title: "Gmail",
          password: "passWorD123"
        },
      ],
      detail: null,
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
