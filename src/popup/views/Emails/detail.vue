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
        <FormRowText v-model="form.email" title="email" :edit-mode="isEditMode" :show-icons="true" />
        <FormRowText
          v-model="form.password"
          title="password"
          :edit-mode="isEditMode"
          :show-icons="true"
          password
        />
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

export default {
  data() {
    return {
      form: {
        title: '',
        email: '',
        password: ''
      },
      isEditMode: false
    }
  },

  setup() {
    const itemsStore = useItemsStore()
    return {
      emailsStore,
      deleteItem: itemsStore.delete,
      updateItem: itemsStore.update
    }
  },

  computed: {
    ItemList() {
      return this.itemsStore?.itemList || []
    },
    loading() {
      return this.$wait.is(this.$waiters.Emails.Update)
    }
  },

  mounted() {
    let detail = this.itemsStore.detail
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
      this.$router.push({ name: 'Emails', params: { cache: true } })
    },

    onClickDelete() {
      const onSuccess = async () => {
        await this.deleteItem(this.form.id)
        const index = this.ItemList.findIndex(item => item.id == this.form.id)
        if (index !== -1) {
          this.ItemList.splice(index, 1)
        }
        this.$router.push({ name: 'Emails', params: { cache: true } })
      }
      if (confirm('Are you sure you want to delete'))
        this.$request(onSuccess, this.$waiters.Emails.Delete)
    },

    async onClickUpdate() {
      const onSuccess = async () => {
        const updated = await this.updateItem({ ...this.form })
        this.form = { ...this.form, ...updated }
        this.itemsStore.setDetail(updated)
      }

      await this.$request(onSuccess, this.$waiters.Emails.Update)
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
