import CryptoJS from 'crypto-js'

const ivSize = 128 // 16
const iterations = 100000
const iv = CryptoJS.lib.WordArray.random(ivSize / 8)

export const isBase64 = value => {
  try {
    return btoa(atob(value)) == value
  } catch (_) {
    return false
  }
}

export default class CryptoUtils {
  static encryptKey

  static sha1(msg) {
    return CryptoJS.SHA1(msg).toString().toUpperCase();
  }

  static encrypt(message, password = this.encryptKey) {
    const salt = CryptoJS.lib.WordArray.random(128 / 8)
    const hexKey = CryptoJS.enc.Hex.parse(password)

    const encrypted = CryptoJS.AES.encrypt(message, hexKey, {
      iv: iv,
      padding: CryptoJS.pad.Pkcs7,
      mode: CryptoJS.mode.CBC,
      hasher: CryptoJS.algo.SHA256
    })

    // salt, iv will be hex 32 in length
    // append them to the ciphertext for use  in decryption
    const transitMessage = salt.toString() + iv.toString() + encrypted.toString()
    return transitMessage
  }

  static decrypt(message, password = this.encryptKey) {
    const iv = CryptoJS.enc.Hex.parse(message.substr(32, 32))
    const encrypted = message.substring(64)
    const hexKey = CryptoJS.enc.Hex.parse(password)

    const decrypted = CryptoJS.AES.decrypt(encrypted, hexKey, {
      iv,
      padding: CryptoJS.pad.Pkcs7,
      mode: CryptoJS.mode.CBC,
      hasher: CryptoJS.algo.SHA256
    })
    return decrypted.toString(CryptoJS.enc.Utf8)
  }

  // decryptLegacy is deprecated
  static decryptLegacy(message, password = this.encryptKey) {
    const iv = CryptoJS.enc.Hex.parse(message.substr(32, 32))
    const encrypted = message.substring(64)

    const decrypted = CryptoJS.AES.decrypt(encrypted, password, {
      iv,
      padding: CryptoJS.pad.Pkcs7,
      mode: CryptoJS.mode.CBC,
      hasher: CryptoJS.algo.SHA256
    })
    return decrypted.toString(CryptoJS.enc.Utf8)
  }

  static pbkdf2Encrypt(masterPassword = this.encryptKey, secret) {
    const cipher = CryptoJS.PBKDF2(masterPassword, secret, {
      hasher: CryptoJS.algo.SHA256,
      keySize: 256 / 32,
      iterations
    })

    return cipher.toString()
  }

  static sha256Encrypt(value) {
    return CryptoJS.SHA256(value).toString()
  }

  static encryptFields(data, keyList, encryptKey = this.encryptKey) {
    Object.keys(data).forEach(key => {
      if (data[key] && keyList.includes(key)) {
        data[key] = this.encrypt(data[key], encryptKey)
      }
    })
  }

  static decryptFields(data, keyList, encryptKey = this.encryptKey) {
    Object.keys(data).forEach(key => {
      if (data[key] && keyList.includes(key)) {
        data[key] = this.decrypt(data[key], encryptKey)
      }
    })
  }

  static decryptFieldsLegacy(data, keyList, encryptKey = this.encryptKey) {
    Object.keys(data).forEach(key => {
      if (data[key] && keyList.includes(key)) {
        data[key] = this.decryptLegacy(data[key], encryptKey)
      }
    })
  }

  static encryptPayload(
    data,
    keyList = [],
    encryptKey = this.encryptKey,
  ) {
    Object.keys(data).forEach(key => {
      if (keyList.includes(key.toLowerCase())) {
        data[key] = this.encrypt(data[key], encryptKey)
      }
    })
    return data
  }
}