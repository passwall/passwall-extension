import { useAuthStore } from '@/stores/auth'

const TAB_ROUTES = new Set(['Passwords', 'Notes', 'Addresses', 'PaymentCards', 'BankAccounts'])

/**
 * Clear the global search box when user switches between main tabs.
 * - Keeps initial "auto-fill domain" on first app open (from.name is empty then).
 * - Only clears when navigating tab -> tab (e.g. Passwords -> Notes).
 */
export default (to, from) => {
  // Only clear on tab switches
  const toName = to?.name
  const fromName = from?.name

  if (!TAB_ROUTES.has(toName) || !TAB_ROUTES.has(fromName)) return
  if (toName === fromName) return

  const authStore = useAuthStore()
  authStore.searchQuery = ''
}
