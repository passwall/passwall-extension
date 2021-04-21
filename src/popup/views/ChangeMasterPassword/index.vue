<template>
  <div>
    <Header class="bg-black-400">
      <template v-slot:content>
        <VIcon class="c-pointer" name="arrow-left" @click="$router.back()" />
        <div class="d-flex flex-auto flex-items-center ml-4">
          <div class="new-logo">
            <VIcon name="logo-simple" height="40px" width="40px" />
          </div>
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

export default {
  components: { CheckPassword },
  data() {
    return {
      showCurrent: false,
      showNew: false,
      showNewConfirm: false,
      form: {
        email: 'test@passwall.io',
        current: '123456',
        new: '123456',
        newConfirm: '123456',
      }
    }
  },
  methods: {
    ...mapActions('ChangeMasterPassword', ['CheckCredentials','GenerateNewMasterHash','FetchAllLogins','ChangeMasterPassword']),
    async onSubmit() {
      if (!(await this.$validator.validateAll())) return
      const onSuccess = async () => {
        
        // await this.CheckCredentials({ ...this.form })
        // await this.GenerateNewMasterHash({ ...this.form })
        // await this.FetchAllLogins()
        // await this.ChangeMasterPassword({ ...this.form })
        // this.$router.push({ name: 'Logins' })
      }
      onSuccess()
      // this.$request(onSuccess, this.$waiters.Logins.Create)
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
