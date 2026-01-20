import Storage from '@/utils/storage'
import SessionStorage, { SESSION_KEYS } from '@/utils/session-storage'
import { PIN_STORAGE_KEYS } from '@/utils/pin-storage'

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
    if (SessionStorage.isSupported()) {
      try {
        userKeyBase64 = await SessionStorage.getItem(SESSION_KEYS.userKey)
      } catch {
        // ignore, fallback below
      }
    }

    // Fallback / migration path: older builds may have used window.sessionStorage
    if (!userKeyBase64) {
      userKeyBase64 = window?.sessionStorage?.getItem?.('userKey') ?? null
    }
    
    // If access token exists but userKey is missing, check PIN unlock first
    if (!userKeyBase64) {
      const pinProtected = await Storage.getItem(PIN_STORAGE_KEYS.protectedUserKey)

      if (pinProtected) {
        if (to.name !== 'Unlock') {
          return next({ name: 'Unlock' })
        }
      } else if (to.name !== 'Login') {
        console.warn('User key missing from session. Clearing session...')
        await Storage.clear()
        // Clear only our session keys; don't nuke unrelated session storage.
        if (SessionStorage.isSupported()) {
          try {
            await SessionStorage.removeItems([SESSION_KEYS.userKey, SESSION_KEYS.masterKey])
          } catch {
            // ignore, fallback below
          }
        }
        window?.sessionStorage?.removeItem?.('userKey')
        window?.sessionStorage?.removeItem?.('masterKey')
        return next({ name: 'Login' })
      }
    }

    // User is logged in, redirect away from login page
    if (userKeyBase64 && (to.name === 'Login' || to.name === 'Unlock')) {
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
