import Vue from "vue";
import Router from "vue-router";

Vue.use(Router);

const router = new Router({
  routes: [
    {
      path: "/login",
      name: "login",
      component: require("@p/views/Auth/Login").default,
      meta: {
        auth: true,
      },
    },
    { path: "*", redirect: "/login" },
  ],
});

export default router;
