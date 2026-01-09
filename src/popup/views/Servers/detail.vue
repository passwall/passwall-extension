<template>
  <div>
    <Header class="bg-black-400">
      <template v-slot:content>
        <div class="d-flex flex-items-center w-100">
          <VIcon class="c-pointer" name="arrow-left" @click="goBack" />
          <div class="d-flex flex-auto flex-items-center ml-3" style="min-width: 0; overflow: hidden;">
            <CompanyLogo :url="form.url" style="flex-shrink: 0;" />
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
        <FormRowText 
          v-model="form.title" 
          title="title" 
          :edit-mode="isEditMode" 
          :show-icons="true" />
        <FormRowText 
          v-model="form.ip" 
          title="ip" 
          :edit-mode="isEditMode" 
          :show-icons="true" />
        <FormRowText
          v-model="form.username"
          title="username"
          :edit-mode="isEditMode"
          :show-icons="true"
        />
        <FormRowText
          v-model="form.password"
          title="password"
          :edit-mode="isEditMode"
          :show-icons="true"
          password
        />
        <FormRowText v-model="form.url" title="website" :edit-mode="isEditMode" :show-icons="false">
          <template v-slot:second-icon>
            <LinkButton :link="form.url" />
            <ClipboardButton v-if="form.url" class="ml-2" :copy="form.url" />
          </template>
        </FormRowText>
        <FormRowText
          v-model="form.hosting_username"
          title="hosting username"
          :edit-mode="isEditMode"
          :show-icons="true"
        />
        <FormRowText
          v-model="form.hosting_password"
          title="hosting password"
          :edit-mode="isEditMode"
          :show-icons="true"
          password
        />
        <FormRowText
          v-model="form.admin_username"
          title="admin username"
          :edit-mode="isEditMode"
          :show-icons="true"
        />
        <FormRowText
          v-model="form.admin_password"
          title="admin password"
          :edit-mode="isEditMode"
          :show-icons="true"
          password
        />

        <div>
          <VTextArea
            v-model="form.extra"
            label="Extra"
            name="extra"
            :placeholder="$t(isEditMode ? 'ClickToFill' : 'ContentHidden')"
            :disabled="!isEditMode"
          />
        </div>
        <div class="d-flex px-3 mb-2" v-if="form.extra">
          <ClipboardButton :copy="form.extra" />
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

export default {
  data() {
    return {
      form: {
        title: '',
        ip: '',
        username: '',
        password: '',
        url: '',
        hosting_username: '',
        hosting_password: '',
        admin_username: '',
        admin_password: '',
        extra: ''
      },
      isEditMode: false,
      showPass: false
    }
  },

  setup() {
    const itemsStore = useItemsStore()
    return {
      serversStore,
      deleteItem: itemsStore.delete,
      updateItem: itemsStore.update
    }
  },

  computed: {
    ItemList() {
      return this.itemsStore?.itemList || []
    },
    loading() {
      return this.$wait.is(this.$waiters.Servers.Update)
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
      this.$router.push({ name: 'Servers', params: { cache: true } })
    },

    onClickDelete() {
      const onSuccess = async () => {
        await this.deleteItem(this.form.id)
        const index = this.ItemList.findIndex(item => item.id == this.form.id)
        if (index !== -1) {
          this.ItemList.splice(index, 1)
        }
        this.$router.push({ name: 'Servers', params: { cache: true } })
      }
      if (confirm('Are you sure you want to delete'))
        this.$request(onSuccess, this.$waiters.Servers.Delete)
    },

    async onClickUpdate() {
      const onSuccess = async () => {
        const updated = await this.updateItem({ ...this.form })
        this.form = { ...this.form, ...updated }
        this.itemsStore.setDetail(updated)
      }

      await this.$request(onSuccess, this.$waiters.Servers.Update)
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
