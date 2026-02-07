/**
 * Items Store - Organization-Based Vault Items
 *
 * All vault item types:
 * - Password (Passwords)
 * - Secure Notes
 * - Credit Cards
 * - Bank Accounts
 * - Identity
 *
 * Encryption: Organization Key (from org keys store, unwrapped with User Key)
 *
 * Items are stored per-organization. When fetching, we aggregate
 * items from all organizations the user has access to.
 */

import { defineStore } from 'pinia'
import { cryptoService, encryptWithOrgKey, decryptWithOrgKey } from '@/utils/crypto'
import { useAuthStore } from './auth'
import { useOrgKeysStore } from './orgKeys'
import OrganizationsService from '@/api/services/Organizations'
import { buildPasswordItemDataFromForm, normalizePasswordItemData } from '@/utils/schema'

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
    title: item.metadata?.name || normalizedData?.name || '',
    url: item.metadata?.uri_hint || normalizedData?.uris?.[0]?.uri || ''
  }
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
    // ============================================================
    // Backward-compatible helpers for popup form
    // ============================================================

    /**
     * Create a Password item from legacy popup form shape
     */
    async create(form = {}) {
      const title = form.title || form.name || 'Untitled'
      const url = form.url || ''
      const uriHint = safeHostName(url)
      const passwordData = buildPasswordItemDataFromForm(form, url)
      const metadata = { name: title, uri_hint: uriHint }

      return await this.encryptAndCreate(ItemType.Password, passwordData, metadata, {
        auto_fill: true,
        auto_login: false
      })
    },

    /**
     * Update a Password item from legacy popup form shape
     */
    async update(form = {}) {
      const id = form.id
      if (!id) throw new Error('Item id is required')

      const title = form.title || form.name || 'Untitled'
      const url = form.url || ''
      const uriHint = safeHostName(url)
      const passwordData = buildPasswordItemDataFromForm(form, url)

      return await this.updateItem(id, {
        data: passwordData,
        metadata: { name: title, uri_hint: uriHint }
      })
    },

    // ============================================================
    // Org Key Resolution
    // ============================================================

    /**
     * Resolve the org key for a given org ID.
     * @param {number} orgId
     * @returns {Promise<SymmetricKey>}
     */
    async _resolveOrgKey(orgId) {
      const authStore = useAuthStore()
      const orgKeysStore = useOrgKeysStore()

      if (!authStore.userKey) {
        throw new Error('USER_KEY_MISSING')
      }

      const org = authStore.organizations.find((o) => o.id === orgId)
      if (!org?.encrypted_org_key) {
        throw new Error(`No encrypted org key found for organization ${orgId}`)
      }

      return await orgKeysStore.getOrLoadOrgKey(orgId, org.encrypted_org_key, authStore.userKey)
    },

    /**
     * Get the default org ID.
     * @returns {number}
     */
    _getDefaultOrgId() {
      const authStore = useAuthStore()
      if (authStore.defaultOrgId) return authStore.defaultOrgId
      const defaultOrg = authStore.defaultOrganization
      if (defaultOrg?.id) return defaultOrg.id
      throw new Error('No organization available. Please log in again.')
    },

    // ============================================================
    // Fetch Items from All Organizations
    // ============================================================

    /**
     * Fetch items from ALL organizations the user has access to.
     */
    async fetchItems(filter = {}) {
      this.isLoading = true
      this.error = null

      try {
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

        let organizations = authStore.organizations
        if (!organizations || organizations.length === 0) {
          await authStore.fetchOrganizations()
          organizations = authStore.organizations
          if (!organizations || organizations.length === 0) {
            this.items = filter.type
              ? this.items.filter((item) => item.item_type !== filter.type)
              : []
            this.isLoading = false
            return
          }
        }

        // Build filter params for org items API
        const params = {}
        if (filter.type) params.type = filter.type
        if (filter.is_favorite !== undefined) params.is_favorite = filter.is_favorite
        if (filter.folder_id) params.folder_id = filter.folder_id
        if (filter.search) params.search = filter.search
        if (filter.auto_fill !== undefined) params.auto_fill = filter.auto_fill
        if (filter.auto_login !== undefined) params.auto_login = filter.auto_login
        if (filter.page) params.page = filter.page
        params.per_page = filter.per_page || 5000

        // Fetch from all organizations in parallel
        const orgFetchPromises = organizations.map(async (org) => {
          try {
            const { data } = await OrganizationsService.ListItems(org.id, params)
            const items = data.items || data || []

            let orgKey
            try {
              orgKey = await this._resolveOrgKey(org.id)
            } catch {
              return items.map((item) => ({
                ...item,
                _orgId: org.id,
                _orgName: org.name,
                title: item.metadata?.name || '[Encrypted]',
                url: item.metadata?.uri_hint || '',
                username: '[Encrypted]',
                password: '[Encrypted]'
              }))
            }

            return await Promise.all(
              items.map(async (item) => {
                try {
                  const decryptedData = await decryptWithOrgKey(item.data, orgKey)
                  const normalizedData =
                    item.item_type === ItemType.Password
                      ? normalizePasswordItemData(decryptedData || {})
                      : decryptedData

                  return {
                    ...item,
                    ...normalizedData,
                    _orgId: org.id,
                    _orgName: org.name,
                    title: item.metadata?.name || normalizedData?.name || '',
                    url: item.metadata?.uri_hint || normalizedData?.uris?.[0]?.uri || ''
                  }
                } catch {
                  return {
                    ...item,
                    _orgId: org.id,
                    _orgName: org.name,
                    title: item.metadata?.name || '[Decryption Failed]',
                    url: item.metadata?.uri_hint || '',
                    username: '[Encrypted]',
                    password: '[Encrypted]'
                  }
                }
              })
            )
          } catch (error) {
            console.error(`Failed to fetch items from org ${org.id}:`, error.message)
            return []
          }
        })

        const allResults = await Promise.all(orgFetchPromises)
        const decryptedItems = allResults.flat()

        if (filter.type) {
          const otherTypeItems = this.items.filter((item) => item.item_type !== filter.type)
          this.items = [...otherTypeItems, ...decryptedItems]
        } else {
          this.items = decryptedItems
        }

        this.isLoading = false
      } catch (error) {
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

    // ============================================================
    // Create Item (Organization-Based)
    // ============================================================

    /**
     * Create an item in the specified (or default) organization.
     * Data should already be encrypted.
     *
     * @param {Object} req - { item_type, data (EncString), metadata, ... }
     * @param {number} [orgId] - Target org ID (defaults to user's default org)
     * @returns {Promise<Object>}
     */
    async createItem(req, orgId) {
      this.isLoading = true
      this.error = null

      try {
        const targetOrgId = orgId || this._getDefaultOrgId()
        const { data: createdItem } = await OrganizationsService.CreateItem(targetOrgId, req)

        let normalized = createdItem
        try {
          const orgKey = await this._resolveOrgKey(targetOrgId)
          const decryptedData = await decryptWithOrgKey(createdItem.data, orgKey)
          normalized = mergeDecryptedItem(createdItem, decryptedData)
          normalized._orgId = targetOrgId
        } catch {
          normalized = {
            ...createdItem,
            _orgId: targetOrgId,
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

    // ============================================================
    // Update Item (Organization-Based)
    // ============================================================

    /**
     * Update an organization item.
     * If req.data is an object, encrypts it with the org key first.
     */
    async updateItem(id, req) {
      this.isLoading = true
      this.error = null

      try {
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
          const itemOrgId =
            existingItem?._orgId || existingItem?.organization_id || this._getDefaultOrgId()
          const orgKey = await this._resolveOrgKey(itemOrgId)

          const encryptedData = await encryptWithOrgKey(JSON.stringify(req.data), orgKey)
          finalReq = { ...req, data: encryptedData }
        }

        const { data: updatedItem } = await OrganizationsService.UpdateItem(id, finalReq)

        let normalized = updatedItem
        try {
          const existingItem = this.items.find((item) => item.id === id)
          const itemOrgId =
            existingItem?._orgId || updatedItem?.organization_id || this._getDefaultOrgId()
          const orgKey = await this._resolveOrgKey(itemOrgId)
          const decryptedData = await decryptWithOrgKey(updatedItem.data, orgKey)
          normalized = mergeDecryptedItem(updatedItem, decryptedData)
          normalized._orgId = itemOrgId
        } catch {
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

    // ============================================================
    // Delete Item (Organization-Based)
    // ============================================================

    async deleteItem(id) {
      this.isLoading = true
      this.error = null

      try {
        await OrganizationsService.DeleteItem(id)
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

    // ============================================================
    // Decrypt Item (Organization-Based)
    // ============================================================

    /**
     * Decrypt an org item's data using the appropriate org key.
     */
    async decryptItem(item) {
      const orgId = item._orgId || item.organization_id
      if (!orgId) {
        throw new Error('Cannot decrypt item: no organization ID')
      }

      const orgKey = await this._resolveOrgKey(orgId)
      return await decryptWithOrgKey(item.data, orgKey)
    },

    // ============================================================
    // Encrypt & Create (Organization-Based)
    // ============================================================

    /**
     * Encrypt data with org key and create item in default organization.
     */
    async encryptAndCreate(itemType, data, metadata, options = {}, orgId) {
      const authStore = useAuthStore()

      if (!authStore.userKey) {
        console.error('User Key not found. Logging out...')
        await authStore.logout()
        if (window.location.hash !== '#/login') {
          window.location.hash = '#/login'
        }
        throw new Error('Session expired. Please sign in again.')
      }

      const targetOrgId = orgId || this._getDefaultOrgId()
      const orgKey = await this._resolveOrgKey(targetOrgId)
      const encryptedData = await encryptWithOrgKey(JSON.stringify(data), orgKey)

      return await this.createItem(
        {
          item_type: itemType,
          data: encryptedData,
          metadata,
          is_favorite: options.is_favorite ?? false,
          folder_id: options.folder_id,
          reprompt: options.reprompt ?? false,
          auto_fill: options.auto_fill ?? true,
          auto_login: options.auto_login ?? false
        },
        targetOrgId
      )
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
