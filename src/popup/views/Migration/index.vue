<template>
  <div>
    <Header class="bg-black-400">
      <template v-slot:content>
        <div class="d-flex flex-auto flex-items-center ml-4">
          <span class="fw-bold h5 ml-2">Migration</span>
        </div>
        <template v-slot:right>
          <VButton
            theme="text"
            class="mr-2"
            size="small"
            @click="onLogout"
          >
            Logout
          </VButton>
        </template>
      </template>
    </Header>
    <div class="scroll">
      <div class="mx-3 my-3">
        We improved our backend services. Please start Migration to continue using PassWall.
        <br><br>
        You will be redirected to Login page after migration.
      </div>
      <form @submit.prevent="onSubmit" class="create-form">
        <VButton
          class="mx-2 my-2"
          size="medium"
          type="submit"
          style="letter-spacing: 2px"
          :loading="$wait.is($waiters.ChangeMasterPassword.Update)"
        >
          Start
        </VButton>
      </form>
    </div>
  </div>
</template>

<script>
import { useMigrationStore } from '@/stores/migration'
import { useAuthStore } from '@/stores/auth'

export default {
  setup() {
    const migrationStore = useMigrationStore()
    const authStore = useAuthStore()
    
    return {
      migrationStore,
      authStore
    }
  },
  data() {
    return {
      form: {}
    }
  },
  methods: {
    async onSubmit() {
      const onError = async () => {
        const text = this.$t(`Failed to migrate. Please contact with "hello@passwall.io".`)
        this.$notifyError(text) 
      }
      const onSuccess = async () => {
        await this.migrationStore.fetchAllBankAccounts()
        await this.migrationStore.updateAllBankAccounts()

        await this.migrationStore.fetchAllCreditCards()
        await this.migrationStore.updateAllCreditCards()

        await this.migrationStore.fetchAllEmails()
        await this.migrationStore.updateAllEmails()

        await this.migrationStore.fetchAllLogins()
        await this.migrationStore.updateAllLogins()

        await this.migrationStore.fetchAllNotes()
        await this.migrationStore.updateAllNotes()

        await this.migrationStore.fetchAllServers()
        await this.migrationStore.updateAllServers()

        await this.migrationStore.migrate()
        
        this.$notifySuccess(this.$t('Migration completed successfully.'))
        
        // Reset all tokens and logout
        await this.authStore.logout()
        this.$router.push({ name: 'Login' })
      }
      this.$request(onSuccess, this.$waiters.Migration.Update, onError)
    },
    
    async onLogout() {
      await this.authStore.logout()
      this.$router.push({ name: 'Login' })
    }
  }
}
</script>

<style lang="scss">
.new-logo {
  background-color: $color-gray-400;
  border-radius: 8px;
}
</style>
