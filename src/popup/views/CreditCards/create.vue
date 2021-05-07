<template>
  <div>
    <Header class="bg-black-400">
      <template v-slot:content>
        <VIcon class="c-pointer" name="arrow-left" @click="$router.back()" />
        <div class="d-flex flex-auto flex-items-center ml-4">
          <div class="new-logo">
            <VIcon name="logo-simple" height="40px" width="40px" />
          </div>
          <span class="fw-bold h5 ml-2">New Credit Card</span>
        </div>
      </template>
    </Header>
    <div class="scroll">
      <form @submit.prevent="onSubmit" class="create-form">
        <div class="form-row">
          <label v-text="'Title'" />
          <VFormText
            name="Title"
            v-on:change="saveForm"
            v-model="form.title"
            v-validate="'required'"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Card Holder Name'" />
          <VFormText
            name="Card Holder Name"
            v-on:change="saveForm"
            v-model="form.cardholder_name"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Type'" />
          <VFormText
            name="Type"
            v-on:change="saveForm"
            v-model="form.type"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Number'" />
          <VFormText
            name="Number"
            v-on:change="saveForm"
            v-model="form.number"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Expiration Date'" />
          <VFormText
            name="Expiration Date"
            v-on:change="saveForm"
            v-model="form.expiry_date"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>
        <div class="form-row">
          <label v-text="'Verification Number'" />
          <div class="d-flex flex-justify-between ">
            <VFormText
              name="Verification Number"
              v-on:change="saveForm"
              class="flex-auto"
              v-model="form.verification_number"
              :placeholder="$t('ClickToFill')"
              theme="no-border"
              :type="showPass ? 'text' : 'password'"
            />
            <div class="d-flex flex-items-center mr-3">
              <ClipboardButton :copy="form.verification_number" />
              <ShowPassButton @click="showPass = $event" />
            </div>
          </div>
        </div>

        <VButton
          class="mx-2 my-2"
          size="medium"
          type="submit"
          style="letter-spacing: 2px"
          :loading="$wait.is($waiters.CreditCards.Create)"
        >
          Save
        </VButton>
      </form>
    </div>
  </div>
</template>

<script>
import { mapActions } from 'vuex'
import Storage from '@/utils/storage'

export default {
  data() {
    return {
      showPass: false,
      form: {
        title: '',
        cardholder_name: '',
        type: '',
        number: '',
        expiry_date: '',
        verification_number: ''
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
    ...mapActions('CreditCards', ['Create']),
    async onSubmit() {
      if (!(await this.$validator.validateAll())) return
      const onSuccess = async () => {
        await this.Create({ ...this.form })
        this.$router.push({ name: 'CreditCards' })
      }
      this.$request(onSuccess, this.$waiters.CreditCards.Create)
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
