<template>
  <div>
    <Header class="bg-black-400">
      <template v-slot:content>
        <div class="d-flex flex-auto flex-items-center ml-4">
          <span class="fw-bold h5 ml-2">Migration</span>
        </div>
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
import { mapActions } from 'vuex'
import store from '@p/store'

export default {
  data() {
    return {
      form: {}
    }
  },
  methods: {
    ...mapActions('Migration',
    [
      'FetchAllBankAccounts',
      'UpdateAllBankAccounts',
      'FetchAllCreditCards',
      'UpdateAllCreditCards',
      'FetchAllEmails',
      'UpdateAllEmails',
      'FetchAllLogins',
      'UpdateAllLogins',
      'FetchAllNotes',
      'UpdateAllNotes',
      'FetchAllServers',
      'UpdateAllServers',
      'Migrate',
    ]),
    async onSubmit() {
      const onError = async () => {
        const text = this.$t(`Failed to migrate. Please contact with "hello@passwall.io".`)
        this.$notifyError(text) 
      }
      const onSuccess = async () => {
        await this.FetchAllBankAccounts()
        await this.UpdateAllBankAccounts()

        await this.FetchAllCreditCards()
        await this.UpdateAllCreditCards()

        await this.FetchAllEmails()
        await this.UpdateAllEmails()

        await this.FetchAllLogins()
        await this.UpdateAllLogins()

        await this.FetchAllNotes()
        await this.UpdateAllNotes()

        await this.FetchAllServers()
        await this.UpdateAllServers()

        await this.Migrate()
        
        this.$notifySuccess(this.$t('Migration completed successfully.'))
        
        // Reset all tokens and logout
        await store.dispatch('Logout')
        this.$router.push({ name: 'Login' })
      }
      this.$request(onSuccess, this.$waiters.Migration.Update, onError)
    },
  }
}
</script>

<style lang="scss">
.new-logo {
  background-color: $color-gray-400;
  border-radius: 8px;
}
</style>
