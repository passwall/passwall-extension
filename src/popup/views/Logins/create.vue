<template>
  <div>
    <Header class="bg-black-400">
      <template v-slot:content>
        <VIcon class="c-pointer" name="arrow-left" @click="$router.back()" />
        <div class="d-flex flex-auto flex-items-center ml-4">
          <div class="new-logo">
            <VIcon name="logo-simple" height="40px" width="40px" />
          </div>
          <span class="fw-bold h5 ml-2">New Login</span>
        </div>
      </template>
    </Header>
    <div class="scroll">
      <form @submit.prevent="onSubmit" class="create-form">
        <div class="form-row">
          <label v-text="'Title'" />
          <VFormText
            name="Title"
            v-on:change="saveForm"
            v-model="form.title"
            v-validate="'required'"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Username'" />
          <VFormText
            name="Username"
            v-on:change="saveForm"
            v-model="form.username"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Password'" />
          <div class="d-flex flex-justify-between ">
            <VFormText
              name="Password"
              class="flex-auto"
              v-on:change="saveForm"
              v-model="form.password"
              :placeholder="$t('ClickToFill')"
              theme="no-border"
              :type="showPass ? 'text' : 'password'"
            />
            <div class="d-flex flex-items-center mr-3">
              <GeneratePassword v-model="form.password" />
              <CheckPassword :password="form.password" />
              <ShowPassButton @click="showPass = $event" />
              <ClipboardButton :copy="form.password" />
            </div>
          </div>
        </div>
        
        <div class="form-row">
          <label v-text="'Website'" />
          <div class="d-flex flex-justify-between">
            <VFormText
              name="Web Site"
              class="flex-auto"
              v-on:change="saveForm"
              v-model="form.url"
              v-validate="'url'"
              :placeholder="$t('ClickToFill')"
              theme="no-border"
            />
            <LinkButton class="mr-3" :link="form.url" />
          </div>
        </div>

        <div>
          <VTextArea 
            :placeholder="$t('ClickToFill')" 
            v-on:change="saveForm"
            v-model="form.extra" 
            label="Extra" 
            name="extra" 
            isEditable
          />
        </div>

        <VButton
          class="mx-2 my-2"
          size="medium"
          type="submit"
          style="letter-spacing: 2px"
          :loading="$wait.is($waiters.Logins.Create)"
        >
          Save
        </VButton>
      </form>
    </div>
  </div>
</template>

<script>
import { useLoginsStore } from '@/stores/logins'
import Storage from '@/utils/storage'

export default {
  setup() {
    const loginsStore = useLoginsStore()
    
    return {
      createLogin: loginsStore.create
    }
  },
  data() {
    return {
      showPass: false,
      form: {
        title: '',
        username: '',
        password: '',
        url: '',
        extra: ''
      }
    }
  },
  async created() {
    const storageFormData = await Storage.getItem('create_form')
    if (storageFormData === null) {
      this.$browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        if (tabs[0].url !== 'chrome://newtab/') {
          this.form.title = tabs[0].title
          this.form.url   = tabs[0].url
        }
      })
    } else {
      this.form = storageFormData
    }
  },
  methods: {
    async onSubmit() {
      // Basic required: title
      if (!this.form.title) {
        this.$notifyError(this.$t('PleaseFillAllFields') || 'Please fill all required fields')
        return
      }
      const onSuccess = async () => {
        await this.createLogin({ ...this.form })
        this.$router.push({ name: 'Logins' })
      }
      this.$request(onSuccess, this.$waiters.Logins.Create)
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
