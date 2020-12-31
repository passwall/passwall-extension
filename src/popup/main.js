import Vue from "vue";
import "./config";

import App from "./App.vue";
import router from "@p/router";
import i18n from "@/i18n";
import "../styles/app.scss";

/* eslint-disable no-new */
new Vue({
  router,
  i18n,
  wait: window.wait,
  el: "#app",
  render: (h) => h(App),
});
