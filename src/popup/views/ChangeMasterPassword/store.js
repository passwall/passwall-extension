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

export default {
  namespaced: true,

  state() {
    return {
      ItemList: [],
      new_master_hash: "",
      secret: "",
    }
  },

  actions: {
    async CheckCredentials({ state }, data) {
      const email = data.email
      const master_password = CryptoUtils.sha256Encrypt(data.current)
      const credentials = { email, master_password }
      const payload = CryptoUtils.encryptPayload(credentials)
      const response = await UsersService.CheckCredentials(payload)
      state.secret = response.data.message
    },

    GenerateNewMasterHash({ state }, data) {
      const new_master_password = CryptoUtils.sha256Encrypt(data.new)
      state.new_master_hash = CryptoUtils.pbkdf2Encrypt(state.secret, new_master_password)
    },

    async FetchAllBankAccounts({ state }, query) {
      const { data: itemList } = await BankAccountsService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFields(element, BankAccountsEncryptedFields)
      })
      state.ItemList = itemList
    },

    async UpdateAllBankAccounts({ state }, query) {
      state.ItemList.forEach(element => {
        CryptoUtils.encryptFields(element, BankAccountsEncryptedFields, state.new_master_hash)
      })
      BankAccountsService.BulkUpdate(state.ItemList)
    },

    async FetchAllPaymentCards({ state }, query) {
      const { data: itemList } = await PaymentCardsService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFields(element, PaymentCardsEncryptedFields)
      })
      state.ItemList = itemList
    },

    async UpdateAllPaymentCards({ state }, query) {
      state.ItemList.forEach(element => {
        CryptoUtils.encryptFields(element, PaymentCardsEncryptedFields, state.new_master_hash)
      })
      PaymentCardsService.BulkUpdate(state.ItemList)
    },

    async FetchAllPasswords({ state }, query) {
      const { data: itemList } = await PasswordsService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFields(element, PasswordsEncryptedFields)
      })
      state.ItemList = itemList
    },

    async UpdateAllPasswords({ state }, query) {
      state.ItemList.forEach(element => {
        CryptoUtils.encryptFields(element, PasswordsEncryptedFields, state.new_master_hash)
      })
      PasswordsService.BulkUpdate(state.ItemList)
    },

    async FetchAllNotes({ state }, query) {
      const { data: itemList } = await NotesService.FetchAll(query)
      itemList.forEach(element => {
        CryptoUtils.decryptFields(element, NotesEncryptedFields)
      })
      state.ItemList = itemList
    },

    async UpdateAllNotes({ state }, query) {
      state.ItemList.forEach(element => {
        CryptoUtils.encryptFields(element, NotesEncryptedFields, state.new_master_hash)
      })
      NotesService.BulkUpdate(state.ItemList)
    },

    async ChangeMasterPassword({ state }, data) {
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
    },

  }
}
