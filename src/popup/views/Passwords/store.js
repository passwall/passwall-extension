import PasswordsService from '@/api/services/Passwords'
import CryptoUtils from '@/utils/crypto'

const EncryptedFields = ['username', 'password', 'extra']

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
      const { data: itemList } = await PasswordsService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFields(element, EncryptedFields)
      })
      state.ItemList = itemList
    },

    Delete(_, id) {
      return PasswordsService.Delete(id)
    },

    Create(_, data) {
      const payload = CryptoUtils.encryptPayload(data, EncryptedFields)
      return PasswordsService.Create(payload)
    },

    Update(_, data) {
      const payload = CryptoUtils.encryptPayload(data, EncryptedFields)
      return PasswordsService.Update(data.id, payload)
    }
  }
}
