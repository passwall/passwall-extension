import Vue from "vue";
import Vuex from "vuex";
Vue.use(Vuex);

import Logins from "@p/views/Logins/store";
import CreditCard from "@p/views/CreditCard/store";

export default new Vuex.Store({
  state() {
    return {
      user: {
        name: "Ömer Faruk",
      },
    };
  },

  modules: {
    Logins,
    CreditCard,
  },
});
