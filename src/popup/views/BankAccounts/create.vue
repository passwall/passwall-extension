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
      <form @submit.prevent="onSubmit" class="create-form pw-form-standard">
        <div class="form-row">
          <label v-text="'Title'" />
          <VFormText
            name="title"
            class="pw-input"
            v-on:change="saveForm"
            v-model="form.title"
            v-validate="'required'"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'First Name'" />
          <VFormText
            name="first name"
            class="pw-input"
            v-on:change="saveForm"
            v-model="form.first_name"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Last Name'" />
          <VFormText
            name="last name"
            class="pw-input"
            v-on:change="saveForm"
            v-model="form.last_name"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Bank Name'" />
          <VFormText
            name="bank name"
            class="pw-input"
            v-on:change="saveForm"
            v-model="form.bank_name"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Account Type'" />
          <VFormText
            name="account type"
            class="pw-input"
            v-on:change="saveForm"
            v-model="form.account_type"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Account Number'" />
          <VFormText
            name="account number"
            class="pw-input"
            v-on:change="saveForm"
            v-model="form.account_number"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'IBAN Number'" />
          <VFormText
            name="iban number"
            class="pw-input"
            v-on:change="saveForm"
            v-model="form.iban_number"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'PIN'" />
          <div class="d-flex flex-justify-between pw-row">
            <VFormText
              name="PIN"
              v-on:change="saveForm"
              class="flex-auto pw-input"
              v-model="form.pin"
              :placeholder="$t('ClickToFill')"
              theme="no-border"
              :type="showPass ? 'text' : 'password'"
            />
            <div class="d-flex flex-items-center mr-3 pw-icons">
              <ClipboardButton :copy="form.pin" />
              <ShowPassButton @click="showPass = $event" />
            </div>
          </div>
        </div>

        <VButton
          class="mx-2 my-2"
          size="medium"
          type="submit"
          style="letter-spacing: 2px"
        >
          Save
        </VButton>
      </form>
    </div>
  </div>
</template>

<script>
import { useItemsStore, ItemType } from '@/stores/items'
import Storage from '@/utils/storage'

export default {
  name: 'BankAccountCreate',
  
  setup() {
    const itemsStore = useItemsStore()
    return {
      itemsStore
    }
  },
  
  data() {
    return {
      showPass: false,
      form: {
        title: '',
        first_name: '',
        last_name: '',
        bank_name: '',
        account_type: '',
        routing_number: '',
        account_number: '',
        swift_code: '',
        iban_number: '',
        pin: '',
        branch_address: '',
        branch_phone: '',
        notes: ''
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
        this.$notifyError?.('Title is required')
        return
      }
      
      try {
        const bankData = { ...this.form }
        const metadata = { name: this.form.title, category: this.form.account_type }

        await this.itemsStore.encryptAndCreate(ItemType.Bank, bankData, metadata)
        
        this.$notifySuccess?.('Bank account created successfully')
        Storage.setItem('create_form', null)
        this.$router.push({ name: 'BankAccounts' })
      } catch (error) {
        console.error('Failed to create bank account:', error)
        this.$notifyError?.('Failed to create bank account')
      }
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
