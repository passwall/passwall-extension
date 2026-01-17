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
        <div class="d-flex flex-content-between">
          <FormRowText
            v-model="form.title"
            title="title"
            :edit-mode="isEditMode"
            :show-icons="true"
          />
        </div>
        <div class="d-flex">
          <VTextArea
            :isEditable="isEditMode"
            v-model="form.note"
            label="Note"
            name="note"
            :disabled="!isEditMode"
            minheight="270"
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
  data() {
    return {
      form: {
        id: null,
        title: '',
        note: ''
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
      this.$router.push({ name: 'Notes' })
      return
    }

    let item = this.items.find((i) => i.id === itemId)

    if (!item) {
      try {
        await this.itemsStore.fetchItems({ type: ItemType.Note })
        item = this.items.find((i) => i.id === itemId)
      } catch (error) {
        console.error('Failed to fetch item:', error)
        this.$notifyError?.('Failed to load note')
        this.$router.push({ name: 'Notes' })
        return
      }
    }

    if (!item) {
      this.$notifyError?.('Note not found')
      this.$router.push({ name: 'Notes' })
      return
    }

    this.form = {
      id: item.id,
      title: item.title || item.metadata?.name || '',
      note: item.notes || item.note || ''
    }
  },

  methods: {
    goBack() {
      this.$router.push({ name: 'Notes', params: { cache: true } })
    },

    async onClickDelete() {
      if (!confirm('Are you sure you want to delete this note?')) return

      const itemId = parseInt(this.$route.params.id)
      try {
        await this.itemsStore.deleteItem(itemId)
        this.$notifySuccess?.('Note deleted successfully')
        this.$router.push({ name: 'Notes' })
      } catch (error) {
        console.error('Failed to delete note:', error)
        this.$notifyError?.('Failed to delete note')
      }
    },

    async onClickUpdate() {
      const itemId = parseInt(this.$route.params.id)

      if (!this.form.title) {
        this.$notifyError?.('Title is required')
        return
      }

      try {
        const noteData = {
          name: this.form.title,
          notes: this.form.note
        }
        const metadata = { name: this.form.title }

        const updated = await this.itemsStore.updateItem(itemId, {
          item_type: ItemType.Note,
          data: noteData,
          metadata
        })

        this.$notifySuccess?.('Note updated successfully')
        this.isEditMode = false

        this.itemsStore.setDetail(updated)
        this.form = {
          ...this.form,
          ...updated,
          title: updated.title || updated.metadata?.name || this.form.title,
          note: updated.notes || updated.note || this.form.note
        }
      } catch (error) {
        console.error('Failed to update note:', error)
        this.$notifyError?.('Failed to update note')
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
