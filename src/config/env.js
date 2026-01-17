/**
 * Environment Configuration
 * Centralized config for development/production settings
 * Uses Vite environment variables
 */

// Parse comma-separated string to array
const parseArray = (str) => {
  return str ? str.split(',').map((s) => s.trim()) : []
}

// Parse comma-separated string to number array
const parseNumberArray = (str) => {
  return str
    ? str
        .split(',')
        .map((s) => parseInt(s.trim()))
        .filter((n) => !isNaN(n))
    : []
}

// ========================================
// DEVELOPMENT CONFIG (Edit this section for local dev)
// ========================================
const DEV_CONFIG = {
  ENABLED: import.meta.env.MODE === 'development', // ✅ Automatically set: dev=true, prod=false

  // Development settings
  DEV_MODE: true,
  SHOW_SERVER_URL: true,
  ALLOWED_DOMAINS: ['vault.passwall.io', 'api.passwall.io', 'localhost'],
  ALLOWED_PORTS: [80, 443, 3625],

  // Auto-login credentials (ONLY for development!)
  SERVER_URL: 'http://localhost:3625',
  EMAIL: 'admin@passwall.io',
  PASSWORD: '123456Pw.'
}
// ========================================

export const ENV_CONFIG = {
  // Use DEV_CONFIG if enabled, otherwise use env vars
  DEV_MODE: DEV_CONFIG.ENABLED ? DEV_CONFIG.DEV_MODE : import.meta.env.VITE_DEV_MODE === 'true',
  SHOW_SERVER_URL: DEV_CONFIG.ENABLED
    ? DEV_CONFIG.SHOW_SERVER_URL
    : import.meta.env.VITE_SHOW_SERVER_URL === 'true',

  ALLOWED_API_DOMAINS: DEV_CONFIG.ENABLED
    ? DEV_CONFIG.ALLOWED_DOMAINS
    : parseArray(import.meta.env.VITE_ALLOWED_API_DOMAINS || 'vault.passwall.io,api.passwall.io'),
  ALLOWED_PORTS: DEV_CONFIG.ENABLED
    ? DEV_CONFIG.ALLOWED_PORTS
    : parseNumberArray(import.meta.env.VITE_ALLOWED_PORTS || '443'),

  DEV_SERVER_URL: DEV_CONFIG.ENABLED
    ? DEV_CONFIG.SERVER_URL
    : import.meta.env.VITE_DEV_SERVER_URL || 'https://api.passwall.io',
  DEV_EMAIL: DEV_CONFIG.ENABLED ? DEV_CONFIG.EMAIL : import.meta.env.VITE_DEV_EMAIL || '',
  DEV_PASSWORD: DEV_CONFIG.ENABLED ? DEV_CONFIG.PASSWORD : import.meta.env.VITE_DEV_PASSWORD || '',

  MODE: import.meta.env.MODE,
  IS_PRODUCTION: import.meta.env.PROD,
  IS_DEVELOPMENT: import.meta.env.DEV
}

// Debug: Always log env values during development
console.log('🔍 Raw import.meta.env:', {
  VITE_ALLOWED_API_DOMAINS: import.meta.env.VITE_ALLOWED_API_DOMAINS,
  VITE_ALLOWED_PORTS: import.meta.env.VITE_ALLOWED_PORTS,
  VITE_DEV_MODE: import.meta.env.VITE_DEV_MODE,
  MODE: import.meta.env.MODE
})

// Log config on startup (development only)
if (ENV_CONFIG.DEV_MODE) {
  console.log('🔧 Environment Config:', {
    mode: ENV_CONFIG.MODE,
    devMode: ENV_CONFIG.DEV_MODE,
    showServerUrl: ENV_CONFIG.SHOW_SERVER_URL,
    allowedDomains: ENV_CONFIG.ALLOWED_API_DOMAINS,
    allowedPorts: ENV_CONFIG.ALLOWED_PORTS
  })
}

export default ENV_CONFIG
