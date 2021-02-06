import Vue from "vue";
import Router from "vue-router";

Vue.use(Router);

const router = new Router({
  routes: [
    {
      path: "/login",
      name: "login",
      redirect: "/home",
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
          component: require("@/popup/views/BankAccounts").default,
        },
        {
          path: "/credit-cards",
          name: "CreditCards",
          component: require("@/popup/views/CreditCards").default,
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
      path: "logins/create",
      name: "LoginCreate",
      component: require("@p/views/Logins/create").default,
    },
    {
      path: "/logins/:id",
      name: "LoginDetail",
      component: require("@p/views/Logins/detail").default,
    },
    {
      path: "/credit-cards/create",
      name: "CreditCardCreate",
      component: require("@/popup/views/CreditCards/create").default,
    },
    {
      path: "/credit-cards/:id",
      name: "CreditCardDetail",
      component: require("@/popup/views/CreditCards/detail").default,
    },
    {
      path: "/emails/create",
      name: "EmailCreate",
      component: require("@p/views/Emails/create").default,
    },
    {
      path: "/emails/:id",
      name: "EmailDetail",
      component: require("@p/views/Emails/detail").default,
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
