import { defineStore } from 'pinia'
import LoginsService from '@/api/services/Logins'
import CryptoUtils from '@/utils/crypto'

const EncryptedFields = ['username', 'password', 'extra']

export const useLoginsStore = defineStore('logins', {
  state: () => ({
    itemList: [],
    detail: {}
  }),

  getters: {
    items: (state) => {
      return state.itemList
    }
  },

  actions: {
    async fetchAll(query) {
      try {
        const response = await LoginsService.FetchAll(query)
        const { data: itemList } = response
        itemList.forEach(element => {
          CryptoUtils.decryptFields(element, EncryptedFields)
        })
        this.itemList = itemList
      } catch (error) {
        throw error
      }
    },

    async delete(id) {
      return LoginsService.Delete(id)
    },

    async create(data) {
      const payload = CryptoUtils.encryptPayload(data, EncryptedFields)
      return LoginsService.Create(payload)
    },

    async update(data) {
      const payload = CryptoUtils.encryptPayload(data, EncryptedFields)
      const response = await LoginsService.Update(data.id, payload)

      // Prefer API response if present, otherwise fallback to submitted data
      const updated = response?.data ? { ...data, ...response.data } : { ...data }

      // Decrypt returned fields if needed
      try {
        CryptoUtils.decryptFields(updated, EncryptedFields)
      } catch (_) {}

      // Update in-memory list
      const idx = this.itemList.findIndex(item => item.id === updated.id)
      if (idx !== -1) {
        this.itemList[idx] = { ...this.itemList[idx], ...updated }
      }

      // Keep detail in sync
      this.detail = { ...updated }

      return updated
    },
    setDetail(data) {
      this.detail = data
    }
  }
})

