import Storage from '@/utils/storage'
import SessionStorage, { SESSION_KEYS } from '@/utils/session-storage'

export default async (to, _, next) => {
  // meta.auth: true means "bypass auth check" (for iframes)
  const bypassAuth = to.matched.some(record => record.meta.auth)
  const access_token = await Storage.getItem('access_token')

  // If auth check should be bypassed, just continue
  if (bypassAuth) {
    return next()
  }

  // Normal auth check logic
  if (access_token) {
    // Check if user key exists in extension session storage
    let userKeyBase64 = null
    try {
      userKeyBase64 = await SessionStorage.getItem(SESSION_KEYS.userKey)
    } catch {
      userKeyBase64 = window?.sessionStorage?.getItem?.('userKey') ?? null
    }
    
    // If access token exists but userKey is missing, clear session and redirect to login
    if (!userKeyBase64 && to.name !== 'Login') {
      console.warn('User key missing from session. Clearing session...')
      await Storage.clear()
      // Clear only our session keys; don't nuke unrelated session storage.
      try {
        await SessionStorage.removeItems([SESSION_KEYS.userKey, SESSION_KEYS.masterKey])
      } catch {
        window?.sessionStorage?.removeItem?.('userKey')
        window?.sessionStorage?.removeItem?.('masterKey')
      }
      return next({ name: 'Login' })
    }

    // User is logged in, redirect away from login page
    if (to.name === 'Login') {
      return next({ name: 'Home' })
    }
  } else {
    // User not logged in, redirect to login (except for login page itself)
    if (to.name !== 'Login') {
      return next({ name: 'Login' })
    }
  }

  next()
}
