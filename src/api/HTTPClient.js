import Axios from 'axios'

let baseURL = 'https://vault.passwall.io'

const client = Axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    Accept: 'application/json, text/plain, */*'
  }
})

// client.interceptors.request.use(request => {
//   console.log('Starting Request', JSON.stringify(request, null, 2))
//   return request
// })

export default class HTTPClient {
  static async head(path) {
    return client.head(path)
  }

  static async get(path, params = {}, headers = {}) {
    return client.get(path, {
      params,
      headers
    })
  }

  static async post(path, data = {}, headers = {}, onUploadProgress) {
    return client.post(path, data, {
      headers,
      onUploadProgress
    })
  }

  static async put(path, data = {}, headers = {}) {
    return client.put(path, data, {
      headers
    })
  }

  static async delete(path, data = {}, headers = {}) {
    return client.delete(path, {
      data,
      headers
    })
  }

  static setHeader(key, value) {
    client.defaults.headers.common[key] = value
  }

  static setBaseURL(url) {
    client.defaults.baseURL = url
  }
}
