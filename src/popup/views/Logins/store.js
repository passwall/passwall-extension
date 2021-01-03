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
        },
        {
          id: 2,
          username: "yakuter@gmail.com",
          url: "https://www.gmail.com/",
          title: "Gmail",
        },
        {
          id: 5,
          username: "yakuter@gmail.com",
          url: "https://9gag.com/",
          title: "9GAG",
        },
        {
          id: 4,
          username: "yakuter@gmail.com",
          url: "https://www.twitter.com/",
          title: "Twitter",
        },
        {
          id: 3,
          username: "yakuter@gmail.com",
          url: "https://www.spotify.com/tr/",
          title: "Spotify",
        },

        {
          id: 6,
          username: "yakuter@gmail.com",
          url: "https://www.gmail.com/",
          title: "Gmail",
        },
        {
          id: 7,
          username: "yakuter@gmail.com",
          url: "https://www.gmail.com/",
          title: "Gmail",
        },
        {
          id: 8,
          username: "yakuter@gmail.com",
          url: "https://www.gmail.com/",
          title: "Gmail",
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
