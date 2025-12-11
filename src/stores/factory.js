import { defineStore } from 'pinia'
import CryptoUtils from '@/utils/crypto'

/**
 * Factory function to create Pinia stores for different data types
 * Reduces code duplication across store modules
 */
export function createDataStore(name, service, encryptedFields = []) {
  return defineStore(name, {
    state: () => ({
      itemList: [],
      detail: {}
    }),

    getters: {
      items: (state) => state.itemList,
      itemById: (state) => (id) => state.itemList.find(item => item.id === id)
    },

    actions: {
      async fetchAll(query) {
        const { data: itemList } = await service.FetchAll(query)
        
        if (encryptedFields.length > 0) {
          itemList.forEach(element => {
            CryptoUtils.decryptFields(element, encryptedFields)
          })
        }
        
        this.itemList = itemList
        return itemList
      },

      async get(id) {
        const { data } = await service.Get(id)
        
        if (encryptedFields.length > 0) {
          CryptoUtils.decryptFields(data, encryptedFields)
        }
        
        this.detail = data
        return data
      },

      async create(data) {
        let payload = { ...data }
        
        if (encryptedFields.length > 0) {
          payload = CryptoUtils.encryptPayload(payload, encryptedFields)
        }
        
        return service.Create(payload)
      },

      async update(data) {
        let payload = { ...data }

        if (encryptedFields.length > 0) {
          payload = CryptoUtils.encryptPayload(payload, encryptedFields)
        }

        const response = await service.Update(data.id, payload)
        const updated = response?.data ? { ...data, ...response.data } : { ...data }

        if (encryptedFields.length > 0) {
          try {
            CryptoUtils.decryptFields(updated, encryptedFields)
          } catch (_) {}
        }

        const idx = this.itemList.findIndex(item => item.id === updated.id)
        if (idx !== -1) {
          this.itemList[idx] = { ...this.itemList[idx], ...updated }
        }
        this.detail = { ...updated }

        return updated
      },

      async delete(id) {
        return service.Delete(id)
      },

      setDetail(data) {
        this.detail = data
      },

      clearDetail() {
        this.detail = {}
      }
    }
  })
}

