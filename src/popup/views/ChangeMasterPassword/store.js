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
const ServersEncryptedFields = ['ip','username','password','hosting_username','hosting_password','admin_username','admin_password','extra']

export default {
  namespaced: true,

  state() {
    return {
      ItemList: [],
      new_master_hash:"",
      secret:"",
    }
  },

  actions: {
    async CheckCredentials({ state }, data) {
      const email = data.email
      const master_password = CryptoUtils.sha256Encrypt(data.current)
      const credentials = {email, master_password}
      const payload = CryptoUtils.encryptPayload(credentials)
      const response = await UsersService.CheckCredentials(payload)
      state.secret = response.data.message
    },

    GenerateNewMasterHash({ state },data){
      const new_master_password = CryptoUtils.sha256Encrypt(data.new)
      state.new_master_hash = CryptoUtils.pbkdf2Encrypt(state.secret, new_master_password)
    },

    async FetchAllBankAccounts({ state }, query) {
      const { data } = await BankAccountsService.FetchAll(query)
      const itemList = JSON.parse(CryptoUtils.aesDecrypt(data.data))
      itemList.forEach(element => {
        CryptoUtils.decryptFields(element, BankAccountsEncryptedFields)
      })
      state.ItemList = itemList
    },
  
    async UpdateAllBankAccounts({ state }, query) {
      state.ItemList.forEach(element => {
        CryptoUtils.encryptFields(element, BankAccountsEncryptedFields, state.new_master_hash)
      })
      const payload = CryptoUtils.encryptItemPayload(state.ItemList)
      BankAccountsService.BulkUpdate(payload)     
    },

    async FetchAllCreditCards({ state }, query) {
      const { data } = await CreditCardsService.FetchAll(query)
      const itemList = JSON.parse(CryptoUtils.aesDecrypt(data.data))
      itemList.forEach(element => {
        CryptoUtils.decryptFields(element, CreditCardsEncryptedFields)
      })
      state.ItemList = itemList
    },
  
    async UpdateAllCreditCards({ state }, query) {
      state.ItemList.forEach(element => {
        CryptoUtils.encryptFields(element, CreditCardsEncryptedFields, state.new_master_hash)
      })
      const payload = CryptoUtils.encryptItemPayload(state.ItemList)
      CreditCardsService.BulkUpdate(payload)     
    },

    async FetchAllEmails({ state }, query) {
      const { data } = await EmailsService.FetchAll(query)
      const itemList = JSON.parse(CryptoUtils.aesDecrypt(data.data))
      itemList.forEach(element => {
        CryptoUtils.decryptFields(element, EmailsEncryptedFields)
      })
      state.ItemList = itemList
    },

    async UpdateAllEmails({ state }, query) {
      state.ItemList.forEach(element => {
        CryptoUtils.encryptFields(element, EmailsEncryptedFields, state.new_master_hash)
      })
      const payload = CryptoUtils.encryptItemPayload(state.ItemList)
      EmailsService.BulkUpdate(payload)     
    },

    async FetchAllLogins({ state }, query) {
      const { data } = await LoginsService.FetchAll(query)
      const itemList = JSON.parse(CryptoUtils.aesDecrypt(data.data))
      itemList.forEach(element => {
        CryptoUtils.decryptFields(element, LoginsEncryptedFields)
      })
      state.ItemList = itemList
    },

    async UpdateAllLogins({ state }, query) {
      state.ItemList.forEach(element => {
        CryptoUtils.encryptFields(element, LoginsEncryptedFields, state.new_master_hash)
      })
      const payload = CryptoUtils.encryptItemPayload(state.ItemList)
      LoginsService.BulkUpdate(payload)     
    },

    async FetchAllNotes({ state }, query) {
      const { data } = await NotesService.FetchAll(query)
      const itemList = JSON.parse(CryptoUtils.aesDecrypt(data.data))
      itemList.forEach(element => {
        CryptoUtils.decryptFields(element, NotesEncryptedFields)
      })
      state.ItemList = itemList
    },
  
    async UpdateAllNotes({ state }, query) {
      state.ItemList.forEach(element => {
        CryptoUtils.encryptFields(element, NotesEncryptedFields, state.new_master_hash)
      })
      const payload = CryptoUtils.encryptItemPayload(state.ItemList)
      NotesService.BulkUpdate(payload)     
    },

    async FetchAllServers({ state }, query) {
      const { data } = await ServersService.FetchAll(query)
      const itemList = JSON.parse(CryptoUtils.aesDecrypt(data.data))
      itemList.forEach(element => {
        CryptoUtils.decryptFields(element, ServersEncryptedFields)
      })
      state.ItemList = itemList
    },
  
    async UpdateAllServers({ state }, query) {
      state.ItemList.forEach(element => {
        CryptoUtils.encryptFields(element, ServersEncryptedFields, state.new_master_hash)
      })
      const payload = CryptoUtils.encryptItemPayload(state.ItemList)
      ServersService.BulkUpdate(payload)     
    },

    async ChangeMasterPassword({ state }, data) {
      const email = data.email
      const old_master_password = CryptoUtils.sha256Encrypt(data.current)
      const new_master_password = CryptoUtils.sha256Encrypt(data.new)
      const credentials = {
        email:email, 
        old_master_password:old_master_password, 
        new_master_password:new_master_password
      }
      const payload = CryptoUtils.encryptPayload(credentials)
      const response = await UsersService.ChangeMasterPassword(payload)
      console.log(response.data)
    },

  }
}
