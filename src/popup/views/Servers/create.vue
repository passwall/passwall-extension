<template>
  <div>
    <Header class="bg-black-400">
      <template v-slot:content>
        <VIcon class="c-pointer" name="arrow-left" @click="$router.back()" />
        <div class="d-flex flex-auto flex-items-center ml-4">
          <div class="new-logo">
            <VIcon name="logo-simple" height="40px" width="40px" />
          </div>
          <span class="fw-bold h5 ml-2">New Server</span>
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
          <label v-text="'IP Address'" />
          <VFormText
            name="IP Address"
            v-on:change="saveForm"
            v-model="form.ip"
            v-validate="'ip'"
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
              v-on:change="saveForm"
              class="flex-auto"
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
              v-on:change="saveForm"
              class="flex-auto"
              v-model="form.url"
              v-validate="'url'"
              :placeholder="$t('ClickToFill')"
              theme="no-border"
            />
            <LinkButton class="mr-3" :link="form.url" />
          </div>
        </div>

        <div class="form-row">
          <label v-text="'Hosting Username'" />
          <div class="d-flex flex-justify-between">
            <VFormText
              name="Hosting Username"
              v-on:change="saveForm"
              class="flex-auto"
              v-model="form.hosting_username"
              :placeholder="$t('ClickToFill')"
              theme="no-border"
            />
          </div>
        </div>

        <div class="form-row">
          <label v-text="'Hosting Password'" />
          <div class="d-flex flex-justify-between ">
            <VFormText
              name="Hosting Password"
              v-on:change="saveForm"
              class="flex-auto"
              v-model="form.hosting_password"
              :placeholder="$t('ClickToFill')"
              theme="no-border"
              :type="showHostingPass ? 'text' : 'password'"
            />
            <div class="d-flex flex-items-center mr-3">
              <GeneratePassword v-model="form.hosting_password" />
              <CheckPassword :password="form.hosting_password" />
              <ShowPassButton @click="showHostingPass = $event" />
              <ClipboardButton :copy="form.hosting_password" />
            </div>
          </div>
        </div>

        <div class="form-row">
          <label v-text="'Admin Username'" />
          <div class="d-flex flex-justify-between">
            <VFormText
              name="Admin Username"
              v-on:change="saveForm"
              class="flex-auto"
              v-model="form.admin_username"
              :placeholder="$t('ClickToFill')"
              theme="no-border"
            />
          </div>
        </div>

        <div class="form-row">
          <label v-text="'Admin Password'" />
          <div class="d-flex flex-justify-between ">
            <VFormText
              name="Admin Password"
              v-on:change="saveForm"
              class="flex-auto"
              v-model="form.admin_password"
              :placeholder="$t('ClickToFill')"
              theme="no-border"
              :type="showAdminPass ? 'text' : 'password'"
            />
            <div class="d-flex flex-items-center mr-3">
              <GeneratePassword v-model="form.admin_password" />
              <CheckPassword :password="form.admin_password" />
              <ShowPassButton @click="showAdminPass = $event" />
              <ClipboardButton :copy="form.admin_password" />
            </div>
          </div>
        </div>

        <div>
          <VTextArea 
            name="extra"
            v-on:change="saveForm"
            :placeholder="$t('ClickToFill')" 
            v-model="form.extra" 
            label="Extra" 
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
import { mapActions } from 'vuex'
import Storage from '@/utils/storage'

export default {
  data() {
    return {
      showPass: false,
      showHostingPass: false,
      showAdminPass: false,
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
      }
    }
  },
  async created() {
    const storageFormData = await Storage.getItem('create_form')
    if (storageFormData === null) {
      this.$browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        this.form.title = tabs[0].title
        this.form.url   = tabs[0].url
      })
    } else {
      this.form = storageFormData
    }
  },
  methods: {
    ...mapActions('Servers', ['Create']),
    async onSubmit() {
      if (!(await this.$validator.validateAll())) return
      const onSuccess = async () => {
        await this.Create({ ...this.form })
        this.$router.push({ name: 'Servers' })
      }
      this.$request(onSuccess, this.$waiters.Servers.Create)
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
