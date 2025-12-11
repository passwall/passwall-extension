<template>
  <div>
    <Header class="bg-black-400">
      <template v-slot:content>
        <VIcon class="c-pointer" name="arrow-left" @click="$router.back()" />
        <div class="d-flex flex-auto flex-items-center ml-4">
          <div class="new-logo">
            <VIcon name="logo-simple" height="40px" width="40px" />
          </div>
          <span class="fw-bold h5 ml-2">New Bank Account</span>
        </div>
      </template>
    </Header>
    <div class="scroll">
      <form @submit.prevent="onSubmit" class="create-form">
        <div class="form-row">
          <label v-text="'Title'" />
          <VFormText
            name="title"
            v-on:change="saveForm"
            v-model="form.title"
            v-validate="'required'"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Account Name'" />
          <VFormText
            name="account name"
            v-on:change="saveForm"
            v-model="form.account_name"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Account Number'" />
          <VFormText
            name="account number"
            v-on:change="saveForm"
            v-model="form.account_number"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'IBAN'" />
          <VFormText
            name="iban"
            v-on:change="saveForm"
            v-model="form.iban"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Currency'" />
          <VFormText
            name="currency"
            v-on:change="saveForm"
            v-model="form.currency"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Password'" />
          <div class="d-flex flex-justify-between ">
            <VFormText
              name="Password"
              v-on:change="saveForm"
              class="flex-auto"
              v-model="form.password"
              :placeholder="$t('ClickToFill')"
              theme="no-border"
              :type="showPass ? 'text' : 'password'"
            />
            <div class="d-flex flex-items-center mr-3">
              <ClipboardButton :copy="form.password" />
              <ShowPassButton @click="showPass = $event" />
            </div>
          </div>
        </div>

        <VButton
          class="mx-2 my-2"
          size="medium"
          type="submit"
          style="letter-spacing: 2px"
          :loading="$wait.is($waiters.BankAccounts.Create)"
        >
          Save
        </VButton>
      </form>
    </div>
  </div>
</template>

<script>
import { useBankAccountsStore } from '@/stores/bankAccounts'
import Storage from '@/utils/storage'

export default {
  setup() {
    const bankAccountsStore = useBankAccountsStore()
    return {
      createItem: bankAccountsStore.create
    }
  },
  data() {
    return {
      showPass: false,
      form: {
        title: '',
        account_name: '',
        account_number: '',
        iban: '',
        currency: '',
        password: ''
      }
    }
  },
  async created() {
    const storageFormData = await Storage.getItem('create_form')
    if (storageFormData !== null) {
      this.form = storageFormData
    }
  },
  methods: {
    async onSubmit() {
      if (!this.form.title) {
        this.$notifyError(this.$t('PleaseFillAllFields') || 'Please fill all required fields')
        return
      }
      const onSuccess = async () => {
        await this.createItem({ ...this.form })
        this.$router.push({ name: 'BankAccounts' })
      }
      this.$request(onSuccess, this.$waiters.BankAccounts.Create)
    },
    
    saveForm: function (event) {
      Storage.setItem('create_form', this.form)
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
