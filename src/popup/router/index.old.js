import Vue from 'vue'
import Router from 'vue-router'
import AuthCheck from './auth-check'
import ClearSearch from '@p/router/clear-search'
import Storage from '@/utils/storage'

Vue.use(Router)

const router = new Router({
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: require('@p/views/Auth/Login').default,
      meta: {
        auth: true
      }
    },

    {
      path: '/home',
      name: 'Home',
      redirect: '/logins',
      component: require('@p/views/Home').default,
      children: [
        {
          path: '/logins',
          name: 'Logins',
          component: require('@p/views/Logins').default
        },
        {
          path: '/bank-accounts',
          name: 'BankAccounts',
          component: require('@p/views/BankAccounts').default
        },
        {
          path: '/credit-cards',
          name: 'CreditCards',
          component: require('@p/views/CreditCards').default
        },
        {
          path: '/emails',
          name: 'Emails',
          component: require('@p/views/Emails').default
        },
        {
          path: '/notes',
          name: 'Notes',
          component: require('@p/views/Notes').default
        },
        {
          path: '/servers',
          name: 'Servers',
          component: require('@p/views/Servers').default
        }
      ]
    },
    {
      path: '/change-master-password',
      name: 'ChangeMasterPassword',
      component: require('@p/views/ChangeMasterPassword').default
    },
    {
      path: '/migration',
      name: 'Migration',
      component: require('@p/views/Migration').default
    },
    {
      path: '/logins/create',
      name: 'LoginCreate',
      component: require('@p/views/Logins/create').default
    },
    {
      path: '/logins/:id',
      name: 'LoginDetail',
      component: require('@p/views/Logins/detail').default
    },
    {
      path: '/credit-cards/create',
      name: 'CreditCardCreate',
      component: require('@p/views/CreditCards/create').default
    },
    {
      path: '/credit-cards/:id',
      name: 'CreditCardDetail',
      component: require('@p/views/CreditCards/detail').default
    },
    {
      path: '/emails/create',
      name: 'EmailCreate',
      component: require('@p/views/Emails/create').default
    },
    {
      path: '/emails/:id',
      name: 'EmailDetail',
      component: require('@p/views/Emails/detail').default
    },
    {
      path: '/bank-accounts/create',
      name: 'BankAccountCreate',
      component: require('@p/views/BankAccounts/create').default
    },
    {
      path: '/bank-accounts/:id',
      name: 'BankAccountDetail',
      component: require('@p/views/BankAccounts/detail').default
    },
    {
      path: '/notes/create',
      name: 'NoteCreate',
      component: require('@p/views/Notes/create').default
    },
    {
      path: '/notes/:id',
      name: 'NoteDetail',
      component: require('@p/views/Notes/detail').default
    },
    {
      path: '/servers/create',
      name: 'ServerCreate',
      component: require('@p/views/Servers/create').default
    },
    {
      path: '/servers/:id',
      name: 'ServerDetail',
      component: require('@p/views/Servers/detail').default
    },
    {
      path: '/password-generator',
      name: 'Generator',
      component: require('@p/views/Generator').default
    },
    {
      path: '/Inject/savePassword',
      name: 'SavePassword',
      component: require('@p/views/Inject/SavePassword').default
    },
    {
      path: '/Inject/loginAsPopup',
      name: 'LoginAsPopup',
      component: require('@p/views/Inject/LoginAs').default
    },

    { path: '*', redirect: '/login' }
  ]
})

router.afterEach((to, from) => {
  Storage.setItem('latest_route', to.name)
  Storage.setItem('latest_route_param_detail', to.params.detail)
  Storage.setItem('create_form', null)
})

router.afterEach((to, from) => {
  const toDepth = to.path.split('/').length
  const fromDepth = from.path.split('/').length
  to.meta.transitionName = toDepth < fromDepth ? 'slide-right' : 'slide-left'
})

router.afterEach(ClearSearch)

router.beforeEach(AuthCheck)

let isFirstTransition = true
router.beforeEach(async (to, from, next) => {
  const lastRouteName = await Storage.getItem('latest_route')
  const detail = await Storage.getItem('latest_route_param_detail')
  const shouldRedirect = Boolean(
    to.name === 'Logins' &&
    lastRouteName &&
    isFirstTransition &&
    lastRouteName !== 'SavePassword' &&
    lastRouteName !== 'LoginAsPopup'
  )

  if (shouldRedirect) {
    if (lastRouteName.search('Detail') > -1) {
      next({ name: lastRouteName, params: { detail, id: detail.id } })
    } else {
      next({ name: lastRouteName })
    }
  } else {
    next()
  }

  isFirstTransition = false
})

export default router
