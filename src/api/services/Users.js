import HTTPClient from '@/api/HTTPClient'

export default class UsersService {
  static async CheckCredentials(payload) {
    return HTTPClient.post(`/api/users/check-credentials`, payload)
  }
  
  static async ChangeMasterPassword(payload) {
    return HTTPClient.post(`/api/users/change-master-password`, payload)
  }
}
