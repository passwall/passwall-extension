import Storage from '@/utils/storage'

import UsersService from '@/api/services/Users'
import LoginsService from '@/api/services/Logins'
import BankAccountsService from '@/api/services/BankAccounts'
import CreditCardsService from '@/api/services/CreditCards'
import EmailsService from '@/api/services/Emails'
import NotesService from '@/api/services/Notes'
import ServersService from '@/api/services/Servers'
import CryptoUtils from '@/utils/crypto'

const LoginsEncryptedFields = ['username', 'password', 'extra']
const BankAccountsEncryptedFields = ['account_name', 'account_number', 'iban', 'currency', 'password']
const CreditCardsEncryptedFields = ['type', 'number', 'expiry_date', 'cardholder_name', 'verification_number']
const EmailsEncryptedFields = ['email', 'password']
const NotesEncryptedFields = ['note']
const ServersEncryptedFields = ['ip', 'username', 'password', 'hosting_username', 'hosting_password', 'admin_username', 'admin_password', 'extra']

export default {
  namespaced: true,

  state() {
    return {
      ItemList: [],
    }
  },

  actions: {
    async FetchAllBankAccounts({ state }, query) {
      const { data: itemList } = await BankAccountsService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFieldsLegacy(element, BankAccountsEncryptedFields)
      })
      state.ItemList = itemList
    },

    async UpdateAllBankAccounts({ state }, query) {
      state.ItemList.forEach(element => {
        CryptoUtils.encryptFields(element, BankAccountsEncryptedFields, state.new_master_hash)
      })
      BankAccountsService.BulkUpdate(state.ItemList)
      console.log("Bank accounts migrated")
    },

    async FetchAllCreditCards({ state }, query) {
      const { data: itemList } = await CreditCardsService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFieldsLegacy(element, CreditCardsEncryptedFields)
      })
      state.ItemList = itemList
    },

    async UpdateAllCreditCards({ state }, query) {
      state.ItemList.forEach(element => {
        CryptoUtils.encryptFields(element, CreditCardsEncryptedFields, state.new_master_hash)
      })
      CreditCardsService.BulkUpdate(state.ItemList)
      console.log("Credit cards migrated")
    },

    async FetchAllEmails({ state }, query) {
      const { data: itemList } = await EmailsService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFieldsLegacy(element, EmailsEncryptedFields)
      })
      state.ItemList = itemList
    },

    async UpdateAllEmails({ state }, query) {
      state.ItemList.forEach(element => {
        CryptoUtils.encryptFields(element, EmailsEncryptedFields, state.new_master_hash)
      })
      EmailsService.BulkUpdate(state.ItemList)
      console.log("Emails migrated")
    },

    async FetchAllLogins({ state }, query) {
      const { data: itemList } = await LoginsService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFieldsLegacy(element, LoginsEncryptedFields)
      })
      state.ItemList = itemList
    },

    async UpdateAllLogins({ state }, query) {
      state.ItemList.forEach(element => {
        CryptoUtils.encryptFields(element, LoginsEncryptedFields, state.new_master_hash)
      })
      LoginsService.BulkUpdate(state.ItemList)
      console.log("Logins migrated")
    },

    async FetchAllNotes({ state }, query) {
      const { data: itemList } = await NotesService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFieldsLegacy(element, NotesEncryptedFields)
      })
      state.ItemList = itemList
    },

    async UpdateAllNotes({ state }, query) {
      state.ItemList.forEach(element => {
        CryptoUtils.encryptFields(element, NotesEncryptedFields, state.new_master_hash)
      })
      NotesService.BulkUpdate(state.ItemList)
      console.log("Notes migrated")
    },

    async FetchAllServers({ state }, query) {
      const { data: itemList } = await ServersService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFieldsLegacy(element, ServersEncryptedFields)
      })
      state.ItemList = itemList
    },

    async UpdateAllServers({ state }, query) {
      state.ItemList.forEach(element => {
        CryptoUtils.encryptFields(element, ServersEncryptedFields, state.new_master_hash)
      })
      ServersService.BulkUpdate(state.ItemList)
      console.log("Servers migrated")
    },

    async Migrate() {
      const user = await Storage.getItem('user')
      const response = await UsersService.Migrate(user.id, { "is_migrated": true })
      if (response.status === 200) {
        console.log("Migration status changed as true")
      } else {
        console.log("Migration status update failed")
      }
    },
  }
}
