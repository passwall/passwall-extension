import { defineStore } from 'pinia'
import UsersService from '@/api/services/Users'
import PasswordsService from '@/api/services/Passwords'
import BankAccountsService from '@/api/services/BankAccounts'
import PaymentCardsService from '@/api/services/PaymentCards'
import NotesService from '@/api/services/Notes'
import CryptoUtils from '@/utils/crypto'

const PasswordsEncryptedFields = ['username', 'password', 'extra']
const BankAccountsEncryptedFields = ['account_name', 'account_number', 'iban', 'currency', 'password']
const PaymentCardsEncryptedFields = ['type', 'number', 'expiry_date', 'cardholder_name', 'verification_number']
const NotesEncryptedFields = ['note']

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

    async fetchAllPaymentCards(query) {
      const { data: itemList } = await PaymentCardsService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFields(element, PaymentCardsEncryptedFields)
      })
      this.itemList = itemList
    },

    async updateAllPaymentCards() {
      this.itemList.forEach(element => {
        CryptoUtils.encryptFields(element, PaymentCardsEncryptedFields, this.new_master_hash)
      })
      PaymentCardsService.BulkUpdate(this.itemList)
    },

    async fetchAllPasswords(query) {
      const { data: itemList } = await PasswordsService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFields(element, PasswordsEncryptedFields)
      })
      this.itemList = itemList
    },

    async updateAllPasswords() {
      this.itemList.forEach(element => {
        CryptoUtils.encryptFields(element, PasswordsEncryptedFields, this.new_master_hash)
      })
      PasswordsService.BulkUpdate(this.itemList)
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

