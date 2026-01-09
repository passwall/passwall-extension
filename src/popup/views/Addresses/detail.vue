<template>
  <div class="content">
    <Header class="bg-black-400">
      <template v-slot:content>
        <div class="d-flex flex-items-center w-100">
          <VIcon class="c-pointer" name="arrow-left" @click="goBack" />
          <div class="d-flex flex-auto flex-items-center ml-3" style="min-width: 0; overflow: hidden;">
            <span class="title fw-bold h5">{{ form.title }}</span>
          </div>
          <div class="d-flex" style="flex-shrink: 0;">
            <button v-tooltip="$t('Delete')" @click="showDeleteConfirm = true">
              <VIcon class="c-pointer trash" name="trash" />
            </button>
            <button v-if="!isEditMode" v-tooltip="$t('Edit')" @click="isEditMode = true">
              <VIcon class="c-pointer ml-2 cogs" name="cogs" />
            </button>
          </div>
        </div>
      </template>
    </Header>
    <div class="scroll detail">
      <form class="form" @submit.stop.prevent="onClickUpdate">
        <FormRowText v-model="form.title" title="title" :edit-mode="isEditMode" :show-icons="true" />
        <FormRowText v-model="form.first_name" title="first name" :edit-mode="isEditMode" :show-icons="true" />
        <FormRowText v-model="form.middle_name" title="middle name" :edit-mode="isEditMode" :show-icons="true" />
        <FormRowText v-model="form.last_name" title="last name" :edit-mode="isEditMode" :show-icons="true" />
        <FormRowText v-model="form.company" title="company" :edit-mode="isEditMode" :show-icons="true" />
        <FormRowText v-model="form.address1" title="address line 1" :edit-mode="isEditMode" :show-icons="true" />
        <FormRowText v-model="form.address2" title="address line 2" :edit-mode="isEditMode" :show-icons="true" />
        <FormRowText v-model="form.city" title="city" :edit-mode="isEditMode" :show-icons="true" />
        <FormRowText v-model="form.state" title="state" :edit-mode="isEditMode" :show-icons="true" />
        <FormRowText v-model="form.zip" title="zip" :edit-mode="isEditMode" :show-icons="true" />
        <FormRowText v-model="form.country" title="country" :edit-mode="isEditMode" :show-icons="true" />
        <FormRowText v-model="form.phone" title="phone" :edit-mode="isEditMode" :show-icons="true" />
        <FormRowText v-model="form.email" title="email" :edit-mode="isEditMode" :show-icons="true" />

        <div>
          <VTextArea
            v-model="form.notes"
            label="Notes"
            name="notes"
            :placeholder="$t(isEditMode ? 'ClickToFill' : 'ContentHidden')"
            :disabled="!isEditMode"
            minheight=110
          />
        </div>
        <div class="d-flex px-3 mb-2" v-if="form.notes">
          <ClipboardButton :copy="form.notes" />
        </div>

        <div class="d-flex m-2" v-if="isEditMode">
          <VButton class="flex-1" theme="text" :disabled="loading" @click="isEditMode = false">
            {{ $t('Cancel') }}
          </VButton>
          <VButton class="flex-1" type="submit" :loading="loading">
            {{ $t('Save') }}
          </VButton>
        </div>
      </form>
    </div>

    <ConfirmDialog
      v-model:show="showDeleteConfirm"
      title="Delete Address?"
      :message="deleteConfirmMessage"
      confirm-text="Delete"
      cancel-text="Cancel"
      confirm-theme="danger"
      icon="trash"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script>
import { useItemsStore, ItemType } from '@/stores/items'
import { storeToRefs } from 'pinia'

export default {
  name: 'AddressDetail',
  
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
      },
      isEditMode: false,
      showDeleteConfirm: false
    }
  },

  setup() {
    const itemsStore = useItemsStore()
    const { items } = storeToRefs(itemsStore)
    
    return {
      itemsStore,
      items
    }
  },

  computed: {
    loading() {
      return this.itemsStore.isLoading
    },
    deleteConfirmMessage() {
      const name = this.form.title || 'this address'
      return 'Are you sure you want to delete "' + name + '"?\n\nThis action cannot be undone.'
    }
  },

  async mounted() {
    const itemId = parseInt(this.$route.params.id)
    
    if (!itemId) {
      this.$router.push({ name: 'Addresses' })
      return
    }

    let item = this.items.find(i => i.id === itemId)
    
    if (!item) {
      try {
        await this.itemsStore.fetchItems({ type: ItemType.Address })
        item = this.items.find(i => i.id === itemId)
      } catch (error) {
        console.error('Failed to fetch item:', error)
        this.$notifyError?.('Failed to load address')
        this.$router.push({ name: 'Addresses' })
        return
      }
    }
    
    if (!item) {
      this.$notifyError?.('Address not found')
      this.$router.push({ name: 'Addresses' })
      return
    }

    this.form = {
      title: item.title || item.metadata?.name || '',
      first_name: item.first_name || '',
      middle_name: item.middle_name || '',
      last_name: item.last_name || '',
      company: item.company || '',
      address1: item.address1 || '',
      address2: item.address2 || '',
      city: item.city || '',
      state: item.state || '',
      zip: item.zip || '',
      country: item.country || '',
      phone: item.phone || '',
      email: item.email || '',
      notes: item.notes || ''
    }
  },

  methods: {
    goBack() {
      this.$router.push({ name: 'Addresses', params: { cache: true } })
    },

    async onClickUpdate() {
      const itemId = parseInt(this.$route.params.id)
      
      if (!this.form.title) {
        this.$notifyError?.('Title is required')
        return
      }

      try {
        const addressData = { ...this.form }
        const metadata = { name: this.form.title }

        await this.itemsStore.updateItem(itemId, {
          item_type: ItemType.Address,
          data: addressData,
          metadata
        })

        this.$notifySuccess?.('Address updated successfully')
        this.isEditMode = false
        
        // Refresh data
        await this.itemsStore.fetchItems({ type: ItemType.Address })
      } catch (error) {
        console.error('Failed to update address:', error)
        this.$notifyError?.('Failed to update address')
      }
    },

    async confirmDelete() {
      const itemId = parseInt(this.$route.params.id)

      try {
        await this.itemsStore.deleteItem(itemId)
        this.$notifySuccess?.('Address deleted successfully')
        this.$router.push({ name: 'Addresses' })
      } catch (error) {
        console.error('Failed to delete address:', error)
        this.$notifyError?.('Failed to delete address')
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.detail {
  .form {
    padding-bottom: 50px;
  }
}

.title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trash {
  color: $color-danger !important;
}

.cogs {
  color: $color-secondary !important;
}
</style>


