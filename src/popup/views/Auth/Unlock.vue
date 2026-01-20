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

        <VButton class="mt-5" type="submit" size="medium" :loading="isLoading">
          Unlock
        </VButton>

        <VButton theme="text" class="mt-3" size="medium" @click="onLogout">
          Log out
        </VButton>
      </form>
    </div>
  </div>
</template>

<script>
import { useAuthStore } from '@/stores/auth'

export default {
  name: 'Unlock',
  setup() {
    const authStore = useAuthStore()
    return {
      unlockWithPin: authStore.unlockWithPin,
      logoutAction: authStore.logout
    }
  },
  data() {
    return {
      pin: '',
      isLoading: false
    }
  },
  methods: {
    async onUnlock() {
      if (!this.pin || !this.pin.trim()) {
        this.$notifyError('Please enter your PIN')
        return
      }

      this.isLoading = true
      try {
        await this.unlockWithPin(this.pin)
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
