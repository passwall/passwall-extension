<template>
  <div class="login-root">
    <div class="d-flex flex-justify-center flex-items-center header">
      <VIcon name="passwall-with-text" width="140px" height="32px" />
    </div>
    <div class="p-4 pt-5">
      <form class="login-form d-flex flex-column" @submit.stop.prevent="onUnlock">
        <label class="mb-2">PIN</label>
        <VFormText
          v-model="pin"
          size="medium"
          type="password"
          name="pin"
          placeholder="Enter your PIN"
          autocomplete="current-password"
        />

        <VButton class="mt-5" type="submit" size="medium" :loading="isLoading"> Unlock </VButton>

        <VButton theme="text" class="mt-3" size="medium" @click="onLogout"> Log out </VButton>
      </form>
    </div>
  </div>
</template>

<script>
import { useAuthStore } from '@/stores/auth'
import Storage from '@/utils/storage'
import SessionStorage, { SESSION_KEYS } from '@/utils/session-storage'

export default {
  name: 'Unlock',
  setup() {
    const authStore = useAuthStore()
    return {
      unlockWithPin: authStore.unlockWithPin,
      logoutAction: authStore.logout,
      refreshToken: authStore.refreshToken // Use store method that saves tokens
    }
  },
  data() {
    return {
      pin: '',
      isLoading: false
    }
  },
  methods: {
    /**
     * Clear session but PRESERVE PIN data
     * This allows user to use PIN again after re-login
     */
    async clearSessionOnly() {
      // Clear tokens
      const email = await Storage.getItem('email')
      const server = await Storage.getItem('server')
      // Preserve PIN data keys
      const pinKeys = [
        'pin_protected_user_key',
        'pin_kdf_salt',
        'pin_kdf_iterations',
        'pin_failed_attempts',
        'pin_lock_until'
      ]
      const pinData = {}
      for (const key of pinKeys) {
        pinData[key] = await Storage.getItem(key)
      }

      // Clear all storage
      await Storage.clear()

      // Restore email, server, and PIN data
      if (email) await Storage.setItem('email', email)
      if (server) await Storage.setItem('server', server)
      for (const key of pinKeys) {
        if (pinData[key] != null) {
          await Storage.setItem(key, pinData[key])
        }
      }

      // Clear session keys
      if (SessionStorage.isSupported()) {
        try {
          await SessionStorage.removeItem(SESSION_KEYS.userKey)
        } catch {
          // ignore
        }
      }
      window?.sessionStorage?.removeItem?.('userKey')
    },

    async onUnlock() {
      if (!this.pin || !this.pin.trim()) {
        this.$notifyError('Please enter your PIN')
        return
      }

      this.isLoading = true
      try {
        // Step 1: Unlock with PIN (restores userKey)
        await this.unlockWithPin(this.pin)

        // Step 2: Validate tokens are still valid by trying token refresh
        // This prevents the user from being stuck in a loop if tokens expired
        const refreshToken = await Storage.getItem('refresh_token')

        if (refreshToken) {
          try {
            // Use store method that saves new tokens to storage AND updates HTTPClient header
            await this.refreshToken()
          } catch (refreshError) {
            // Tokens are expired/invalid - need full re-login
            // But PRESERVE PIN data so user can use PIN after re-login
            console.warn('Tokens expired after PIN unlock, redirecting to login (preserving PIN)')

            // IMPORTANT: Clear session first to prevent AuthCheck from redirecting back
            // because unlockWithPin already restored userKey to session
            await this.clearSessionOnly()

            this.$notifyError('Your session has expired. Please sign in again.')
            this.$router.replace({ name: 'Login' })
            return
          }
        } else {
          // No refresh token - need full re-login
          console.warn('No refresh token available after PIN unlock, redirecting to login')
          await this.clearSessionOnly()
          this.$notifyError('Your session has expired. Please sign in again.')
          this.$router.replace({ name: 'Login' })
          return
        }

        // Step 3: Navigate to last route or default
        const lastRouteName = await this.$storage.getItem('latest_route')
        const fallback = { name: 'Passwords' }

        if (lastRouteName && !['Login', 'Unlock'].includes(lastRouteName)) {
          this.$router.replace({ name: lastRouteName }).catch(() => {})
        } else {
          this.$router.replace(fallback)
        }
      } catch (error) {
        if (error?.type === 'PIN_LOCKED' && error.lockUntil) {
          const seconds = Math.max(1, Math.ceil((error.lockUntil - Date.now()) / 1000))
          this.$notifyError(`PIN temporarily locked. Try again in ${seconds}s.`)
        } else if (error?.type === 'INVALID_PIN') {
          this.$notifyError('Invalid PIN. Please try again.')
        } else {
          this.$notifyError('Unable to unlock. Please try again.')
        }
      } finally {
        this.isLoading = false
        this.pin = ''
      }
    },
    async onLogout() {
      await this.logoutAction()
      this.$router.replace({ name: 'Login' })
    }
  }
}
</script>

<style lang="scss">
.login-root {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.header {
  height: 95px;
  border-bottom: 2px solid $color-black;
}
</style>
