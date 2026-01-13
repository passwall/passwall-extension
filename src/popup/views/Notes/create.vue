<template>
  <div>
    <Header class="bg-black-400">
      <template v-slot:content>
        <VIcon class="c-pointer" name="arrow-left" @click="$router.back()" />
        <div class="d-flex flex-auto flex-items-center ml-4">
          <div class="new-logo">
            <VIcon name="logo-simple" height="40px" width="40px" />
          </div>
          <span class="fw-bold h5 ml-2">New Note</span>
        </div>
      </template>
    </Header>
    <div class="scroll">
      <form @submit.prevent="onSubmit" class="create-form pw-form-standard">
        <div class="form-row">
          <label v-text="'Title'" />
          <VFormText
            name="Title"
            class="pw-input"
            v-on:change="saveForm"
            v-model="form.title"
            v-validate="'required'"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div>
          <VTextArea
            name="note"
            v-on:change="saveForm"
            :placeholder="$t('ClickToFill')"
            v-model="form.note"
            label="Note"
            isEditable
            minheight=220
          />
        </div>

        <VButton
          class="mx-2 my-2"
          size="medium"
          type="submit"
          style="letter-spacing: 2px"
          :loading="$wait.is($waiters.Notes.Create)"
        >
          Save
        </VButton>
      </form>
    </div>
  </div>
</template>

<script>
import { useItemsStore, ItemType } from '@/stores/items'
import Storage from '@/utils/storage'

export default {
  name: 'NoteCreate',
  
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
        note: ''
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
    async onSubmit() {
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

        await this.itemsStore.encryptAndCreate(ItemType.Note, noteData, metadata)
        
        this.$notifySuccess?.('Note created successfully')
        Storage.setItem('create_form', null)
        this.$router.push({ name: 'Notes' })
      } catch (error) {
        console.error('Failed to create note:', error)
        this.$notifyError?.('Failed to create note')
      }
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
