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
          v-validate="'required'"
          :placeholder="$t('ServerURL')"
          data-testid="server"
        />

        <label v-text="$t('EMailAddress')" class="mb-2 mt-4" />
        <VFormText
          v-model="LoginForm.email"
          size="medium"
          name="username"
          v-validate="'required'"
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
          v-validate="'required|min:6|max:100'"
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
import { mapActions } from 'vuex'
import HTTPClient from '@/api/HTTPClient'

export default {
  name: 'Login',
  data() {
    return {
      LoginForm: {
        server: 'https://vault.passwall.io',
        email: '',
        master_password: ''
      }
    }
  },
  mounted() {
    this.$storage.getItem('email').then(e => {
      if (e) this.LoginForm.email = e
    }),
      this.$storage.getItem('server').then(e => {
        if (e) this.LoginForm.server = e
      })
  },
  methods: {
    ...mapActions(['Login']),
    async onLogin() {
      if (!(await this.$validator.validateAll())) return

      HTTPClient.setBaseURL(this.LoginForm.server)

      const onError = error => {
        let text = this.$t('Ooops! Something went wrong!')
        if (error.response.status == 401) {
          text = this.$t(error.response.data.message)
        }
        this.$notifyError(text)
      }

      const onSuccess = async () => {
        await this.Login({ ...this.LoginForm })
        const is_migrated = await this.$storage.getItem('is_migrated')
        if (!is_migrated) {
          this.$router.replace({ name: 'Migration' })
          return
        }
        this.$router.replace({ name: 'Home' })
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
