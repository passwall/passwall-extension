import { createRouter, createWebHashHistory } from 'vue-router'
import AuthCheck from './auth-check'
import ClearSearch from '@p/router/clear-search'
import Storage from '@/utils/storage'

// Static imports for browser extension (dynamic imports don't work well with CSP)
import Login from '@p/views/Auth/Login.vue'
import Home from '@p/views/Home/index.vue'
import Passwords from '@p/views/Passwords/index.vue'
import Notes from '@p/views/Notes/index.vue'
import Addresses from '@p/views/Addresses/index.vue'
import PaymentCards from '@p/views/PaymentCards/index.vue'
import BankAccounts from '@p/views/BankAccounts/index.vue'
import ChangeMasterPassword from '@p/views/ChangeMasterPassword/index.vue'
import PasswordCreate from '@p/views/Passwords/create.vue'
import PasswordDetail from '@p/views/Passwords/detail.vue'
import NoteCreate from '@p/views/Notes/create.vue'
import NoteDetail from '@p/views/Notes/detail.vue'
import AddressCreate from '@p/views/Addresses/create.vue'
import AddressDetail from '@p/views/Addresses/detail.vue'
import PaymentCardCreate from '@p/views/PaymentCards/create.vue'
import PaymentCardDetail from '@p/views/PaymentCards/detail.vue'
import BankAccountCreate from '@p/views/BankAccounts/create.vue'
import BankAccountDetail from '@p/views/BankAccounts/detail.vue'
import Generator from '@p/views/Generator/index.vue'
import About from '@p/views/About/index.vue'
import SavePassword from '@p/views/Inject/SavePassword/index.vue'
import LoginAsPopup from '@p/views/Inject/LoginAs/index.vue'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/home',
    name: 'Home',
    redirect: '/passwords',
    component: Home,
    children: [
      {
        path: '/passwords',
        name: 'Passwords',
        component: Passwords
      },
      {
        path: '/notes',
        name: 'Notes',
        component: Notes
      },
      {
        path: '/addresses',
        name: 'Addresses',
        component: Addresses
      },
      {
        path: '/cards',
        name: 'PaymentCards',
        component: PaymentCards
      },
      {
        path: '/bank-accounts',
        name: 'BankAccounts',
        component: BankAccounts
      }
    ]
  },
  {
    path: '/change-master-password',
    name: 'ChangeMasterPassword',
    component: ChangeMasterPassword
  },
  {
    path: '/passwords/create',
    name: 'PasswordCreate',
    component: PasswordCreate
  },
  {
    path: '/passwords/:id',
    name: 'PasswordDetail',
    component: PasswordDetail
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
    path: '/addresses/create',
    name: 'AddressCreate',
    component: AddressCreate
  },
  {
    path: '/addresses/:id',
    name: 'AddressDetail',
    component: AddressDetail
  },
  {
    path: '/cards/create',
    name: 'PaymentCardCreate',
    component: PaymentCardCreate
  },
  {
    path: '/cards/:id',
    name: 'PaymentCardDetail',
    component: PaymentCardDetail
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
    path: '/password-generator',
    name: 'Generator',
    component: Generator
  },
  {
    path: '/about',
    name: 'About',
    component: About
  },
  {
    path: '/Inject/savePassword',
    name: 'SavePassword',
    component: SavePassword,
    meta: { auth: true } // Bypass auth check for iframe injection
  },
  {
    path: '/Inject/loginAsPopup',
    name: 'LoginAsPopup',
    component: LoginAsPopup,
    meta: { auth: true } // Bypass auth check for iframe injection
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
    to.name === 'Passwords' &&
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

