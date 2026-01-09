<template>
  <div>
    <Header class="bg-black-400">
      <template v-slot:content>
        <div class="d-flex flex-items-center w-100">
          <VIcon class="c-pointer" name="arrow-left" @click="goBack" />
          <div class="d-flex flex-auto flex-items-center ml-3" style="min-width: 0; overflow: hidden;">
            <CompanyLogo :url="form.title" style="flex-shrink: 0;" />
            <span class="title fw-bold h5 ml-2">{{ form.title }}</span>
          </div>
          <div class="d-flex" style="flex-shrink: 0;">
            <!-- Delete Btn -->
            <button v-tooltip="$t('Delete')" @click="onClickDelete">
              <VIcon class="c-pointer trash" name="trash" />
            </button>

            <!-- Edit Btn -->
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
        <FormRowText
          v-model="form.first_name"
          title="first name"
          :edit-mode="isEditMode"
          :show-icons="true"
        />
        <FormRowText
          v-model="form.last_name"
          title="last name"
          :edit-mode="isEditMode"
          :show-icons="true"
        />
        <FormRowText
          v-model="form.bank_name"
          title="bank name"
          :edit-mode="isEditMode"
          :show-icons="true"
        />
        <FormRowText
          v-model="form.account_type"
          title="account type"
          :edit-mode="isEditMode"
          :show-icons="true"
        />
        <FormRowText
          v-model="form.routing_number"
          title="routing number"
          :edit-mode="isEditMode"
          :show-icons="true"
        />
        <FormRowText
          v-model="form.account_number"
          title="account number"
          :edit-mode="isEditMode"
          :show-icons="true"
        />
        <FormRowText
          v-model="form.swift_code"
          title="SWIFT code"
          :edit-mode="isEditMode"
          :show-icons="true"
        />
        <FormRowText
          v-model="form.iban_number"
          title="IBAN number"
          :edit-mode="isEditMode"
          :show-icons="true"
        />
        <FormRowText
          v-model="form.pin"
          title="PIN"
          :edit-mode="isEditMode"
          :show-icons="true"
          password
        />
        <FormRowText
          v-model="form.branch_address"
          title="branch address"
          :edit-mode="isEditMode"
          :show-icons="true"
        />
        <FormRowText
          v-model="form.branch_phone"
          title="branch phone"
          :edit-mode="isEditMode"
          :show-icons="true"
        />
        
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
        <!-- Save & Cancel -->
        <div class="d-flex m-3" v-if="isEditMode">
          <VButton class="flex-1" theme="text" :disabled="loading" @click="isEditMode = false">
            {{ $t('Cancel') }}
          </VButton>
          <VButton class="flex-1" type="submit" :loading="loading">
            {{ $t('Save') }}
          </VButton>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { useItemsStore, ItemType } from '@/stores/items'
import { storeToRefs } from 'pinia'

export default {
  data() {
    return {
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
      },
      isEditMode: false
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
    }
  },

  async mounted() {
    const itemId = parseInt(this.$route.params.id)
    
    if (!itemId) {
      this.$router.push({ name: 'BankAccounts' })
      return
    }

    let item = this.items.find(i => i.id === itemId)
    
    if (!item) {
      try {
        await this.itemsStore.fetchItems({ type: ItemType.Bank })
        item = this.items.find(i => i.id === itemId)
      } catch (error) {
        console.error('Failed to fetch item:', error)
        this.$notifyError?.('Failed to load bank account')
        this.$router.push({ name: 'BankAccounts' })
        return
      }
    }
    
    if (!item) {
      this.$notifyError?.('Bank account not found')
      this.$router.push({ name: 'BankAccounts' })
      return
    }

    this.form = {
      title: item.title || item.name || item.metadata?.name || '',
      first_name: item.first_name || '',
      last_name: item.last_name || '',
      bank_name: item.bank_name || '',
      account_type: item.account_type || '',
      routing_number: item.routing_number || '',
      account_number: item.account_number || '',
      swift_code: item.swift_code || '',
      iban_number: item.iban_number || '',
      pin: item.pin || '',
      branch_address: item.branch_address || '',
      branch_phone: item.branch_phone || '',
      notes: item.notes || ''
    }
  },

  methods: {
    goBack() {
      this.$router.push({ name: 'BankAccounts', params: { cache: true } })
    },

    async onClickDelete() {
      if (!confirm('Are you sure you want to delete this bank account?')) return
      
      const itemId = parseInt(this.$route.params.id)
      try {
        await this.itemsStore.deleteItem(itemId)
        this.$notifySuccess?.('Bank account deleted successfully')
        this.$router.push({ name: 'BankAccounts' })
      } catch (error) {
        console.error('Failed to delete bank account:', error)
        this.$notifyError?.('Failed to delete bank account')
      }
    },

    async onClickUpdate() {
      const itemId = parseInt(this.$route.params.id)
      
      if (!this.form.title) {
        this.$notifyError?.('Title is required')
        return
      }

      try {
        const bankData = { ...this.form }
        const metadata = { name: this.form.title, category: this.form.account_type }

        await this.itemsStore.updateItem(itemId, {
          item_type: ItemType.Bank,
          data: bankData,
          metadata
        })

        this.$notifySuccess?.('Bank account updated successfully')
        this.isEditMode = false
        
        await this.itemsStore.fetchItems({ type: ItemType.Bank })
      } catch (error) {
        console.error('Failed to update bank account:', error)
        this.$notifyError?.('Failed to update bank account')
      }
    }
  }
}
</script>

<style lang="scss">
.trash {
  color: $color-danger;
}
.cogs {
  color: #ffffff;
}
.title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
