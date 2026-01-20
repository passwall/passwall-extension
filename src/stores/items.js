/**
 * Items Store - Unified Vault Items
 *
 * All vault item types:
 * - Password (Passwords)
 * - Secure Notes
 * - Credit Cards
 * - Bank Accounts
 * - Identity
 *
 * Encryption: User Key (from auth store)
 */

import { defineStore } from 'pinia'
import { cryptoService, SymmetricKey } from '@/utils/crypto'
import { useAuthStore } from './auth'
import HTTPClient from '@/api/HTTPClient'
import {
  buildPasswordItemDataFromForm,
  normalizePasswordItemData
} from '@/utils/schema'

// ============================================================
// Types & Constants
// ============================================================

export const ItemType = {
  Password: 1,
  Note: 2,
  Card: 3,
  Bank: 4,
  Identity: 7,
  SSHKey: 8,
  Address: 9,
  Custom: 99
}

// ============================================================
// Helper Functions
// ============================================================

function getApiErrorMessage(error, fallback) {
  return error.response?.data?.error || error.message || fallback
}

function isNetworkOrTimeoutError(error) {
  // Axios "network error": no HTTP response (offline / DNS / CORS / etc.)
  // Axios timeout: code === 'ECONNABORTED'
  if (!error) return false
  if (!error.response) return true
  return error.code === 'ECONNABORTED'
}

async function forceReLogin(authStore) {
  try {
    await authStore.logout()
  } finally {
    // Hash routing (popup) – force navigate to login even if UI is mid-render.
    if (window.location.hash !== '#/login') {
      window.location.hash = '#/login'
    }
  }
}

function safeHostName(url) {
  if (!url) return ''
  try {
    const parsed = url.includes('://') ? new URL(url) : new URL(`https://${url}`)
    return parsed.hostname || ''
  } catch {
    return ''
  }
}

function mergeDecryptedItem(item, decryptedData) {
  const normalizedData =
    item.item_type === ItemType.Password
      ? normalizePasswordItemData(decryptedData || {})
      : decryptedData
  return {
    ...item,
    ...normalizedData,
    // Flatten for component compatibility
    title: item.metadata?.name || normalizedData?.name || '',
    url: item.metadata?.uri_hint || normalizedData?.uris?.[0]?.uri || ''
  }
}

function generateItemKey() {
  const randomBytes = crypto.getRandomValues(new Uint8Array(64))
  return new SymmetricKey(randomBytes.slice(0, 32), randomBytes.slice(32, 64))
}

async function wrapItemKeyWithUserKey(itemKey, userKey) {
  return await cryptoService.encryptAesCbcHmac(itemKey.toBytes(), userKey)
}

async function unwrapItemKeyWithUserKey(itemKeyEnc, userKey) {
  const itemKeyBytes = await cryptoService.decryptAesCbcHmac(itemKeyEnc, userKey)
  return SymmetricKey.fromBytes(itemKeyBytes)
}

/**
 * Get item type display name
 */
export function getItemTypeName(type) {
  switch (type) {
    case ItemType.Password:
      return 'Password'
    case ItemType.Note:
      return 'Secure Note'
    case ItemType.Card:
      return 'Credit Card'
    case ItemType.Bank:
      return 'Bank Account'
    case ItemType.Identity:
      return 'Identity'
    case ItemType.SSHKey:
      return 'SSH Key'
    case ItemType.Address:
      return 'Address'
    case ItemType.Custom:
      return 'Custom'
    default:
      return 'Unknown'
  }
}

/**
 * Get item type icon
 */
export function getItemTypeIcon(type) {
  switch (type) {
    case ItemType.Password:
      return '🔐'
    case ItemType.Note:
      return '📝'
    case ItemType.Card:
      return '💳'
    case ItemType.Bank:
      return '🏦'
    case ItemType.Identity:
      return '👤'
    case ItemType.SSHKey:
      return '🔑'
    case ItemType.Address:
      return '📍'
    case ItemType.Custom:
      return '⚙️'
    default:
      return '❓'
  }
}

// ============================================================
// Store
// ============================================================

export const useItemsStore = defineStore('items', {
  state: () => ({
    items: [],
    isLoading: false,
    error: null,
    detail: {}
  }),

  getters: {
    /**
     * Get items by type
     */
    getItemsByType: (state) => (type) => {
      return state.items.filter((item) => item.item_type === type)
    },

    /**
     * Get item by ID
     */
    getItemById: (state) => (id) => {
      return state.items.find((item) => item.id === id)
    },

    /**
     * Get favorite items
     */
    favoriteItems: (state) => {
      return state.items.filter((item) => item.is_favorite)
    },

    /**
     * Get items by folder
     */
    getItemsByFolder: (state) => (folderId) => {
      return state.items.filter((item) => item.folder_id === folderId)
    },

    /**
     * Count items by type
     */
    getItemCountByType: (state) => (type) => {
      return state.items.filter((item) => item.item_type === type).length
    }
  },

  actions: {
    /**
     * Backward-compatible: create a Password item from legacy popup form shape.
     * NOTE: Prefer using encryptAndCreate directly for new code.
     *
     * @param {Object} form
     * @returns {Promise<Object>}
     */
    async create(form = {}) {
      const title = form.title || form.name || 'Untitled'
      const url = form.url || ''
      const uriHint = safeHostName(url)

      const passwordData = buildPasswordItemDataFromForm(form, url)

      const metadata = {
        name: title,
        uri_hint: uriHint
      }

      return await this.encryptAndCreate(ItemType.Password, passwordData, metadata, {
        auto_fill: true,
        auto_login: false
      })
    },

    /**
     * Backward-compatible: update a Password item from legacy popup form shape.
     * NOTE: Prefer using updateItem directly for new code.
     *
     * @param {Object} form
     * @returns {Promise<Object>}
     */
    async update(form = {}) {
      const id = form.id
      if (!id) {
        throw new Error('Item id is required')
      }

      const title = form.title || form.name || 'Untitled'
      const url = form.url || ''
      const uriHint = safeHostName(url)

      const passwordData = buildPasswordItemDataFromForm(form, url)

      return await this.updateItem(id, {
        data: passwordData,
        metadata: {
          name: title,
          uri_hint: uriHint
        }
      })
    },

    /**
     * Fetch items from server
     *
     * @param {Object} filter - Filter options
     * @param {number} filter.type - Item type
     * @param {boolean} filter.is_favorite - Favorites only
     * @param {number} filter.folder_id - Folder ID
     * @param {string} filter.search - Search query
     * @param {string} filter.tags - Tags (comma-separated)
     * @param {boolean} filter.auto_fill - Auto-fill enabled
     * @param {boolean} filter.auto_login - Auto-login enabled
     * @param {number} filter.page - Page number
     * @param {number} filter.per_page - Items per page
     */
    async fetchItems(filter = {}) {
      this.isLoading = true
      this.error = null

      try {
        // Check user key before fetching items
        const authStore = useAuthStore()
        if (!authStore.userKey) {
          console.error('User Key not found. Logging out...')
          this.isLoading = false
          await authStore.logout()
          if (window.location.hash !== '#/login') {
            window.location.hash = '#/login'
          }
          return
        }

        const params = new URLSearchParams()

        if (filter.type) params.append('type', filter.type.toString())
        if (filter.is_favorite !== undefined)
          params.append('is_favorite', filter.is_favorite.toString())
        if (filter.folder_id) params.append('folder_id', filter.folder_id.toString())
        if (filter.search) params.append('search', filter.search)
        if (filter.tags) params.append('tags', filter.tags)
        if (filter.auto_fill !== undefined) params.append('auto_fill', filter.auto_fill.toString())
        if (filter.auto_login !== undefined)
          params.append('auto_login', filter.auto_login.toString())
        if (filter.page) params.append('page', filter.page.toString())
        if (filter.per_page) params.append('per_page', filter.per_page.toString())

        const { data } = await HTTPClient.get(`/api/items?${params}`)
        const encryptedItems = data.items || data

        // Decrypt all items and merge data with metadata
        const decryptedItems = await Promise.all(
          encryptedItems.map(async (item) => {
            try {
              const decryptedData = await this.decryptItem(item)
              
              // Merge decrypted data with item, flattening for component compatibility
              return {
                ...item,
                ...decryptedData,
                // Map metadata.name to title for backward compatibility
                title: item.metadata?.name || decryptedData.name,
                url: item.metadata?.uri_hint || decryptedData.uris?.[0]?.uri || ''
              }
            } catch (error) {
              // Return item with placeholder data if decryption fails
              // (error already logged in decryptItem)
              return {
                ...item,
                title: item.metadata?.name || '[Decryption Failed]',
                url: item.metadata?.uri_hint || '',
                username: '[Encrypted]',
                password: '[Encrypted]'
              }
            }
          })
        )

        // If filtering by type, merge with existing items of different types
        // Otherwise, replace all items
        if (filter.type) {
          // Remove items of this type and add new ones
          const otherTypeItems = this.items.filter(item => item.item_type !== filter.type)
          this.items = [...otherTypeItems, ...decryptedItems]
        } else {
          this.items = decryptedItems
        }
        
        this.isLoading = false
      } catch (error) {
        // If request failed due to network issues/timeout, the popup can get stuck behind a loader.
        // In that case, force the user back to sign-in (also clears auth state so route guard won't bounce).
        if (isNetworkOrTimeoutError(error)) {
          const authStore = useAuthStore()
          this.isLoading = false
          this.error = getApiErrorMessage(error, 'Network error')
          await forceReLogin(authStore)
          return
        }

        this.error = getApiErrorMessage(error, 'Failed to fetch items')
        this.isLoading = false
        throw error
      }
    },

    /**
     * Create item (accepts already encrypted data)
     *
     * @param {Object} req - Create request
     * @param {number} req.item_type - Item type
     * @param {string} req.data - Encrypted data (EncString)
     * @param {Object} req.metadata - Item metadata
     * @param {boolean} req.is_favorite - Favorite flag
     * @param {number} req.folder_id - Folder ID
     * @param {boolean} req.reprompt - Reprompt flag
     * @param {boolean} req.auto_fill - Auto-fill flag
     * @param {boolean} req.auto_login - Auto-login flag
     */
    async createItem(req) {
      this.isLoading = true
      this.error = null

      try {
        const { data: createdItem } = await HTTPClient.post('/api/items', req)

        // Normalize: decrypt and flatten so list pages don't crash on missing fields
        let normalized = createdItem
        try {
          const decryptedData = await this.decryptItem(createdItem)
          normalized = mergeDecryptedItem(createdItem, decryptedData)
        } catch (error) {
          normalized = {
            ...createdItem,
            title: createdItem.metadata?.name || '[Encrypted]',
            url: createdItem.metadata?.uri_hint || ''
          }
        }

        this.items = [normalized, ...this.items]
        this.isLoading = false

        return normalized
      } catch (error) {
        this.error = getApiErrorMessage(error, 'Failed to create item')
        this.isLoading = false
        throw error
      }
    },

    /**
     * Update item (encrypts if data is provided as object)
     *
     * @param {number} id - Item ID
     * @param {Object} req - Update request
     */
    async updateItem(id, req) {
      this.isLoading = true
      this.error = null

      try {
        // If req.data is an object (not encrypted string), encrypt it first
        let finalReq = req
        if (req.data && typeof req.data === 'object') {
          const authStore = useAuthStore()
          if (!authStore.userKey) {
            console.error('User Key not found. Logging out...')
            this.isLoading = false
            await authStore.logout()
            if (window.location.hash !== '#/login') {
              window.location.hash = '#/login'
            }
            throw new Error('Session expired. Please sign in again.')
          }

          const existingItem = this.items.find((item) => item.id === id)
          let itemKeyEnc =
            req.item_key_enc ||
            (typeof existingItem?.item_key_enc === 'string'
              ? existingItem?.item_key_enc
              : undefined)

          let itemKey
          if (itemKeyEnc) {
            itemKey = await unwrapItemKeyWithUserKey(itemKeyEnc, authStore.userKey)
          } else {
            itemKey = generateItemKey()
            itemKeyEnc = await wrapItemKeyWithUserKey(itemKey, authStore.userKey)
          }

          const encryptedData = await cryptoService.encryptAesCbcHmac(
            JSON.stringify(req.data),
            itemKey
          )

          finalReq = {
            ...req,
            data: encryptedData,
            item_key_enc: itemKeyEnc
          }
        }

        const { data: updatedItem } = await HTTPClient.put(`/api/items/${id}`, finalReq)

        // Normalize: decrypt and flatten so detail/list views remain compatible
        let normalized = updatedItem
        try {
          const decryptedData = await this.decryptItem(updatedItem)
          normalized = mergeDecryptedItem(updatedItem, decryptedData)
        } catch (error) {
          normalized = {
            ...updatedItem,
            title: updatedItem.metadata?.name || '[Encrypted]',
            url: updatedItem.metadata?.uri_hint || ''
          }
        }

        this.items = this.items.map((item) => (item.id === id ? normalized : item))
        this.isLoading = false
        this.detail = normalized

        return normalized
      } catch (error) {
        this.error = getApiErrorMessage(error, 'Failed to update item')
        this.isLoading = false
        throw error
      }
    },

    /**
     * Delete item (soft delete)
     *
     * @param {number} id - Item ID
     */
    async deleteItem(id) {
      this.isLoading = true
      this.error = null

      try {
        await HTTPClient.delete(`/api/items/${id}`)

        this.items = this.items.filter((item) => item.id !== id)
        this.isLoading = false
      } catch (error) {
        this.error = getApiErrorMessage(error, 'Failed to delete item')
        this.isLoading = false
        throw error
      }
    },

    setDetail(data) {
      this.detail = data || {}
    },

    /**
     * Decrypt item data with User Key
     *
     * @param {Object} item - Item to decrypt
     * @returns {Promise<Object>} Decrypted data
     */
    async decryptItem(item) {
      const authStore = useAuthStore()

      if (!authStore.userKey) {
        throw new Error('USER_KEY_MISSING')
      }

      try {
        let decryptionKey = authStore.userKey

        if (item.item_key_enc) {
          decryptionKey = await unwrapItemKeyWithUserKey(
            item.item_key_enc,
            authStore.userKey
          )
        }

        // Decrypt EncString with determined key
        const decryptedBytes = await cryptoService.decryptAesCbcHmac(
          item.data,
          decryptionKey
        )

        // Convert bytes to string
        const decryptedJSON = new TextDecoder().decode(decryptedBytes)

        // Parse JSON
        return JSON.parse(decryptedJSON)
      } catch (error) {
        // Log decryption error but don't logout here (will be handled at higher level if needed)
        console.error('Failed to decrypt item:', item.id, error.message)
        throw error
      }
    },

    /**
     * Helper: Encrypt data and create item
     *
     * @param {number} itemType - Item type
     * @param {Object} data - Data to encrypt
     * @param {Object} metadata - Item metadata
     * @param {Object} options - Additional options
     */
    async encryptAndCreate(itemType, data, metadata, options = {}) {
      const authStore = useAuthStore()

      if (!authStore.userKey) {
        console.error('User Key not found. Logging out...')
        await authStore.logout()
        if (window.location.hash !== '#/login') {
          window.location.hash = '#/login'
        }
        throw new Error('Session expired. Please sign in again.')
      }

      const itemKey = generateItemKey()
      const encryptedData = await cryptoService.encryptAesCbcHmac(
        JSON.stringify(data),
        itemKey
      )
      const itemKeyEnc = await wrapItemKeyWithUserKey(itemKey, authStore.userKey)

      // Create item with encrypted data
      return await this.createItem({
        item_type: itemType,
        data: encryptedData,
        item_key_enc: itemKeyEnc,
        metadata,
        is_favorite: options.is_favorite ?? false,
        folder_id: options.folder_id,
        reprompt: options.reprompt ?? false,
        auto_fill: options.auto_fill ?? true,
        auto_login: options.auto_login ?? false
      })
    },

    /**
     * Toggle favorite status
     *
     * @param {number} id - Item ID
     */
    async toggleFavorite(id) {
      const item = this.getItemById(id)
      if (!item) return

      await this.updateItem(id, {
        is_favorite: !item.is_favorite
      })
    },

    /**
     * Move item to folder
     *
     * @param {number} id - Item ID
     * @param {number} folderId - Folder ID
     */
    async moveToFolder(id, folderId) {
      await this.updateItem(id, {
        folder_id: folderId
      })
    }
  }
})

