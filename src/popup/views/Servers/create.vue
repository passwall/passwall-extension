<template>
  <div>
    <Header class="bg-black-400">
      <template v-slot:content>
        <VIcon class="c-pointer" name="arrow-left" @click="$router.back()" />
        <div class="d-flex flex-auto flex-items-center ml-4">
          <div class="new-logo">
            <VIcon name="logo-simple" height="40px" width="40px" />
          </div>
          <span class="fw-bold h5 ml-2">New</span>
        </div>
        <div>
          <VIcon class="c-pointer trash" name="trash" />
          <VIcon class="c-pointer ml-3" name="cogs" />
        </div>
      </template>
    </Header>
    <div class="scroll">
      <form @submit.prevent="onSubmit" class="create-form">
        <div class="form-row">
          <label v-text="'Title'" />
          <VFormText
            name="Title"
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
            v-model="form.ip"
            v-validate="'required'"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Username'" />
          <VFormText
            name="Username"
            v-model="form.username"
            v-validate="'required'"
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
              v-model="form.password"
              v-validate="'required'"
              :placeholder="$t('ClickToFill')"
              theme="no-border"
              :type="showPass ? 'text' : 'password'"
            />
            <div class="d-flex flex-items-center mr-3">
              <GeneratePassword v-model="form.password" />
              <ClipboardButton :copy="form.password" />
              <ShowPassButton @click="showPass = $event" />
            </div>
          </div>
        </div>

        <div class="form-row">
          <label v-text="'Website'" />
          <div class="d-flex flex-justify-between">
            <VFormText
              name="Web Site"
              class="flex-auto"
              v-model="form.url"
              v-validate="'required'"
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
              class="flex-auto"
              v-model="form.hosting_username"
              v-validate="'required'"
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
              class="flex-auto"
              v-model="form.hosting_password"
              v-validate="'required'"
              :placeholder="$t('ClickToFill')"
              theme="no-border"
              :type="showHostingPass ? 'text' : 'password'"
            />
            <div class="d-flex flex-items-center mr-3">
              <GeneratePassword v-model="form.hosting_password" />
              <ClipboardButton :copy="form.hosting_password" />
              <ShowPassButton @click="showHostingPass = $event" />
            </div>
          </div>
        </div>

        <div class="form-row">
          <label v-text="'Admin Username'" />
          <div class="d-flex flex-justify-between">
            <VFormText
              name="Admin Username"
              class="flex-auto"
              v-model="form.admin_username"
              v-validate="'required'"
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
              class="flex-auto"
              v-model="form.admin_password"
              v-validate="'required'"
              :placeholder="$t('ClickToFill')"
              theme="no-border"
              :type="showAdminPass ? 'text' : 'password'"
            />
            <div class="d-flex flex-items-center mr-3">
              <GeneratePassword v-model="form.admin_password" />
              <ClipboardButton :copy="form.admin_password" />
              <ShowPassButton @click="showAdminPass = $event" />
            </div>
          </div>
        </div>

        <div>
          <VTextArea 
            :placeholder="$t('ClickToFill')" 
            v-model="form.extra" 
            label="Extra" 
            name="extra" 
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
        hosting_username: '',
        hosting_password: '',
        admin_username: '',
        admin_password: '',
        extra: ''
      }
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
    }
  }
}
</script>

<style lang="scss">
.trash {
  color: $color-danger;
}

.new-logo {
  background-color: $color-gray-400;
  border-radius: 8px;
}
</style>
