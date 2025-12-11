import { createRouter, createWebHashHistory } from 'vue-router'
import AuthCheck from './auth-check'
import ClearSearch from '@p/router/clear-search'
import Storage from '@/utils/storage'

// Static imports for browser extension (dynamic imports don't work well with CSP)
import Login from '@p/views/Auth/Login.vue'
import Home from '@p/views/Home/index.vue'
import Logins from '@p/views/Logins/index.vue'
import BankAccounts from '@p/views/BankAccounts/index.vue'
import CreditCards from '@p/views/CreditCards/index.vue'
import Emails from '@p/views/Emails/index.vue'
import Notes from '@p/views/Notes/index.vue'
import Servers from '@p/views/Servers/index.vue'
import ChangeMasterPassword from '@p/views/ChangeMasterPassword/index.vue'
import Migration from '@p/views/Migration/index.vue'
import LoginCreate from '@p/views/Logins/create.vue'
import LoginDetail from '@p/views/Logins/detail.vue'
import CreditCardCreate from '@p/views/CreditCards/create.vue'
import CreditCardDetail from '@p/views/CreditCards/detail.vue'
import EmailCreate from '@p/views/Emails/create.vue'
import EmailDetail from '@p/views/Emails/detail.vue'
import BankAccountCreate from '@p/views/BankAccounts/create.vue'
import BankAccountDetail from '@p/views/BankAccounts/detail.vue'
import NoteCreate from '@p/views/Notes/create.vue'
import NoteDetail from '@p/views/Notes/detail.vue'
import ServerCreate from '@p/views/Servers/create.vue'
import ServerDetail from '@p/views/Servers/detail.vue'
import Generator from '@p/views/Generator/index.vue'
import SavePassword from '@p/views/Inject/SavePassword/index.vue'
import LoginAsPopup from '@p/views/Inject/LoginAs/index.vue'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: {
      auth: true
    }
  },
  {
    path: '/home',
    name: 'Home',
    redirect: '/logins',
    component: Home,
    children: [
      {
        path: '/logins',
        name: 'Logins',
        component: Logins
      },
      {
        path: '/bank-accounts',
        name: 'BankAccounts',
        component: BankAccounts
      },
      {
        path: '/credit-cards',
        name: 'CreditCards',
        component: CreditCards
      },
      {
        path: '/emails',
        name: 'Emails',
        component: Emails
      },
      {
        path: '/notes',
        name: 'Notes',
        component: Notes
      },
      {
        path: '/servers',
        name: 'Servers',
        component: Servers
      }
    ]
  },
  {
    path: '/change-master-password',
    name: 'ChangeMasterPassword',
    component: ChangeMasterPassword
  },
  {
    path: '/migration',
    name: 'Migration',
    component: Migration
  },
  {
    path: '/logins/create',
    name: 'LoginCreate',
    component: LoginCreate
  },
  {
    path: '/logins/:id',
    name: 'LoginDetail',
    component: LoginDetail
  },
  {
    path: '/credit-cards/create',
    name: 'CreditCardCreate',
    component: CreditCardCreate
  },
  {
    path: '/credit-cards/:id',
    name: 'CreditCardDetail',
    component: CreditCardDetail
  },
  {
    path: '/emails/create',
    name: 'EmailCreate',
    component: EmailCreate
  },
  {
    path: '/emails/:id',
    name: 'EmailDetail',
    component: EmailDetail
  },
  {
    path: '/bank-accounts/create',
    name: 'BankAccountCreate',
    component: BankAccountCreate
  },
  {
    path: '/bank-accounts/:id',
    name: 'BankAccountDetail',
    component: BankAccountDetail
  },
  {
    path: '/notes/create',
    name: 'NoteCreate',
    component: NoteCreate
  },
  {
    path: '/notes/:id',
    name: 'NoteDetail',
    component: NoteDetail
  },
  {
    path: '/servers/create',
    name: 'ServerCreate',
    component: ServerCreate
  },
  {
    path: '/servers/:id',
    name: 'ServerDetail',
    component: ServerDetail
  },
  {
    path: '/password-generator',
    name: 'Generator',
    component: Generator
  },
  {
    path: '/Inject/savePassword',
    name: 'SavePassword',
    component: SavePassword
  },
  {
    path: '/Inject/loginAsPopup',
    name: 'LoginAsPopup',
    component: LoginAsPopup
  },
  // Vue Router 4: wildcard route updated syntax
  {
    path: '/:pathMatch(.*)*',
    redirect: '/login'
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// After navigation hooks
router.afterEach((to, from) => {
  Storage.setItem('latest_route', to.name)
  Storage.setItem('latest_route_param_detail', to.params.detail || null)
  Storage.setItem('create_form', null)
})

router.afterEach((to, from) => {
  const toDepth = to.path.split('/').length
  const fromDepth = from.path.split('/').length
  to.meta.transitionName = toDepth < fromDepth ? 'slide-right' : 'slide-left'
})

router.afterEach(ClearSearch)

// Before navigation hooks
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
    if (lastRouteName.search('Detail') > -1 && detail && detail.id) {
      next({ name: lastRouteName, params: { detail, id: detail.id } })
    } else if (lastRouteName.search('Detail') === -1) {
      next({ name: lastRouteName })
    } else {
      next()
    }
  } else {
    next()
  }

  isFirstTransition = false
})

export default router

