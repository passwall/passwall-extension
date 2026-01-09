<template>
  <div class="detail-layout">
    <div class="detail-header d-flex flex-items-center px-3">
      <VIcon class="c-pointer" name="arrow-left" @click="goBack" />
      <span class="fs-large fw-semibold ml-3">New Address</span>
    </div>

    <form @submit.prevent="onSubmit" class="form px-3">
      <label class="mt-4">Title *</label>
      <VFormText v-model="form.title" name="title" size="medium" placeholder="e.g., Home Address" />

      <label class="mt-4">First Name</label>
      <VFormText v-model="form.first_name" name="first_name" size="medium" />

      <label class="mt-4">Middle Name</label>
      <VFormText v-model="form.middle_name" name="middle_name" size="medium" />

      <label class="mt-4">Last Name</label>
      <VFormText v-model="form.last_name" name="last_name" size="medium" />

      <label class="mt-4">Company</label>
      <VFormText v-model="form.company" name="company" size="medium" />

      <label class="mt-4">Address Line 1</label>
      <VFormText v-model="form.address1" name="address1" size="medium" />

      <label class="mt-4">Address Line 2</label>
      <VFormText v-model="form.address2" name="address2" size="medium" />

      <label class="mt-4">City</label>
      <VFormText v-model="form.city" name="city" size="medium" />

      <label class="mt-4">State/Province</label>
      <VFormText v-model="form.state" name="state" size="medium" />

      <label class="mt-4">ZIP/Postal Code</label>
      <VFormText v-model="form.zip" name="zip" size="medium" />

      <label class="mt-4">Country</label>
      <VFormText v-model="form.country" name="country" size="medium" />

      <label class="mt-4">Phone</label>
      <VFormText v-model="form.phone" name="phone" size="medium" />

      <label class="mt-4">Email</label>
      <VFormText v-model="form.email" name="email" size="medium" type="email" />

      <label class="mt-4">Notes</label>
      <VTextarea v-model="form.notes" :rows="3" />

      <div class="d-flex mt-5 pb-4">
        <VButton class="flex-1" size="medium" type="submit">
          {{ $t('Save') }}
        </VButton>
      </div>
    </form>
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
    goBack() {
      this.$router.push({ name: 'Addresses' })
    },

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

<style lang="scss" scoped>
.detail-layout {
  height: 100vh;
  overflow-y: auto;
}

.detail-header {
  height: 64px;
  border-bottom: 2px solid $color-black;
}

.form {
  label {
    font-size: 14px;
    font-weight: 600;
    color: $color-white;
    display: block;
    margin-bottom: 8px;
  }
}
</style>


