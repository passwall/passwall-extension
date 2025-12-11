<template>
  <div>
    <Header class="bg-black-400">
      <template v-slot:content>
        <div class="d-flex flex-items-center w-100">
          <VIcon class="c-pointer" name="arrow-left" @click="goBack" />
          <div class="d-flex flex-auto flex-items-center ml-3">
            <CompanyLogo :url="form.title" />
            <span class="title fw-bold h5 ml-2">{{ form.title }}</span>
          </div>
          <div class="d-flex">
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
        <FormRowText v-model="form.title" title="title" :edit-mode="isEditMode" :show-icons="false">
          <template v-slot:second-icon>
            <ClipboardButton v-if="form.title" :copy="form.title" />
          </template>
        </FormRowText>
        <FormRowText
          v-model="form.cardholder_name"
          title="cardholder name"
          :edit-mode="isEditMode"
          :show-icons="true"
        >
          <template v-slot:second-icon>
            <ClipboardButton v-if="form.cardholder_name" :copy="form.cardholder_name" />
          </template>
        </FormRowText>
        <FormRowText v-model="form.type" title="type" :edit-mode="isEditMode" :show-icons="true">
          <template v-slot:second-icon>
            <ClipboardButton v-if="form.type" :copy="form.type" />
          </template>
        </FormRowText>
        <FormRowText
          v-model="form.number"
          title="number"
          :edit-mode="isEditMode"
          :show-icons="true"
        >
          <template v-slot:second-icon>
            <ClipboardButton v-if="form.number" :copy="form.number" />
          </template>
        </FormRowText>
        <FormRowText
          v-model="form.expiry_date"
          title="expiry date"
          :edit-mode="isEditMode"
          :show-icons="true"
        >
          <template v-slot:second-icon>
            <ClipboardButton v-if="form.expiry_date" :copy="form.expiry_date" />
          </template>
        </FormRowText>
        <FormRowText
          v-model="form.verification_number"
          title="verification number"
          :edit-mode="isEditMode"
          :show-icons="true"
          password
        >
          <template v-slot:second-icon>
            <div class="d-flex flex-items-center">
              <ClipboardButton v-if="form.verification_number" :copy="form.verification_number" />
            </div>
          </template>
        </FormRowText>

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
import { useCreditCardsStore } from '@/stores/creditCards'

export default {
  data() {
    return {
      form: {
        title: '',
        cardholder_name: '',
        type: '',
        number: '',
        expiry_date: '',
        verification_number: ''
      },
      isEditMode: false,
      showPass: false
    }
  },

  setup() {
    const creditCardsStore = useCreditCardsStore()
    return {
      creditCardsStore,
      deleteItem: creditCardsStore.delete,
      updateItem: creditCardsStore.update
    }
  },

  computed: {
    ItemList() {
      return this.creditCardsStore?.itemList || []
    },
    loading() {
      return this.$wait.is(this.$waiters.CreditCards.Update)
    }
  },

  mounted() {
    let detail = this.creditCardsStore.detail
    if (!detail || !detail.id) {
      detail = this.$route.params.detail
    }
    if ((!detail || !detail.id) && this.$route.params.id) {
      detail = this.ItemList.find(i => i.id == this.$route.params.id)
    }
    if (detail && detail.id) {
      this.form = { ...this.form, ...detail }
    }
  },

  methods: {
    goBack() {
      this.$router.push({ name: 'CreditCards', params: { cache: true } })
    },

    onClickDelete() {
      const onSuccess = async () => {
        await this.deleteItem(this.form.id)
        const index = this.ItemList.findIndex(item => item.id == this.form.id)
        if (index !== -1) {
          this.ItemList.splice(index, 1)
        }
        this.$router.push({ name: 'CreditCards', params: { cache: true } })
      }
      if (confirm('Are you sure you want to delete'))
        this.$request(onSuccess, this.$waiters.CreditCards.Delete)
    },

    async onClickUpdate() {
      const onSuccess = async () => {
        const updated = await this.updateItem({ ...this.form })
        this.form = { ...this.form, ...updated }
        this.creditCardsStore.setDetail(updated)
      }

      await this.$request(onSuccess, this.$waiters.CreditCards.Update)
      this.isEditMode = false
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

  word-break: break-all;
}
</style>
