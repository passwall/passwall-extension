import Axios from 'axios'
import browser from 'webextension-polyfill'
import Storage from '@/utils/storage'
import ENV_CONFIG from '@/config/env'
import { toSafeError } from '@/utils/helpers'

// Security: Whitelist of allowed API domains (from centralized config)
const ALLOWED_API_DOMAINS = ENV_CONFIG.ALLOWED_API_DOMAINS

// Security: Whitelist of allowed ports (from centralized config)
const ALLOWED_PORTS = ENV_CONFIG.ALLOWED_PORTS

// Build-time injected dev flag (guarded for tests)
const DEV_MODE = typeof __DEV_MODE__ !== 'undefined' ? __DEV_MODE__ : false
const log = {
  info: (...args) => DEV_MODE && console.log('[HTTP]', ...args),
  warn: (...args) => DEV_MODE && console.warn('[HTTP]', ...args),
  error: (...args) => console.error('[HTTP]', ...args)
}

let baseURL = 'https://api.passwall.io'

const client = Axios.create({
  baseURL,
  // Prevent the popup UI from getting stuck forever on hanging requests.
  // 10s is a reasonable balance for slow networks while still failing fast.
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    Accept: 'application/json, text/plain, */*'
  }
})

// Track if refresh is in progress to avoid multiple simultaneous refreshes
let isRefreshing = false
let failedQueue = []

function tryRedirectToLogin() {
  // HTTPClient is used in background/service-worker contexts too; guard window usage.
  try {
    if (typeof window === 'undefined') return
    if (!window?.location) return

    // Use hash routing (Vue Router createWebHashHistory)
    if (window.location.hash !== '#/login') {
      window.location.hash = '#/login'
    }
  } catch {
    // ignore
  }
}

// Security: Rate Limiter to prevent API abuse
class RateLimiter {
  constructor(maxRequests = 100, timeWindow = 60000) {
    this.requests = []
    this.maxRequests = maxRequests
    this.timeWindow = timeWindow
  }

  checkLimit() {
    const now = Date.now()

    // Remove old requests outside time window
    this.requests = this.requests.filter((time) => now - time < this.timeWindow)

    if (this.requests.length >= this.maxRequests) {
      throw new Error('Rate limit exceeded. Please try again later.')
    }

    this.requests.push(now)
  }
}

const rateLimiter = new RateLimiter(100, 60000) // 100 requests per minute

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })

  failedQueue = []
}

// ============================================================
// Token helpers (JWT exp-based proactive refresh)
// ============================================================

const TOKEN_REFRESH_LEEWAY_MS = 60 * 1000 // refresh if token expires within 60s

function base64UrlDecodeToString(input) {
  // base64url -> base64
  let str = input.replace(/-/g, '+').replace(/_/g, '/')
  // pad
  while (str.length % 4) str += '='
  return atob(str)
}

function getJwtExpMs(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payloadJson = base64UrlDecodeToString(parts[1])
    const payload = JSON.parse(payloadJson)
    if (!payload?.exp) return null
    const expSec = Number(payload.exp)
    if (!Number.isFinite(expSec)) return null
    return expSec * 1000
  } catch {
    return null
  }
}

async function refreshAccessToken() {
  // Get refresh token from storage
  const refresh_token = await Storage.getItem('refresh_token')
  if (!refresh_token) {
    throw new Error('No refresh token available')
  }

  // Call refresh endpoint directly (avoid circular imports)
  let data
  try {
    ;({ data } = await client.post(
      '/auth/refresh',
      { refresh_token },
      { _skipAuthRefresh: true }
    ))
  } catch (err) {
    throw err
  }

  await Promise.all([
    Storage.setItem('access_token', data.access_token),
    Storage.setItem('refresh_token', data.refresh_token)
  ])

  const newToken = data.access_token
  client.defaults.headers.common['Authorization'] = `Bearer ${newToken}`

  // Notify background script to update its auth state
  browser.runtime
    .sendMessage({
      type: 'TOKEN_REFRESHED',
      who: 'api',
      payload: {
        access_token: data.access_token,
        refresh_token: data.refresh_token
      }
    })
    .catch(() => {})

  return newToken
}

async function getValidAccessTokenForRequest() {
  const accessToken = await Storage.getItem('access_token')
  if (!accessToken) return null

  const expMs = getJwtExpMs(accessToken)
  if (!expMs) {
    // Not a JWT or no exp; fall back to 401-based refresh
    return accessToken
  }

  const now = Date.now()
  if (expMs - now > TOKEN_REFRESH_LEEWAY_MS) {
    return accessToken
  }

  // Token is about to expire, refresh proactively (race-safe)
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject })
    })
  }

  isRefreshing = true
  try {
    const newToken = await refreshAccessToken()
    processQueue(null, newToken)
    return newToken
  } catch (err) {
    // Proactive refresh failed (e.g. refresh token expired/invalid) BEFORE any request is sent.
    // Ensure we clear auth state and bring the popup UI back to login.
    try {
      await Storage.removeItem('access_token')
      await Storage.removeItem('refresh_token')
      await Storage.removeItem('master_hash')

      browser.runtime
        .sendMessage({
          type: 'AUTH_ERROR',
          who: 'api',
          payload: { status: 401, reason: 'refresh_failed' }
        })
        .catch(() => {})
    } catch {
      // ignore
    } finally {
      tryRedirectToLogin()
    }

    processQueue(err, null)
    throw err
  } finally {
    isRefreshing = false
  }
}

// Request interceptor to proactively refresh token before 401
client.interceptors.request.use(
  async (config) => {
    // Skip for auth endpoints and for explicit opt-out
    if (
      config?._skipAuthRefresh ||
      config?.url?.includes('/auth/signin') ||
      config?.url?.includes('/auth/refresh')
    ) {
      return config
    }

    const token = await getValidAccessTokenForRequest()
    if (token) {
      config.headers = config.headers || {}
      config.headers['Authorization'] = `Bearer ${token}`
    }

    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor for automatic token refresh and retry
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const status = error.response?.status

    // Handle 401 Unauthorized with automatic token refresh
    if (status === 401 && !originalRequest._retry) {
      // Skip refresh for auth endpoints (login, refresh itself)
      if (
        originalRequest.url?.includes('/auth/signin') ||
        originalRequest.url?.includes('/auth/refresh')
      ) {
        return Promise.reject(error)
      }

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = 'Bearer ' + token
            return client(originalRequest)
          })
          .catch((err) => {
            return Promise.reject(err)
          })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const newToken = await refreshAccessToken()
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`
        processQueue(null, newToken)
        // Retry the original request with new token
        return client(originalRequest)
      } catch (refreshError) {
        log.error('Token refresh failed', toSafeError(refreshError))

        // Process queue with error
        processQueue(refreshError, null)
        isRefreshing = false

        // Clear storage and notify extension to logout
        try {
          await Storage.removeItem('access_token')
          await Storage.removeItem('refresh_token')
          await Storage.removeItem('master_hash')

          browser.runtime
            .sendMessage({
              type: 'AUTH_ERROR',
              who: 'api',
              payload: { status: 401, reason: 'refresh_failed' }
            })
            .catch(() => {
              // Background script might not be ready
            })
        } catch (err) {
          log.error('Failed to clear auth state', toSafeError(err))
        } finally {
          // Ensure UI navigates to login when refresh token is invalid/expired.
          tryRedirectToLogin()
        }

        return Promise.reject(refreshError)
      }
    }

    // Handle 403 Forbidden (insufficient permissions)
    if (status === 403) {
      log.warn('Access forbidden (403)')
      // Don't auto-logout for 403, might be permission issue
    }

    return Promise.reject(error)
  }
)

// client.interceptors.request.use(request => {
//   console.log('Starting Request', JSON.stringify(request, null, 2))
//   return request
// })

export default class HTTPClient {
  static async head(path) {
    rateLimiter.checkLimit()
    return client.head(path)
  }

  static async get(path, params = {}, headers = {}) {
    rateLimiter.checkLimit()
    return client.get(path, {
      params,
      headers
    })
  }

  static async post(path, data = {}, headers = {}, onUploadProgress) {
    rateLimiter.checkLimit()
    return client.post(path, data, {
      headers,
      onUploadProgress
    })
  }

  static async put(path, data = {}, headers = {}) {
    rateLimiter.checkLimit()
    return client.put(path, data, {
      headers
    })
  }

  static async delete(path, data = {}, headers = {}) {
    rateLimiter.checkLimit()
    return client.delete(path, {
      data,
      headers
    })
  }

  static setHeader(key, value) {
    client.defaults.headers.common[key] = value
  }

  static setBaseURL(url) {
    try {
      const urlObj = new URL(url)

      // Security: Validate domain whitelist
      const hostname = urlObj.hostname
      if (!ALLOWED_API_DOMAINS.includes(hostname)) {
        throw new Error(
          `Unauthorized API endpoint: ${hostname}. Only official Passwall servers are allowed.`
        )
      }

      // Security: HTTPS enforcement (except localhost for development)
      if (urlObj.protocol !== 'https:' && hostname !== 'localhost') {
        throw new Error('API endpoint must use HTTPS for security')
      }

      // Security: Port validation (prevent port scanning)
      // Always get the actual port (explicit or default)
      const port = urlObj.port ? parseInt(urlObj.port) : urlObj.protocol === 'https:' ? 443 : 80

      // Check port against whitelist (including default ports)
      if (!ALLOWED_PORTS.includes(port)) {
        throw new Error(
          `Unauthorized port: ${port}. Only standard ports (80, 443, 3625) are allowed.`
        )
      }

      client.defaults.baseURL = url
      log.info('API endpoint validated and set', hostname)
    } catch (error) {
      log.error('Invalid API endpoint', toSafeError(error))
      throw error
    }
  }
}
