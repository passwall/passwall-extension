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
        {
          path: "/bank-accounts",
          name: "BankAccounts",
          component: require("@p/views/BankAccount").default,
        },
        {
          path: "/credit-cards",
          name: "CreditCards",
          component: require("@p/views/CreditCard").default,
        },
        {
          path: "/emails",
          name: "Emails",
          component: require("@p/views/Emails").default,
        },
        {
          path: "/notes",
          name: "Notes",
          component: require("@p/views/Notes").default,
        },
        {
          path: "/servers",
          name: "Servers",
          component: require("@p/views/Servers").default,
        },
      ],
    },

    {
      path: "/create",
      name: "LoginCreate",
      component: require("@p/views/Logins/create").default,
    },

    { path: "*", redirect: "/login" },
  ],
});

router.afterEach((to, from) => {
  const toDepth = to.path.split("/").length;
  const fromDepth = from.path.split("/").length;
  to.meta.transitionName = toDepth < fromDepth ? "slide-right" : "slide-left";
});

export default router;
