import { createI18n } from 'vue-i18n'
import en from './langs/en'

export default createI18n({
  legacy: false, // Use Composition API mode (CSP compliant)
  locale: 'en',
  fallbackLocale: 'en',
  globalInjection: true, // Inject $t into all components
  allowComposition: true, // Enable composition API
  // CSP compliant - no runtime compilation
  messages: {
    en
  }
})

