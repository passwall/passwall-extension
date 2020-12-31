import Vue from "vue";

import "@p/router";

import VeeValidate from "vee-validate";
Vue.use(VeeValidate, { events: "input|blur" });

// Auto register all components
const requireComponent = require.context("../components", true, /\.(vue)$/);
requireComponent.keys().forEach((fileName) => {
  const componentConfig = requireComponent(fileName);
  Vue.component(componentConfig.default.name, componentConfig.default);
});
