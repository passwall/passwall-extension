import Storage from '@/utils/storage'
import SessionStorage, { SESSION_KEYS } from '@/utils/session-storage'
import { PIN_STORAGE_KEYS } from '@/utils/pin-storage'

export default async (to, _, next) => {
  // meta.auth: true means "bypass auth check" (for iframes)
  const bypassAuth = to.matched.some((record) => record.meta.auth)

  // If auth check should be bypassed, just continue
  if (bypassAuth) {
    return next()
  }

  // Gather auth state
  const [access_token, pinProtected] = await Promise.all([
    Storage.getItem('access_token'),
    Storage.getItem(PIN_STORAGE_KEYS.protectedUserKey)
  ])

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

  // Debug logging
  console.log('[AuthCheck]', {
    to: to.name,
    hasAccessToken: !!access_token,
    hasPinProtected: !!pinProtected,
    hasUserKey: !!userKeyBase64
  })

  // Determine if user was previously logged in (has token OR has PIN set up)
  const wasLoggedIn = access_token || pinProtected

  if (wasLoggedIn) {
    // User was logged in - check if session is active (userKey in memory)
    if (!userKeyBase64) {
      // userKey missing from session - need to unlock or re-login
      if (pinProtected && access_token) {
        // PIN is configured AND we have tokens - allow PIN unlock
        // Note: If tokens are cleared (after failed refresh), go to Login instead
        console.log('[AuthCheck] userKey missing, PIN exists, has token -> Unlock')
        // Redirect to Unlock from ANY page (including Login) when PIN+token exist
        if (to.name !== 'Unlock') {
          return next({ name: 'Unlock' })
        }
      } else if (to.name !== 'Login') {
        // No PIN, or no tokens - need full login
        console.log('[AuthCheck] userKey missing, no PIN or no token -> Login')
        // Clear stale tokens but preserve email/server for convenience
        const email = await Storage.getItem('email')
        const server = await Storage.getItem('server')
        // Also preserve PIN data if it exists (for after re-login)
        const pinKeys = ['pin_protected_user_key', 'pin_kdf_salt', 'pin_kdf_iterations']
        const pinData = {}
        for (const key of pinKeys) {
          pinData[key] = await Storage.getItem(key)
        }

        await Storage.clear()

        if (email) await Storage.setItem('email', email)
        if (server) await Storage.setItem('server', server)
        // Restore PIN data
        for (const key of pinKeys) {
          if (pinData[key] != null) {
            await Storage.setItem(key, pinData[key])
          }
        }

        // Clear session keys
        if (SessionStorage.isSupported()) {
          try {
            await SessionStorage.removeItem(SESSION_KEYS.userKey)
          } catch {
            // ignore
          }
        }
        window?.sessionStorage?.removeItem?.('userKey')
        return next({ name: 'Login' })
      }
    } else {
      // User is fully authenticated (has userKey), redirect away from auth pages
      if (to.name === 'Login' || to.name === 'Unlock') {
        console.log('[AuthCheck] Already authenticated -> Home')
        return next({ name: 'Home' })
      }
      console.log('[AuthCheck] Authenticated, proceeding to', to.name)
    }
  } else {
    // User never logged in - redirect to login (except for login page itself)
    console.log('[AuthCheck] Not logged in -> Login')
    if (to.name !== 'Login') {
      return next({ name: 'Login' })
    }
  }

  next()
}
