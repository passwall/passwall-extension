<template>
  <div>
    <Header class="bg-black-400">
      <template v-slot:content>
        <VIcon class="c-pointer" name="arrow-left" @click="$router.back()" />
        <div class="d-flex flex-auto ml-2">
          <span class="fw-bold h5 ml-2">Change Master Password</span>
        </div>
      </template>
    </Header>
    <div class="scroll">
      <form @submit.prevent="onSubmit" class="create-form">

        <div class="form-row">
          <label v-text="'E-Mail Address'" />
          <VFormText
            name="Email"
            v-model="form.email"
            v-validate="'required'"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Current Master Password'" />
          <div class="d-flex flex-justify-between ">
            <VFormText
              name="Current Master Password"
              class="flex-auto"
              v-model="form.current"
              v-validate="'required'"
              :placeholder="$t('ClickToFill')"
              theme="no-border"
              :type="showCurrent ? 'text' : 'password'"
              ref="current_master_password"
            />
            <div class="d-flex flex-items-center mr-3">
              <CheckPassword :password="form.current" />
              <ShowPassButton @click="showCurrent = $event" />
            </div>
          </div>
        </div>

        <div class="form-row mt-2">
          <label v-text="'New Master Password'" />
          <div class="d-flex flex-justify-between ">
            <VFormText
              name="New Master Password"
              class="flex-auto"
              v-model="form.new"
              v-validate="'required'"
              :placeholder="$t('ClickToFill')"
              theme="no-border"
              :type="showNew ? 'text' : 'password'"
              ref="new_master_password"
            />
            <div class="d-flex flex-items-center mr-3">
              <GeneratePassword v-model="form.new" />
              <ClipboardButton :copy="form.new" />
              <CheckPassword :password="form.new" />
              <ShowPassButton @click="showNew = $event" />
            </div>
          </div>
        </div>

        <div class="form-row mt-2 mb-2">
          <label v-text="'New Master Password Confirm'" />
          <div class="d-flex flex-justify-between ">
            <VFormText
              name="New Master Password Confirmation"
              class="flex-auto"
              v-model="form.newConfirm"
              v-validate="'required|confirmed:new_master_password'"
              :placeholder="$t('ClickToFill')"
              theme="no-border"
              :type="showNewConfirm ? 'text' : 'password'"
            />
            <div class="d-flex flex-items-center mr-3">
              <CheckPassword :password="form.newConfirm" />
              <ShowPassButton @click="showNewConfirm = $event" />
            </div>
          </div>
        </div>
        
        <VButton
          class="mx-2 my-2"
          size="medium"
          type="submit"
          style="letter-spacing: 2px"
          :loading="$wait.is($waiters.ChangeMasterPassword.Update)"
        >
          Save
        </VButton>
      </form>
    </div>
  </div>
</template>

<script>
import CheckPassword from '@/components/CheckPassword.vue';
import { mapActions } from 'vuex'
import Storage from '@/utils/storage'
import store from '@p/store'

export default {
  components: { CheckPassword },
  data() {
    return {
      showCurrent: false,
      showNew: false,
      showNewConfirm: false,
      form: {
        email: '',
        current: '',
        new: '',
        newConfirm: '',
      }
    }
  },
  methods: {
    ...mapActions('ChangeMasterPassword', 
    [
      'CheckCredentials',
      'GenerateNewMasterHash',
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
      'ChangeMasterPassword'
    ]),
    async onSubmit() {
      if (!(await this.$validator.validateAll())) return
      if (this.form.new === this.form.current) {
        const text = this.$t(`New master password can not be same with current master password.`)
        this.$notifyError(text) 
        return
      }
      const onError = async () => {
        const text = this.$t(`Failed to change master password. Please contact with "hello@passwall.io".`)
        this.$notifyError(text) 
      }
      const onSuccess = async () => {
        try {
          await this.CheckCredentials(this.form )
        } catch (error) {
          const text = this.$t(`Email address or master password is wrong.`)
          this.$notifyError(text) 
          return
        }
        
        await this.GenerateNewMasterHash(this.form)
        
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

        await this.ChangeMasterPassword(this.form)
        
        // Reset all tokens and logout
        await store.dispatch('Logout')
        this.$router.push({ name: 'Login' })
      }
      this.$request(onSuccess, this.$waiters.ChangeMasterPassword.Update, onError)
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
