import HTTPClient from '@/api/HTTPClient'

export default class AuthService {
  /**
   * PreLogin - Get user's KDF configuration
   * Required before login to derive correct Master Key
   *
   * @param {string} email - User's email
   * @returns {Promise} Response with kdf_type, kdf_iterations, kdf_salt
   */
  static async PreLogin(email) {
    return HTTPClient.get(`/auth/prelogin?email=${encodeURIComponent(email)}`)
  }

  /**
   * SignIn - Zero-knowledge authentication
   *
   * @param {Object} payload
   * @param {string} payload.email - User's email
   * @param {string} payload.master_password_hash - HKDF(masterKey, "auth") base64
   * @param {string} [payload.device_id] - Stable device/app identifier (uuid)
   * @param {string} [payload.app] - Client type: vault|extension|mobile|desktop
   * @returns {Promise} Response with tokens and protected_user_key
   */
  static async SignIn(payload) {
    return HTTPClient.post(`/auth/signin`, payload)
  }

  /**
   * SignUp - Zero-knowledge registration
   *
   * @param {Object} payload
   * @param {string} payload.email - User's email
   * @param {string} payload.name - User's name
   * @param {string} payload.master_password_hash - HKDF(masterKey, "auth") base64
   * @param {string} payload.protected_user_key - EncString "2.iv|ct|mac"
   * @param {string} payload.kdf_salt - Random hex string (64 chars)
   * @param {Object} payload.kdf_config - KDF configuration
   * @returns {Promise} Response with user data
   */
  static async SignUp(payload) {
    return HTTPClient.post(`/auth/signup`, payload)
  }

  /**
   * Login - Legacy method (backward compatibility)
   * @deprecated Use SignIn instead
   */
  static async Login(payload) {
    return this.SignIn(payload)
  }

  /**
   * Check - Verify authentication status
   */
  static async Check(payload) {
    return HTTPClient.post('/auth/check', payload)
  }

  /**
   * Refresh access token
   */
  static async Refresh(payload) {
    return HTTPClient.post(`/auth/refresh`, payload)
  }

  /**
   * Change Master Password
   *
   * @param {Object} payload
   * @param {string} payload.new_master_password_hash - New auth key
   * @param {string} payload.new_protected_user_key - Re-wrapped user key
   * @param {string} payload.new_kdf_salt - Optional: new salt
   * @returns {Promise}
   */
  static async ChangeMasterPassword(payload) {
    return HTTPClient.post(`/api/users/change-master-password`, payload)
  }
}
