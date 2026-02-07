/**
 * Cryptography Service
 * Zero-Knowledge Architecture for Passwall Extension
 *
 * Standards:
 * - NIST SP 800-132: Password-Based Key Derivation
 * - RFC 5869: HKDF (Key Derivation Function)
 * - RFC 2898: PBKDF2 Specification
 * - OWASP 2023: Password Storage Guidelines
 *
 * Security Guarantee: Server NEVER sees Master Key or User Key
 *
 * @version 2.0
 * @since 2026-01
 */

// ============================================================
// Types & Constants
// ============================================================

export const KdfType = {
  PBKDF2: 0,
  Argon2id: 1
}

export const DEFAULT_KDF_CONFIG = {
  kdf_type: KdfType.PBKDF2,
  kdf_iterations: 600000 // OWASP 2023 recommendation
}

export const PBKDF2_MIN_ITERATIONS = 600000
export const PBKDF2_MAX_ITERATIONS = 2000000

// ============================================================
// SymmetricKey Class
// ============================================================

/**
 * Symmetric Key (512-bit)
 * Contains separate encryption and MAC keys
 */
export class SymmetricKey {
  /**
   * @param {Uint8Array} encKey - 256-bit encryption key
   * @param {Uint8Array} macKey - 256-bit MAC key
   */
  constructor(encKey, macKey) {
    if (encKey.length !== 32 || macKey.length !== 32) {
      throw new Error('Invalid key size: expected 32 bytes for each key')
    }
    this.encKey = encKey
    this.macKey = macKey
  }

  /**
   * Convert to bytes (64 bytes total)
   * @returns {Uint8Array}
   */
  toBytes() {
    const combined = new Uint8Array(64)
    combined.set(this.encKey, 0)
    combined.set(this.macKey, 32)
    return combined
  }

  /**
   * Create from bytes
   * @param {Uint8Array} bytes - 64 bytes
   * @returns {SymmetricKey}
   */
  static fromBytes(bytes) {
    if (bytes.length !== 64) {
      throw new Error('Invalid key size: expected 64 bytes')
    }
    return new SymmetricKey(bytes.slice(0, 32), bytes.slice(32, 64))
  }
}

// ============================================================
// CryptoService Class
// ============================================================

export class CryptoService {
  /**
   * Make Master Key from password (NEVER sent to server)
   *
   * @param {string} password - User's master password
   * @param {string} kdfSalt - Random salt from server (hex string)
   * @param {Object} kdfConfig - KDF configuration
   * @returns {Promise<Uint8Array>} 256-bit Master Key
   */
  async makeMasterKey(password, kdfSalt, kdfConfig) {
    if (kdfConfig.kdf_type === KdfType.PBKDF2) {
      // Salt is passed as hex string but should be treated as UTF-8 string
      // (matches admin panel implementation)
      const masterKey = await this.pbkdf2(
        password,
        kdfSalt, // Pass hex string directly, pbkdf2 will encode as UTF-8
        kdfConfig.kdf_iterations || 600000,
        32,
        'SHA-256'
      )
      return masterKey
    } else if (kdfConfig.kdf_type === KdfType.Argon2id) {
      throw new Error('Argon2id not yet implemented in extension')
    } else {
      throw new Error('Unsupported KDF type')
    }
  }

  /**
   * Hash Master Key for server authentication (using HKDF)
   *
   * @param {Uint8Array} masterKey - Derived master key
   * @returns {Promise<Uint8Array>} 256-bit authentication hash
   */
  async hashMasterKey(masterKey) {
    const authKey = await this.hkdfExpand(masterKey, 'auth', 32, 'SHA-256')
    return authKey
  }

  /**
   * Stretch Master Key using HKDF
   * Expands 256-bit key to 512-bit (separate enc/mac keys)
   *
   * @param {Uint8Array} masterKey - 256-bit master key
   * @returns {Promise<SymmetricKey>} SymmetricKey with separate enc and mac keys
   */
  async stretchMasterKey(masterKey) {
    const encKey = await this.hkdfExpand(masterKey, 'enc', 32, 'SHA-256')
    const macKey = await this.hkdfExpand(masterKey, 'mac', 32, 'SHA-256')
    return new SymmetricKey(encKey, macKey)
  }

  /**
   * Generate User Key (random, generated once per account)
   *
   * @returns {Promise<SymmetricKey>} SymmetricKey (512-bit random)
   */
  async makeUserKey() {
    const randomBytes = crypto.getRandomValues(new Uint8Array(64))
    return new SymmetricKey(randomBytes.slice(0, 32), randomBytes.slice(32, 64))
  }

  /**
   * Protect User Key with Master Key
   * Returns EncString format: "2.iv|ct|mac"
   *
   * @param {SymmetricKey} userKey - User's symmetric key
   * @param {SymmetricKey} stretchedMasterKey - Stretched master key
   * @returns {Promise<string>} EncString (encrypted User Key)
   */
  async protectUserKey(userKey, stretchedMasterKey) {
    const encString = await this.encryptAesCbcHmac(userKey.toBytes(), stretchedMasterKey)
    return encString
  }

  /**
   * Unwrap User Key with Master Key
   *
   * @param {string} protectedUserKey - EncString from server
   * @param {SymmetricKey} stretchedMasterKey - Stretched master key
   * @returns {Promise<SymmetricKey>} User Key (decrypted)
   */
  async unwrapUserKey(protectedUserKey, stretchedMasterKey) {
    const userKeyBytes = await this.decryptAesCbcHmac(protectedUserKey, stretchedMasterKey)
    return SymmetricKey.fromBytes(userKeyBytes)
  }

  /**
   * Safely convert a Uint8Array to a standalone ArrayBuffer.
   * Defensive copy: if the typed array is a view over a larger buffer
   * (e.g. from subarray()), .buffer would return the entire backing store
   * causing SubtleCrypto to operate on wrong data. This always returns a
   * correctly-sized copy. Matches vault implementation.
   *
   * @param {Uint8Array} arr
   * @returns {ArrayBuffer}
   */
  toArrayBuffer(arr) {
    return arr.buffer.byteLength === arr.byteLength
      ? arr.buffer
      : arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength)
  }

  /**
   * Encrypt with AES-256-CBC + HMAC-SHA256 (Encrypt-then-MAC)
   * Returns EncString format: "2.iv|ciphertext|mac"
   *
   * @param {string|Uint8Array} plaintext - Data to encrypt
   * @param {SymmetricKey} key - Symmetric key
   * @returns {Promise<string>} EncString
   */
  async encryptAesCbcHmac(plaintext, key) {
    // 1. Generate random IV (128 bits)
    const iv = crypto.getRandomValues(new Uint8Array(16))

    // 2. Convert plaintext to bytes
    const plaintextBytes =
      typeof plaintext === 'string' ? new TextEncoder().encode(plaintext) : plaintext

    // 3. Import AES key
    const aesKey = await crypto.subtle.importKey(
      'raw',
      this.toArrayBuffer(key.encKey),
      { name: 'AES-CBC' },
      false,
      ['encrypt']
    )

    // 4. Encrypt with AES-256-CBC
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-CBC', iv: this.toArrayBuffer(iv) },
      aesKey,
      this.toArrayBuffer(plaintextBytes)
    )

    // 5. Compute HMAC (Encrypt-then-MAC)
    const dataToMac = new Uint8Array(iv.length + ciphertext.byteLength)
    dataToMac.set(iv, 0)
    dataToMac.set(new Uint8Array(ciphertext), iv.length)

    const hmacKey = await crypto.subtle.importKey(
      'raw',
      this.toArrayBuffer(key.macKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const mac = await crypto.subtle.sign({ name: 'HMAC' }, hmacKey, this.toArrayBuffer(dataToMac))

    // 6. Format as EncString: "2.iv|ct|mac"
    const encString = `2.${this.arrayToBase64(iv)}|${this.arrayToBase64(
      new Uint8Array(ciphertext)
    )}|${this.arrayToBase64(new Uint8Array(mac))}`

    return encString
  }

  /**
   * Decrypt EncString (with MAC verification)
   *
   * @param {string} encString - EncString format: "2.iv|ct|mac"
   * @param {SymmetricKey} key - Symmetric key
   * @returns {Promise<Uint8Array>} Decrypted bytes
   */
  async decryptAesCbcHmac(encString, key) {
    // 1. Parse EncString
    const parts = encString.split('.')
    if (parts.length !== 2 || parts[0] !== '2') {
      throw new Error('Invalid EncString format')
    }

    const [ivB64, ctB64, macB64] = parts[1].split('|')
    if (!ivB64 || !ctB64 || !macB64) {
      throw new Error('Invalid EncString: missing parts')
    }

    const iv = this.base64ToArray(ivB64)
    const ciphertext = this.base64ToArray(ctB64)
    const mac = this.base64ToArray(macB64)

    // 2. Verify MAC FIRST (before decryption!)
    const dataToVerify = new Uint8Array(iv.length + ciphertext.length)
    dataToVerify.set(iv, 0)
    dataToVerify.set(ciphertext, iv.length)

    const hmacKey = await crypto.subtle.importKey(
      'raw',
      this.toArrayBuffer(key.macKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const isValid = await crypto.subtle.verify(
      { name: 'HMAC' },
      hmacKey,
      this.toArrayBuffer(mac),
      this.toArrayBuffer(dataToVerify)
    )

    if (!isValid) {
      throw new Error('MAC verification failed - data may be corrupted or tampered')
    }

    // 3. Decrypt (only if MAC is valid)
    const aesKey = await crypto.subtle.importKey(
      'raw',
      this.toArrayBuffer(key.encKey),
      { name: 'AES-CBC' },
      false,
      ['decrypt']
    )

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: this.toArrayBuffer(iv) },
      aesKey,
      this.toArrayBuffer(ciphertext)
    )

    return new Uint8Array(plaintext)
  }

  // ============================================================
  // Low-Level Crypto Primitives
  // ============================================================

  /**
   * PBKDF2-SHA256 key derivation
   *
   * @param {string|Uint8Array} password - Password or key material
   * @param {string|Uint8Array} salt - Salt (email or random bytes)
   * @param {number} iterations - Number of iterations (600,000 recommended)
   * @param {number} keyLength - Output key length in bytes (32 = 256 bits)
   * @param {string} hash - Hash algorithm ('SHA-256')
   * @returns {Promise<Uint8Array>} Derived key
   */
  async pbkdf2(password, salt, iterations, keyLength, hash) {
    const passwordBytes =
      typeof password === 'string' ? new TextEncoder().encode(password) : password
    const saltBytes = typeof salt === 'string' ? new TextEncoder().encode(salt) : salt

    const importedKey = await crypto.subtle.importKey(
      'raw',
      this.toArrayBuffer(passwordBytes),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    )

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: this.toArrayBuffer(saltBytes),
        iterations: iterations,
        hash: hash
      },
      importedKey,
      keyLength * 8
    )

    return new Uint8Array(derivedBits)
  }

  /**
   * HKDF-Expand (RFC 5869)
   * Expands key material using HMAC
   *
   * @param {Uint8Array} key - Input key material
   * @param {string} info - Context string ("enc", "mac", "auth", etc.)
   * @param {number} outputLength - Output length in bytes
   * @param {string} hash - Hash algorithm ('SHA-256')
   * @returns {Promise<Uint8Array>} Derived key
   */
  async hkdfExpand(key, info, outputLength, hash) {
    const hashLen = hash === 'SHA-256' ? 32 : 64
    if (outputLength > 255 * hashLen) {
      throw new Error('Output length too large for HKDF')
    }

    const infoBytes = new TextEncoder().encode(info)
    const output = new Uint8Array(outputLength)
    let previousBlock = new Uint8Array(0)
    let currentLength = 0
    let counter = 1

    while (currentLength < outputLength) {
      // T(i) = HMAC(T(i-1) | info | i)
      const input = new Uint8Array(previousBlock.length + infoBytes.length + 1)
      input.set(previousBlock, 0)
      input.set(infoBytes, previousBlock.length)
      input.set([counter], input.length - 1)

      const hmacKey = await crypto.subtle.importKey(
        'raw',
        this.toArrayBuffer(key),
        { name: 'HMAC', hash: hash },
        false,
        ['sign']
      )

      const block = await crypto.subtle.sign({ name: 'HMAC' }, hmacKey, this.toArrayBuffer(input))
      const blockArray = new Uint8Array(block)

      const bytesToCopy = Math.min(blockArray.length, outputLength - currentLength)
      output.set(blockArray.slice(0, bytesToCopy), currentLength)

      previousBlock = blockArray
      currentLength += bytesToCopy
      counter++
    }

    return output
  }

  // ============================================================
  // Utility Functions
  // ============================================================

  /**
   * Convert Uint8Array to Base64
   * @param {Uint8Array} array
   * @returns {string}
   */
  arrayToBase64(array) {
    if (array.length > 1000) {
      let binary = ''
      for (let i = 0; i < array.length; i++) {
        binary += String.fromCharCode(array[i])
      }
      return btoa(binary)
    }

    try {
      return btoa(String.fromCharCode(...array))
    } catch (_error) {
      let binary = ''
      for (let i = 0; i < array.length; i++) {
        binary += String.fromCharCode(array[i])
      }
      return btoa(binary)
    }
  }

  /**
   * Convert Base64 to Uint8Array
   * @param {string} base64
   * @returns {Uint8Array}
   */
  base64ToArray(base64) {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }

  /**
   * Convert Uint8Array to Hex string
   * @param {Uint8Array} array
   * @returns {string}
   */
  arrayToHex(array) {
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  /**
   * Convert Hex string to Uint8Array
   * @param {string} hex
   * @returns {Uint8Array}
   */
  hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
    }
    return bytes
  }

  /**
   * Constant-time comparison (prevents timing attacks)
   * @param {Uint8Array} a
   * @param {Uint8Array} b
   * @returns {boolean}
   */
  constantTimeEqual(a, b) {
    if (a.length !== b.length) {
      return false
    }

    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i]
    }

    return result === 0
  }

  /**
   * Generate random hex string (for kdf_salt generation)
   * @param {number} bytes - Number of bytes (32 recommended)
   * @returns {string} Hex string
   */
  generateRandomHex(bytes) {
    const randomBytes = crypto.getRandomValues(new Uint8Array(bytes))
    return this.arrayToHex(randomBytes)
  }
}

// ============================================================
// Global Instance
// ============================================================

export const cryptoService = new CryptoService()

// ============================================================
// Organization Key Helpers
// ============================================================

/**
 * Generate a random Organization Key (512-bit SymmetricKey)
 * Used when creating a new organization (e.g. during signup)
 *
 * @returns {Promise<SymmetricKey>}
 */
export async function generateOrganizationKey() {
  const randomBytes = crypto.getRandomValues(new Uint8Array(64))
  return new SymmetricKey(randomBytes.slice(0, 32), randomBytes.slice(32, 64))
}

/**
 * Wrap (encrypt) an Organization Key with the User Key
 * Returns EncString format: "2.iv|ct|mac"
 *
 * @param {SymmetricKey} orgKey - Organization symmetric key
 * @param {SymmetricKey} userKey - User's symmetric key
 * @returns {Promise<string>} EncString
 */
export async function wrapOrgKeyWithUserKey(orgKey, userKey) {
  return await cryptoService.encryptAesCbcHmac(orgKey.toBytes(), userKey)
}

/**
 * Unwrap (decrypt) an Organization Key using the User Key
 *
 * @param {string} encryptedOrgKey - EncString from server
 * @param {SymmetricKey} userKey - User's symmetric key
 * @returns {Promise<SymmetricKey>} Decrypted organization key
 */
export async function unwrapOrgKeyWithUserKey(encryptedOrgKey, userKey) {
  const orgKeyBytes = await cryptoService.decryptAesCbcHmac(encryptedOrgKey, userKey)
  return SymmetricKey.fromBytes(orgKeyBytes)
}

/**
 * Encrypt data with an Organization Key
 *
 * @param {string} plaintext - JSON string to encrypt
 * @param {SymmetricKey} orgKey - Organization symmetric key
 * @returns {Promise<string>} EncString
 */
export async function encryptWithOrgKey(plaintext, orgKey) {
  return await cryptoService.encryptAesCbcHmac(plaintext, orgKey)
}

/**
 * Decrypt data with an Organization Key
 *
 * @param {string} encString - EncString from server
 * @param {SymmetricKey} orgKey - Organization symmetric key
 * @returns {Promise<object>} Parsed JSON object
 */
export async function decryptWithOrgKey(encString, orgKey) {
  const decryptedBytes = await cryptoService.decryptAesCbcHmac(encString, orgKey)
  const decryptedStr = new TextDecoder().decode(decryptedBytes)
  return JSON.parse(decryptedStr)
}

// ============================================================
// Default Export for Compatibility
// ============================================================

export default {
  CryptoService,
  SymmetricKey,
  cryptoService,
  KdfType,
  DEFAULT_KDF_CONFIG,
  PBKDF2_MIN_ITERATIONS,
  PBKDF2_MAX_ITERATIONS,
  generateOrganizationKey,
  wrapOrgKeyWithUserKey,
  unwrapOrgKeyWithUserKey,
  encryptWithOrgKey,
  decryptWithOrgKey
}
