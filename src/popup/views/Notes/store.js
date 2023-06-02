import NotesService from '@/api/services/Notes'
import CryptoUtils from '@/utils/crypto'

const EncryptedFields = ['note']

export default {
  namespaced: true,

  state() {
    return {
      ItemList: [],
      Detail: {}
    }
  },

  actions: {
    async FetchAll({ state }, query) {
      const { data: itemList } = await NotesService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFields(element, EncryptedFields)
      })
      state.ItemList = itemList
    },

    Delete(_, id) {
      return NotesService.Delete(id)
    },

    Create(_, data) {
      const payload = CryptoUtils.encryptPayload(data, EncryptedFields)
      return NotesService.Create(payload)
    },

    Update(_, data) {
      const payload = CryptoUtils.encryptPayload(data, EncryptedFields)
      return NotesService.Update(data.id, payload)
    }
  }
}
