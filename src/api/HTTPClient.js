import Axios from 'axios'
import browser from 'webextension-polyfill'
import Storage from '@/utils/storage'
import ENV_CONFIG from '@/config/env'

// Security: Whitelist of allowed API domains (from centralized config)
const ALLOWED_API_DOMAINS = ENV_CONFIG.ALLOWED_API_DOMAINS

// Security: Whitelist of allowed ports (from centralized config)
const ALLOWED_PORTS = ENV_CONFIG.ALLOWED_PORTS

let baseURL = 'https://vault.passwall.io'

const client = Axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    Accept: 'application/json, text/plain, */*'
  }
})

// Track if refresh is in progress to avoid multiple simultaneous refreshes
let isRefreshing = false
let failedQueue = []

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
        // Token expired, attempting automatic refresh

        // Get refresh token from storage
        const refresh_token = await Storage.getItem('refresh_token')

        if (!refresh_token) {
          throw new Error('No refresh token available')
        }

        // Call refresh endpoint directly to avoid circular import
        const { data } = await client.post('/auth/refresh', { refresh_token })

        // Update tokens in storage
        await Promise.all([
          Storage.setItem('access_token', data.access_token),
          Storage.setItem('refresh_token', data.refresh_token)
        ])

        // Update authorization header
        const newToken = data.access_token
        client.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`

        // Token refreshed successfully, retrying original request

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
          .catch(() => {
            // Background script might not be ready
          })

        // Process queued requests
        processQueue(null, newToken)

        isRefreshing = false

        // Retry the original request with new token
        return client(originalRequest)
      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError)

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
          console.error('Failed to clear auth state:', err)
        }

        return Promise.reject(refreshError)
      }
    }

    // Handle 403 Forbidden (insufficient permissions)
    if (status === 403) {
      console.warn('🔐 Access forbidden (403)')
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
      console.log('✅ API endpoint validated and set:', hostname)
    } catch (error) {
      console.error('❌ Invalid API endpoint:', error.message)
      throw error
    }
  }
}
