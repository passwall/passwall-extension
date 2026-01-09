<template>
  <div>
    <div class="d-flex flex-justify-center flex-items-center header">
      <VIcon name="passwall-with-text" width="140px" height="32px" />
    </div>
    <div class="p-4 pt-5">
      <form
        class="login-form d-flex flex-column"
        @submit.stop.prevent="onLogin"
        data-testid="login-form"
      >
        <!-- Server URL - Only visible in development mode -->
        <template v-if="showServerUrl">
          <label v-text="$t('ServerURL')" class="mb-2" />
          <VFormText
            v-model="LoginForm.server"
            size="medium"
            name="server"
            :placeholder="$t('ServerURL')"
            data-testid="server"
          />
        </template>

        <label v-text="$t('EMailAddress')" :class="showServerUrl ? 'mb-2 mt-4' : 'mb-2'" />
        <VFormText
          v-model="LoginForm.email"
          size="medium"
          name="username"
          :placeholder="$t('YourEMailAddress')"
          data-testid="username"
        />

        <label v-text="$t('MasterPassword')" class="mb-2 mt-4" />
        <VFormText
          v-model="LoginForm.master_password"
          size="medium"
          type="password"
          name="Password"
          :placeholder="$t('YourMasterPassword')"
          data-testid="password"
        />

        <!-- Login Btn -->
        <VButton
          class="mt-5"
          type="submit"
          size="medium"
          style="letter-spacing: 2px"
          :loading="$wait.is($waiters.Auth.Login)"
        >
          {{ $t('Login') }}
        </VButton>

        <VButton
          theme="text"
          class="mt-3"
          size="medium"
          style="letter-spacing: 2px"
          @click="newTab"
        >
          {{ $t('SignUp') }}
        </VButton>
      </form>
    </div>
  </div>
</template>

<script>
import { useAuthStore } from '@/stores/auth'
import HTTPClient from '@/api/HTTPClient'
import ENV_CONFIG from '@/config/env'

export default {
  name: 'Login',
  setup() {
    const authStore = useAuthStore()

    return {
      loginAction: authStore.login
    }
  },
  data() {
    return {
      // Show server URL input (from environment config)
      showServerUrl: ENV_CONFIG.SHOW_SERVER_URL,
      LoginForm: {
        server: 'https://vault.passwall.io',
        email: '',
        master_password: ''
      }
    }
  },
  async mounted() {
    // Debug: Log ENV_CONFIG values (only in dev)
    if (ENV_CONFIG.DEV_MODE) {
      console.log('🔧 ENV_CONFIG:', {
        DEV_EMAIL: ENV_CONFIG.DEV_EMAIL,
        DEV_SERVER_URL: ENV_CONFIG.DEV_SERVER_URL,
        DEV_PASSWORD: ENV_CONFIG.DEV_PASSWORD ? '***' : 'NOT SET',
        SHOW_SERVER_URL: ENV_CONFIG.SHOW_SERVER_URL
      })
    }

    // Load saved credentials from storage
    const savedEmail = await this.$storage.getItem('email')
    const savedServer = await this.$storage.getItem('server')

    // Priority 1: Use saved values from storage
    if (savedEmail) {
      this.LoginForm.email = savedEmail
    }
    if (savedServer) {
      this.LoginForm.server = savedServer
    }

    // Priority 2: Use dev credentials from .env.local (if not saved)
    // WARNING: Only works with .env.local (gitignored, never committed)
    if (!savedEmail && ENV_CONFIG.DEV_EMAIL) {
      this.LoginForm.email = ENV_CONFIG.DEV_EMAIL
    }
    if (!savedServer && ENV_CONFIG.DEV_SERVER_URL) {
      this.LoginForm.server = ENV_CONFIG.DEV_SERVER_URL
    }

    // Priority 3: Auto-fill password (use setTimeout for password input compatibility)
    if (ENV_CONFIG.DEV_PASSWORD) {
      setTimeout(() => {
        this.LoginForm.master_password = ENV_CONFIG.DEV_PASSWORD
        console.log(
          '✅ Dev password auto-filled:',
          this.LoginForm.master_password.length,
          'characters'
        )
        console.log('📋 Login form state:', {
          server: this.LoginForm.server,
          email: this.LoginForm.email,
          password: this.LoginForm.master_password ? '***' : 'EMPTY'
        })
      }, 100)
    } else {
      console.log('⚠️ DEV_PASSWORD not found in ENV_CONFIG')
    }
  },

  methods: {
    async onLogin() {
      // Basic validation
      if (!this.LoginForm.email || !this.LoginForm.email.trim()) {
        this.$notifyError('Please enter your email address')
        return
      }
      if (!this.LoginForm.master_password || this.LoginForm.master_password.length < 6) {
        this.$notifyError('Master password must be at least 6 characters')
        return
      }
      if (!this.LoginForm.server || !this.LoginForm.server.trim()) {
        this.$notifyError('Please enter server URL')
        return
      }

      // Security: Validate and set API endpoint
      try {
        HTTPClient.setBaseURL(this.LoginForm.server)
      } catch (error) {
        // Show user-friendly error message for security violations
        let errorMessage = 'Invalid server URL'

        if (error.message.includes('Unauthorized API endpoint')) {
          errorMessage =
            '⚠️ Security Warning: This server is not authorized.\n\nOnly official Passwall servers are allowed:\n• vault.passwall.io\n• api.passwall.io'
        } else if (error.message.includes('HTTPS')) {
          errorMessage = '🔒 Security Error: Server must use HTTPS for secure connection'
        } else if (error.message.includes('port')) {
          errorMessage = '⚠️ Security Error: Unauthorized port. Please use standard ports'
        }

        this.$notifyError(errorMessage)
        console.error('API endpoint validation failed:', error)
        return
      }

      const onError = (error) => {
        let text = this.$t('Ooops! Something went wrong!')

        if (error.response && error.response.status == 401) {
          // 401 = Wrong credentials or user doesn't exist
          const serverMessage = error.response.data?.message || error.response.data?.Message

          if (serverMessage) {
            text = this.$t(serverMessage)
          } else {
            // Default user-friendly message for 401
            text =
              '❌ Invalid email or master password.\n\nPlease check your credentials and try again.'
          }
        } else if (error.response && error.response.status >= 500) {
          text = '⚠️ Server error. Please try again later.'
        } else if (!error.response) {
          text = '⚠️ Cannot connect to server.\n\nPlease check your internet connection.'
        }

        this.$notifyError(text)
      }

      const onSuccess = async () => {
        await this.loginAction({ ...this.LoginForm })
        this.$router.replace({ name: 'Passwords' })
      }
      this.$request(onSuccess, this.$waiters.Auth.Login, onError)
    },

    newTab() {
      this.$browser.tabs.create({
        url: 'https://signup.passwall.io/'
      })
    }
  }
}
</script>

<style lang="scss">
.header {
  height: 95px;
  border-bottom: 2px solid $color-black;
}
</style>
