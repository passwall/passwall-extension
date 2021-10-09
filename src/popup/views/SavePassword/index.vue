<template>
  <div>
    <div class="d-flex flex-auto flex-items-center mt-2 ml-2">
      <span class="fw-bold h5 ml-2">New Logins</span>
    </div>

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
          <div class="d-flex flex-justify-between">
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

        <!-- Save & Cancel -->
        <div class="d-flex m-2">
          <VButton class="flex-1" theme="text" @click="cancel">
            {{ $t('Cancel') }}
          </VButton>
          <VButton class="flex-1" type="submit">
            {{ $t('Save') }}
          </VButton>
        </div>
      </form>
    </div>
  </div>
</template>

<script> 
import { mapActions } from 'vuex'
import Storage from '@/utils/storage'

export default {
  data() {
    return {
      showPass: false,
      form: {
        title: '',
        username: '',
        password: '',
        url: '',
        extra: ''
      },
      action: '',
      listener: null
    }
  },

  async created() {
    console.log('Passwall save password iframe initialized successfully.')

    const storageFormData = await Storage.getItem('create_form')
    if (storageFormData === null) {
      this.$browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        this.form.title = tabs[0].title
        this.form.url = tabs[0].url
      })
    } else {
      this.form = storageFormData
    }

    // Report iframe loaded
    //this.tell('iframe-loaded')

    // Listen incoming messages
    this.$browser.runtime.onMessage.addListener(this.background_onMessage)
  },
  methods: {
    ...mapActions('Logins', ['Create']),
    async onSubmit() {
      if (!(await this.$validator.validateAll())) return
      const onSuccess = async () => {
        await this.Create({ ...this.form })
        this.tell('close-iframe')
      }
      this.$request(onSuccess, this.$waiters.Logins.Create)
    },

    saveForm: function (event) {
      Storage.setItem('create_form', this.form)
    },

    cancel: function () {
      this.tell('close-iframe')
    },

    background_onMessage: function (request, sender, sendResponse) {
      // make sure the message was for this view (you can use the "*" wildcard to target all views)
      // if (!request.message || !request.data.view || (request.data.view != this.view && request.data.view != '*')) return;

      console.log("iframe'e gelen:" + request.message)

      this.processMessage(request.data)
    },

    processMessage: function (data) {
      this.form.username = data.username
      this.form.password = data.password
    },

    tell: function (message, data) {
      var data = data || {}

      window.parent.postMessage(
        {
          message: message,
          data: data
        },
        '*'
      )
    }
  }
}
</script>

<style lang="scss">
html,
body {
  background-color: $color-gray-500;
  scrollbar-width: none; /* Firefox */
}
</style>
