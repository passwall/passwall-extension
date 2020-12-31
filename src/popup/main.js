import Vue from "vue";
import "./config";

import App from "./App.vue";
import router from "@p/router";
import "../styles/app.scss";

/* eslint-disable no-new */
new Vue({
  router,
  el: "#app",
  render: (h) => h(App),
});
