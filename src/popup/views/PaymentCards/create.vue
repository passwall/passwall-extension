<template>
  <div>
    <Header class="bg-black-400">
      <template v-slot:content>
        <VIcon class="c-pointer" name="arrow-left" @click="$router.back()" />
        <div class="d-flex flex-auto flex-items-center ml-4">
          <div class="new-logo">
            <VIcon name="logo-simple" height="40px" width="40px" />
          </div>
          <span class="fw-bold h5 ml-2">New Payment Card</span>
        </div>
      </template>
    </Header>
    <div class="scroll">
      <form @submit.prevent="onSubmit" class="create-form pw-form-standard">
        <div class="form-row">
          <label v-text="'Title'" />
          <VFormText
            name="Title"
            class="pw-input"
            v-on:change="saveForm"
            v-model="form.title"
            v-validate="'required'"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Name on Card'" />
          <VFormText
            name="Name on Card"
            class="pw-input"
            v-on:change="saveForm"
            v-model="form.name_on_card"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Card Type'" />
          <VFormText
            name="Card Type"
            class="pw-input"
            v-on:change="saveForm"
            v-model="form.card_type"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Card Number'" />
          <VFormText
            name="Card Number"
            class="pw-input"
            v-on:change="saveForm"
            v-model="form.card_number"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Expiration Month'" />
          <VFormText
            name="Expiration Month"
            class="pw-input"
            v-on:change="saveForm"
            v-model="form.exp_month"
            placeholder="MM"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Expiration Year'" />
          <VFormText
            name="Expiration Year"
            class="pw-input"
            v-on:change="saveForm"
            v-model="form.exp_year"
            placeholder="YYYY"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Security Code (CVV)'" />
          <div class="d-flex flex-justify-between pw-row">
            <VFormText
              name="Security Code"
              v-on:change="saveForm"
              class="flex-auto pw-input"
              v-model="form.security_code"
              :placeholder="$t('ClickToFill')"
              theme="no-border"
              :type="showPass ? 'text' : 'password'"
            />
            <div class="d-flex flex-items-center mr-3 pw-icons">
              <ClipboardButton :copy="form.security_code" />
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
  name: 'PaymentCardCreate',
  
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
        name_on_card: '',
        card_type: '',
        card_number: '',
        exp_month: '',
        exp_year: '',
        security_code: ''
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
        const cardData = { ...this.form }
        const metadata = { name: this.form.title, brand: this.form.card_type }

        await this.itemsStore.encryptAndCreate(ItemType.Card, cardData, metadata)
        
        this.$notifySuccess?.('Payment card created successfully')
        Storage.setItem('create_form', null)
        this.$router.push({ name: 'PaymentCards' })
      } catch (error) {
        console.error('Failed to create card:', error)
        this.$notifyError?.('Failed to create payment card')
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
