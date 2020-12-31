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
    {
      path: "/home",
      name: "Home",
      redirect: "/logins",
      component: require("@p/views/Home").default,
      children: [
        {
          path: "/logins",
          name: "Logins",
          component: require("@p/views/Logins").default,
        },
      ],
    },
    { path: "*", redirect: "/login" },
  ],
});

export default router;
