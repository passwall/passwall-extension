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
        <label v-text="$t('ServerURL')" class="mb-2" />
        <VFormText
          v-model="LoginForm.server"
          size="medium"
          name="server"
          :placeholder="$t('ServerURL')"
          data-testid="server"
        />

        <label v-text="$t('EMailAddress')" class="mb-2 mt-4" />
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
      LoginForm: {
        server: 'https://vault.passwall.io',
        email: '',
        master_password: ''
      }
    }
  },
  async mounted() {
    const savedEmail = await this.$storage.getItem('email')
    if (savedEmail) {
      this.LoginForm.email = savedEmail
    }
    
    const savedServer = await this.$storage.getItem('server')
    if (savedServer) {
      this.LoginForm.server = savedServer
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

      HTTPClient.setBaseURL(this.LoginForm.server)

      const onError = error => {
        let text = this.$t('Ooops! Something went wrong!')
        if (error.response && error.response.status == 401) {
          text = this.$t(error.response.data.message)
        }
        this.$notifyError(text)
      }

      const onSuccess = async () => {
        await this.loginAction({ ...this.LoginForm })
        const is_migrated = await this.$storage.getItem('is_migrated')
        if (!is_migrated) {
          this.$router.replace({ name: 'Migration' })
          return
        }
        this.$router.replace({ name: 'Logins' })
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
