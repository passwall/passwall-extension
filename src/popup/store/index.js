import Vue from "vue";
import Vuex from "vuex";
Vue.use(Vuex);

import Logins from "@p/views/Logins/store";
import CreditCards from "@/popup/views/CreditCards/store";
import Emails from "@p/views/Emails/store";
import BankAccounts from "@p/views/BankAccounts/store";
import Notes from "@p/views/Notes/store";
import Servers from "@p/views/Servers/store";

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
    CreditCards,
    Emails,
    BankAccounts,
    Notes,
    Servers,
  },
});
