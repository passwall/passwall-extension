import { defineStore } from 'pinia'
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

export const useChangeMasterPasswordStore = defineStore('changeMasterPassword', {
  state: () => ({
    itemList: [],
    new_master_hash: '',
    secret: ''
  }),

  actions: {
    async checkCredentials(data) {
      const email = data.email
      const master_password = CryptoUtils.sha256Encrypt(data.current)
      const credentials = { email, master_password }
      const payload = CryptoUtils.encryptPayload(credentials)
      const response = await UsersService.CheckCredentials(payload)
      this.secret = response.data.message
    },

    generateNewMasterHash(data) {
      const new_master_password = CryptoUtils.sha256Encrypt(data.new)
      this.new_master_hash = CryptoUtils.pbkdf2Encrypt(this.secret, new_master_password)
    },

    async fetchAllBankAccounts(query) {
      const { data: itemList } = await BankAccountsService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFields(element, BankAccountsEncryptedFields)
      })
      this.itemList = itemList
    },

    async updateAllBankAccounts() {
      this.itemList.forEach(element => {
        CryptoUtils.encryptFields(element, BankAccountsEncryptedFields, this.new_master_hash)
      })
      BankAccountsService.BulkUpdate(this.itemList)
    },

    async fetchAllCreditCards(query) {
      const { data: itemList } = await CreditCardsService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFields(element, CreditCardsEncryptedFields)
      })
      this.itemList = itemList
    },

    async updateAllCreditCards() {
      this.itemList.forEach(element => {
        CryptoUtils.encryptFields(element, CreditCardsEncryptedFields, this.new_master_hash)
      })
      CreditCardsService.BulkUpdate(this.itemList)
    },

    async fetchAllEmails(query) {
      const { data: itemList } = await EmailsService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFields(element, EmailsEncryptedFields)
      })
      this.itemList = itemList
    },

    async updateAllEmails() {
      this.itemList.forEach(element => {
        CryptoUtils.encryptFields(element, EmailsEncryptedFields, this.new_master_hash)
      })
      EmailsService.BulkUpdate(this.itemList)
    },

    async fetchAllLogins(query) {
      const { data: itemList } = await LoginsService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFields(element, LoginsEncryptedFields)
      })
      this.itemList = itemList
    },

    async updateAllLogins() {
      this.itemList.forEach(element => {
        CryptoUtils.encryptFields(element, LoginsEncryptedFields, this.new_master_hash)
      })
      LoginsService.BulkUpdate(this.itemList)
    },

    async fetchAllNotes(query) {
      const { data: itemList } = await NotesService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFields(element, NotesEncryptedFields)
      })
      this.itemList = itemList
    },

    async updateAllNotes() {
      this.itemList.forEach(element => {
        CryptoUtils.encryptFields(element, NotesEncryptedFields, this.new_master_hash)
      })
      NotesService.BulkUpdate(this.itemList)
    },

    async fetchAllServers(query) {
      const { data: itemList } = await ServersService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFields(element, ServersEncryptedFields)
      })
      this.itemList = itemList
    },

    async updateAllServers() {
      this.itemList.forEach(element => {
        CryptoUtils.encryptFields(element, ServersEncryptedFields, this.new_master_hash)
      })
      ServersService.BulkUpdate(this.itemList)
    },

    async changeMasterPassword(data) {
      const email = data.email
      const old_master_password = CryptoUtils.sha256Encrypt(data.current)
      const new_master_password = CryptoUtils.sha256Encrypt(data.new)
      const credentials = {
        email: email,
        old_master_password: old_master_password,
        new_master_password: new_master_password
      }
      const payload = CryptoUtils.encryptPayload(credentials)
      const response = await UsersService.ChangeMasterPassword(payload)
      return response
    }
  }
})

