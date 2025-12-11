import { defineStore } from 'pinia'
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

export const useMigrationStore = defineStore('migration', {
  state: () => ({
    itemList: []
  }),

  actions: {
    async fetchAllBankAccounts(query) {
      const { data: itemList } = await BankAccountsService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFieldsLegacy(element, BankAccountsEncryptedFields)
      })
      this.itemList = itemList
    },

    async updateAllBankAccounts() {
      this.itemList.forEach(element => {
        CryptoUtils.encryptFields(element, BankAccountsEncryptedFields)
      })
      await BankAccountsService.BulkUpdate(this.itemList)
      console.log("Bank accounts migrated")
    },

    async fetchAllCreditCards(query) {
      const { data: itemList } = await CreditCardsService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFieldsLegacy(element, CreditCardsEncryptedFields)
      })
      this.itemList = itemList
    },

    async updateAllCreditCards() {
      this.itemList.forEach(element => {
        CryptoUtils.encryptFields(element, CreditCardsEncryptedFields)
      })
      await CreditCardsService.BulkUpdate(this.itemList)
      console.log("Credit cards migrated")
    },

    async fetchAllEmails(query) {
      const { data: itemList } = await EmailsService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFieldsLegacy(element, EmailsEncryptedFields)
      })
      this.itemList = itemList
    },

    async updateAllEmails() {
      this.itemList.forEach(element => {
        CryptoUtils.encryptFields(element, EmailsEncryptedFields)
      })
      await EmailsService.BulkUpdate(this.itemList)
      console.log("Emails migrated")
    },

    async fetchAllLogins(query) {
      const { data: itemList } = await LoginsService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFieldsLegacy(element, LoginsEncryptedFields)
      })
      this.itemList = itemList
    },

    async updateAllLogins() {
      this.itemList.forEach(element => {
        CryptoUtils.encryptFields(element, LoginsEncryptedFields)
      })
      await LoginsService.BulkUpdate(this.itemList)
      console.log("Logins migrated")
    },

    async fetchAllNotes(query) {
      const { data: itemList } = await NotesService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFieldsLegacy(element, NotesEncryptedFields)
      })
      this.itemList = itemList
    },

    async updateAllNotes() {
      this.itemList.forEach(element => {
        CryptoUtils.encryptFields(element, NotesEncryptedFields)
      })
      await NotesService.BulkUpdate(this.itemList)
      console.log("Notes migrated")
    },

    async fetchAllServers(query) {
      const { data: itemList } = await ServersService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFieldsLegacy(element, ServersEncryptedFields)
      })
      this.itemList = itemList
    },

    async updateAllServers() {
      this.itemList.forEach(element => {
        CryptoUtils.encryptFields(element, ServersEncryptedFields)
      })
      await ServersService.BulkUpdate(this.itemList)
      console.log("Servers migrated")
    },

    async migrate() {
      const user = await Storage.getItem('user')
      const response = await UsersService.Migrate(user.id, { "is_migrated": true })
      if (response.status === 200) {
        console.log("Migration status changed as true")
      } else {
        console.log("Migration status update failed")
      }
    }
  }
})

