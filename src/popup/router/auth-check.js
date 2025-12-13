import Storage from '@/utils/storage'

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
