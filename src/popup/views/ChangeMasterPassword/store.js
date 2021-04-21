import UsersService from '@/api/services/Users'
import LoginsService from '@/api/services/Logins'
import CryptoUtils from '@/utils/crypto'

const EncryptedFields = []

export default {
  namespaced: true,

  state() {
    return {
      ItemList: [],
      Detail: {},
      new_master_hash:"",
      secret:"",
    }
  },

  actions: {
    async CheckCredentials({ state }, data) {
      const email = data.email
      const master_password = CryptoUtils.sha256Encrypt(data.current)
      const credentials = {email:email, master_password:master_password}
      const payload = CryptoUtils.encryptPayload(credentials, EncryptedFields)
      const response = await UsersService.CheckCredentials(payload)
      state.secret = response.data.message
    },

    GenerateNewMasterHash({ state },data){
      state.new_master_hash = CryptoUtils.pbkdf2Encrypt(state.secret, data.new)
    },

    async FetchAllLogins({ state }, query) {
      const LoginsEncryptedFields = ['username', 'password', 'extra']
      const { data } = await LoginsService.FetchAll(query)
      const itemList = JSON.parse(CryptoUtils.aesDecrypt(data.data))
      itemList.forEach(element => {
        CryptoUtils.decryptFields(element, LoginsEncryptedFields)
      })

      state.master_hash = CryptoUtils.pbkdf2Encrypt(data.secret, payload.master_password)
      CryptoUtils.encryptKey = state.master_hash
      
      itemList.forEach(element => {
        var payload = CryptoUtils.encryptPayload(element, LoginsEncryptedFields, state.new_master_hash)
        LoginsService.Update(element.id, payload)
      })
      
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
      const payload = CryptoUtils.encryptPayload(credentials, EncryptedFields)
      const response = await UsersService.ChangeMasterPassword(payload)
      console.log(response.data)
    },

    // TODO
    // Step 1: Encrypt current password
    // Step 2: Check current password
    // Step 4: Generate new master hash to encrypt items
    
    // Step 5: Fetch all Logins an decrypt with current master_hash
    // Step 6: Encrypt all Logins with new master hash
    // Step 7: Update all Logins

    // Goto Step 5 for all categories
    
    // Step 8: Encrypt new password with SHA256 to update user master password
    // Step 9: Update user master password

  }
}
