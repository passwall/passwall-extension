import Storage from '@/utils/storage'

export const PIN_STORAGE_KEYS = Object.freeze({
  protectedUserKey: 'pin_protected_user_key',
  kdfSalt: 'pin_kdf_salt',
  kdfIterations: 'pin_kdf_iterations',
  failedAttempts: 'pin_failed_attempts',
  lockUntil: 'pin_lock_until'
})

export async function hasPinProtection() {
  const protectedUserKey = await Storage.getItem(PIN_STORAGE_KEYS.protectedUserKey)
  return Boolean(protectedUserKey)
}

export async function clearPinData() {
  await Promise.all([
    Storage.removeItem(PIN_STORAGE_KEYS.protectedUserKey),
    Storage.removeItem(PIN_STORAGE_KEYS.kdfSalt),
    Storage.removeItem(PIN_STORAGE_KEYS.kdfIterations),
    Storage.removeItem(PIN_STORAGE_KEYS.failedAttempts),
    Storage.removeItem(PIN_STORAGE_KEYS.lockUntil)
  ])
}
