<template>
  <div>
    <Header class="bg-black-400">
      <template v-slot:content>
        <div class="d-flex flex-items-center w-100">
          <VIcon class="c-pointer" name="arrow-left" @click="goBack" />
          <div
            class="d-flex flex-auto flex-items-center ml-3"
            style="min-width: 0; overflow: hidden"
          >
            <CompanyLogo :url="form.title" style="flex-shrink: 0" />
            <span class="title fw-bold h5 ml-2">{{ form.title }}</span>
          </div>
          <div class="d-flex" style="flex-shrink: 0">
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
        <FormRowText
          v-model="form.title"
          title="title"
          :edit-mode="isEditMode"
          :show-icons="true"
        />
        <FormRowText
          v-model="form.name_on_card"
          title="name on card"
          :edit-mode="isEditMode"
          :show-icons="true"
        />
        <FormRowText
          v-model="form.card_type"
          title="card type"
          :edit-mode="isEditMode"
          :show-icons="true"
        />
        <FormRowText
          v-model="form.card_number"
          title="card number"
          :edit-mode="isEditMode"
          :show-icons="true"
        />
        <FormRowText
          v-model="form.exp_month"
          title="exp month"
          :edit-mode="isEditMode"
          :show-icons="true"
        />
        <FormRowText
          v-model="form.exp_year"
          title="exp year"
          :edit-mode="isEditMode"
          :show-icons="true"
        />
        <FormRowText
          v-model="form.security_code"
          title="security code (CVV)"
          :edit-mode="isEditMode"
          :show-icons="true"
          password
        />

        <div>
          <VTextArea
            v-model="form.notes"
            label="Notes"
            name="notes"
            :disabled="!isEditMode"
            minheight="110"
          />
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
  name: 'PaymentCardDetail',

  data() {
    return {
      form: {
        id: null,
        title: '',
        name_on_card: '',
        card_type: '',
        card_number: '',
        exp_month: '',
        exp_year: '',
        security_code: '',
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
      this.$router.push({ name: 'PaymentCards' })
      return
    }

    let item = this.items.find((i) => i.id === itemId)

    if (!item) {
      try {
        await this.itemsStore.fetchItems({ type: ItemType.Card })
        item = this.items.find((i) => i.id === itemId)
      } catch (error) {
        console.error('Failed to fetch item:', error)
        this.$notifyError?.('Failed to load card')
        this.$router.push({ name: 'PaymentCards' })
        return
      }
    }

    if (!item) {
      this.$notifyError?.('Card not found')
      this.$router.push({ name: 'PaymentCards' })
      return
    }

    this.form = {
      id: item.id,
      title: item.title || item.name || item.metadata?.name || '',
      name_on_card: item.name_on_card || '',
      card_type: item.card_type || '',
      card_number: item.card_number || '',
      exp_month: item.exp_month || '',
      exp_year: item.exp_year || '',
      security_code: item.security_code || '',
      notes: item.notes || ''
    }
  },

  methods: {
    goBack() {
      this.$router.push({ name: 'PaymentCards', params: { cache: true } })
    },

    async onClickDelete() {
      if (!confirm('Are you sure you want to delete this card?')) return

      const itemId = parseInt(this.$route.params.id)
      try {
        await this.itemsStore.deleteItem(itemId)
        this.$notifySuccess?.('Card deleted successfully')
        this.$router.push({ name: 'PaymentCards' })
      } catch (error) {
        console.error('Failed to delete card:', error)
        this.$notifyError?.('Failed to delete card')
      }
    },

    async onClickUpdate() {
      const itemId = parseInt(this.$route.params.id)

      if (!this.form.title) {
        this.$notifyError?.('Title is required')
        return
      }

      try {
        const cardData = { ...this.form }
        const metadata = { name: this.form.title, brand: this.form.card_type }

        const updated = await this.itemsStore.updateItem(itemId, {
          item_type: ItemType.Card,
          data: cardData,
          metadata
        })

        this.$notifySuccess?.('Card updated successfully')
        this.isEditMode = false

        this.itemsStore.setDetail(updated)
        this.form = {
          ...this.form,
          ...updated,
          title: updated.title || updated.metadata?.name || this.form.title
        }
      } catch (error) {
        console.error('Failed to update card:', error)
        this.$notifyError?.('Failed to update card')
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
