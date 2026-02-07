import HTTPClient from '@/api/HTTPClient'

/**
 * Organizations API Service
 * Handles organization management and organization item CRUD
 */
export default class OrganizationsService {
  // ============================================================
  // Organizations
  // ============================================================

  /**
   * Fetch all organizations the current user belongs to
   * Each org includes `encrypted_org_key` (user's wrapped copy)
   * @returns {Promise} Array of organizations
   */
  static async GetAll() {
    return HTTPClient.get('/api/organizations')
  }

  /**
   * Fetch a specific organization by ID
   * @param {number} id
   * @returns {Promise}
   */
  static async GetById(id) {
    return HTTPClient.get(`/api/organizations/${id}`)
  }

  /**
   * Create a new organization
   * @param {Object} payload - { name, billing_email, plan?, encrypted_org_key }
   * @returns {Promise}
   */
  static async Create(payload) {
    return HTTPClient.post('/api/organizations', payload)
  }

  // ============================================================
  // Organization Items
  // ============================================================

  /**
   * List items for a specific organization
   * @param {number} orgId
   * @param {Object} params - Query params (type, per_page, uri_hint, search, etc.)
   * @returns {Promise}
   */
  static async ListItems(orgId, params = {}) {
    const query = new URLSearchParams()
    if (params.type) query.append('type', params.type.toString())
    if (params.per_page) query.append('per_page', params.per_page.toString())
    if (params.page) query.append('page', params.page.toString())
    if (params.search) query.append('search', params.search)
    if (params.is_favorite !== undefined) query.append('is_favorite', params.is_favorite.toString())
    if (params.folder_id) query.append('folder_id', params.folder_id.toString())
    if (params.auto_fill !== undefined) query.append('auto_fill', params.auto_fill.toString())
    if (params.auto_login !== undefined) query.append('auto_login', params.auto_login.toString())
    if (params.collection_id) query.append('collection_id', params.collection_id.toString())
    // Support multiple uri_hint values
    if (Array.isArray(params.uri_hints)) {
      params.uri_hints.forEach((hint) => query.append('uri_hint', hint))
    } else if (params.uri_hint) {
      query.append('uri_hint', params.uri_hint)
    }
    const qs = query.toString()
    return HTTPClient.get(`/api/organizations/${orgId}/items${qs ? '?' + qs : ''}`)
  }

  /**
   * Create an item in an organization
   * @param {number} orgId
   * @param {Object} payload - { item_type, data, metadata, collection_id?, folder_id?, is_favorite?, reprompt? }
   * @returns {Promise}
   */
  static async CreateItem(orgId, payload) {
    return HTTPClient.post(`/api/organizations/${orgId}/items`, payload)
  }

  /**
   * Get a single organization item by ID
   * @param {number} itemId
   * @returns {Promise}
   */
  static async GetItem(itemId) {
    return HTTPClient.get(`/api/org-items/${itemId}`)
  }

  /**
   * Update an organization item
   * @param {number} itemId
   * @param {Object} payload - { data?, metadata?, collection_id?, folder_id?, is_favorite?, reprompt? }
   * @returns {Promise}
   */
  static async UpdateItem(itemId, payload) {
    return HTTPClient.put(`/api/org-items/${itemId}`, payload)
  }

  /**
   * Delete an organization item
   * @param {number} itemId
   * @returns {Promise}
   */
  static async DeleteItem(itemId) {
    return HTTPClient.delete(`/api/org-items/${itemId}`)
  }

  // ============================================================
  // Organization Folders
  // ============================================================

  /**
   * List folders for an organization
   * @param {number} orgId
   * @returns {Promise}
   */
  static async ListFolders(orgId) {
    return HTTPClient.get(`/api/organizations/${orgId}/folders`)
  }

  /**
   * Create a folder in an organization
   * @param {number} orgId
   * @param {Object} payload - { name }
   * @returns {Promise}
   */
  static async CreateFolder(orgId, payload) {
    return HTTPClient.post(`/api/organizations/${orgId}/folders`, payload)
  }
}
