import PaymentCardsService from '@/api/services/PaymentCards'
import CryptoUtils from '@/utils/crypto'

const EncryptedFields = ['type', 'number', 'expiry_date', 'cardholder_name', 'verification_number']

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
      const { data: itemList } = await PaymentCardsService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFields(element, EncryptedFields)
      })
      state.ItemList = itemList
    },

    Delete(_, id) {
      return PaymentCardsService.Delete(id)
    },

    Create(_, data) {
      const payload = CryptoUtils.encryptPayload(data, EncryptedFields)
      return PaymentCardsService.Create(payload)
    },

    Update(_, data) {
      const payload = CryptoUtils.encryptPayload(data, EncryptedFields)
      return PaymentCardsService.Update(data.id, payload)
    }
  }
}
