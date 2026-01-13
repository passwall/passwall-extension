<template>
  <div>
    <Header class="bg-black-400">
      <template v-slot:content>
        <VIcon class="c-pointer" name="arrow-left" @click="$router.back()" />
        <div class="d-flex flex-auto flex-items-center ml-4">
          <div class="new-logo">
            <VIcon name="logo-simple" height="40px" width="40px" />
          </div>
          <span class="fw-bold h5 ml-2">New Address</span>
        </div>
      </template>
    </Header>
    <div class="scroll">
      <form @submit.prevent="onSubmit" class="create-form pw-form-standard">
        <div class="form-row">
          <label>Title *</label>
          <VFormText
            v-model="form.title"
            name="title"
            placeholder="e.g., Home Address"
            theme="no-border"
            class="pw-input"
          />
        </div>

        <div class="form-row">
          <label>First Name</label>
          <VFormText v-model="form.first_name" name="first_name" theme="no-border" class="pw-input" />
        </div>

        <div class="form-row">
          <label>Middle Name</label>
          <VFormText v-model="form.middle_name" name="middle_name" theme="no-border" class="pw-input" />
        </div>

        <div class="form-row">
          <label>Last Name</label>
          <VFormText v-model="form.last_name" name="last_name" theme="no-border" class="pw-input" />
        </div>

        <div class="form-row">
          <label>Company</label>
          <VFormText v-model="form.company" name="company" theme="no-border" class="pw-input" />
        </div>

        <div class="form-row">
          <label>Address Line 1</label>
          <VFormText v-model="form.address1" name="address1" theme="no-border" class="pw-input" />
        </div>

        <div class="form-row">
          <label>Address Line 2</label>
          <VFormText v-model="form.address2" name="address2" theme="no-border" class="pw-input" />
        </div>

        <div class="form-row">
          <label>City</label>
          <VFormText v-model="form.city" name="city" theme="no-border" class="pw-input" />
        </div>

        <div class="form-row">
          <label>State/Province</label>
          <VFormText v-model="form.state" name="state" theme="no-border" class="pw-input" />
        </div>

        <div class="form-row">
          <label>ZIP/Postal Code</label>
          <VFormText v-model="form.zip" name="zip" theme="no-border" class="pw-input" />
        </div>

        <div class="form-row">
          <label>Country</label>
          <VFormText v-model="form.country" name="country" theme="no-border" class="pw-input" />
        </div>

        <div class="form-row">
          <label>Phone</label>
          <VFormText v-model="form.phone" name="phone" theme="no-border" class="pw-input" />
        </div>

        <div class="form-row">
          <label>Email</label>
          <VFormText v-model="form.email" name="email" type="email" theme="no-border" class="pw-input" />
        </div>

        <div>
          <VTextArea
            v-model="form.notes"
            label="Notes"
            name="notes"
            isEditable
            minheight="80"
            :placeholder="$t('ClickToFill')"
          />
        </div>

        <VButton class="mx-2 my-2" size="medium" type="submit">
          {{ $t('Save') }}
        </VButton>
      </form>
    </div>
  </div>
</template>

<script>
import { useItemsStore, ItemType } from '@/stores/items'

export default {
  name: 'AddressCreate',
  
  setup() {
    const itemsStore = useItemsStore()
    return {
      itemsStore
    }
  },

  data() {
    return {
      form: {
        title: '',
        first_name: '',
        middle_name: '',
        last_name: '',
        company: '',
        address1: '',
        address2: '',
        city: '',
        state: '',
        zip: '',
        country: '',
        phone: '',
        email: '',
        notes: ''
      }
    }
  },

  methods: {
    async onSubmit() {
      if (!this.form.title) {
        this.$notifyError?.('Title is required')
        return
      }

      try {
        const addressData = { ...this.form }
        const metadata = { name: this.form.title }

        await this.itemsStore.encryptAndCreate(ItemType.Address, addressData, metadata)
        
        this.$notifySuccess?.('Address created successfully')
        this.$router.push({ name: 'Addresses' })
      } catch (error) {
        console.error('Failed to create address:', error)
        this.$notifyError?.('Failed to create address')
      }
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


