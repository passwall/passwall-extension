import Vue from "vue";
import "@p/router";

import browser from "webextension-polyfill";
Vue.prototype.$browser = browser;

import * as Waiters from "@/utils/waiters";
Vue.prototype.$waiters = Waiters;

import VeeValidate from "vee-validate";
Vue.use(VeeValidate, { events: "input|blur" });

import VueWait from "vue-wait";
Vue.use(VueWait);

window.wait = new VueWait({
  registerComponent: false,
  registerDirective: false,
});

// Auto register all components
const requireComponent = require.context("../components", true, /\.(vue)$/);
requireComponent.keys().forEach((fileName) => {
  const componentConfig = requireComponent(fileName);
  Vue.component(componentConfig.default.name, componentConfig.default);
});

Vue.prototype.$request = async (callback, waitKey, errorCallback = null) => {
  try {
    window.wait.start(waitKey);
    await callback();
  } catch (error) {
    console.log(error);

    if (error.response) {
      if (error.response.status === 401 && !router.app._route.meta.auth) {
        store.dispatch("Logout");
        return router.push({ name: "Login" });
      }

      if (errorCallback) {
        errorCallback(error);
      } else if (error.response.status >= 500) {
        Vue.prototype.$notifyError(i18n.t("API500ErrorMessage"));
      } else if (error.response.data.Message && error.response.status != 401) {
        Vue.prototype.$notifyError(error.response.data.Message);
      }
    } else {
      Vue.prototype.$notifyError("Network Error !");
    }
  } finally {
    window.wait.end(waitKey);
  }
};
