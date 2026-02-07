import { defineStore } from 'pinia'
import { unwrapOrgKeyWithUserKey } from '@/utils/crypto'

/**
 * Organization Keys Store
 * Manages decrypted organization encryption keys in session memory.
 * Keys are never persisted to disk — they live only in memory.
 */
export const useOrgKeysStore = defineStore('orgKeys', {
  state: () => ({
    /** @type {Map<number, { orgKey: SymmetricKey, encryptedOrgKey: string }>} */
    _keys: new Map()
  }),

  getters: {
    /**
     * Get a cached org key by org ID
     * @returns {function(number): SymmetricKey|null}
     */
    getOrgKey: (state) => (orgId) => {
      const entry = state._keys.get(orgId)
      return entry?.orgKey || null
    },

    /**
     * Check if an org key is cached
     * @returns {function(number): boolean}
     */
    hasOrgKey: (state) => (orgId) => {
      return state._keys.has(orgId)
    }
  },

  actions: {
    /**
     * Cache a decrypted org key
     * @param {number} orgId
     * @param {SymmetricKey} orgKey - Decrypted org key
     * @param {string} encryptedOrgKey - EncString from server
     */
    setOrgKey(orgId, orgKey, encryptedOrgKey) {
      this._keys.set(orgId, { orgKey, encryptedOrgKey })
    },

    /**
     * Remove a specific org key from cache
     * @param {number} orgId
     */
    removeOrgKey(orgId) {
      this._keys.delete(orgId)
    },

    /**
     * Clear all cached org keys (e.g. on logout)
     */
    clearAll() {
      this._keys.clear()
    },

    /**
     * Get or load an organization key.
     * Tries cache first, then decrypts from encryptedOrgKey using userKey.
     *
     * @param {number} orgId
     * @param {string} encryptedOrgKey - EncString from server
     * @param {SymmetricKey} userKey - User's symmetric key
     * @returns {Promise<SymmetricKey>}
     */
    async getOrLoadOrgKey(orgId, encryptedOrgKey, userKey) {
      const cached = this._keys.get(orgId)
      if (cached?.orgKey) {
        return cached.orgKey
      }

      const orgKey = await unwrapOrgKeyWithUserKey(encryptedOrgKey, userKey)
      this._keys.set(orgId, { orgKey, encryptedOrgKey })
      return orgKey
    }
  }
})
