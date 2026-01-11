<template>
  <div>
    <Header class="bg-black-400">
      <template v-slot:content>
        <VIcon class="c-pointer" name="arrow-left" @click="$router.back()" />
        <div class="d-flex flex-auto flex-items-center ml-4">
          <div class="new-logo">
            <VIcon name="logo-simple" height="40px" width="40px" />
          </div>
          <span class="fw-bold h5 ml-2">New Password</span>
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

        <!-- TOTP Section -->
        <div class="form-row">
          <label v-text="'Authenticator Key (TOTP)'" />
          <div class="d-flex flex-justify-between">
            <VFormText
              name="TOTP Secret"
              class="flex-auto"
              v-on:change="saveForm"
              v-model="form.totp_secret"
              :placeholder="$t('ClickToFill')"
              theme="no-border"
              :type="showTotpSecret ? 'text' : 'password'"
            />
            <div class="d-flex flex-items-center mr-3">
              <button 
                type="button"
                v-tooltip="'Capture QR Code'"
                @click="captureQRCode"
                class="showpass-btn ml-2"
                :disabled="capturingQR"
              >
                <VIcon name="camera" size="20px" />
              </button>
              <ShowPassButton @click="showTotpSecret = $event" class="ml-2" />
              <ClipboardButton v-if="form.totp_secret" class="ml-2" :copy="form.totp_secret" />
            </div>
          </div>
        </div>

        <!-- TOTP Code Display -->
        <div v-if="form.totp_secret && showTotpCode">
          <TOTPCounter :secret="form.totp_secret" />
        </div>
        <div v-if="form.totp_secret" class="totp-toggle">
          <button 
            type="button" 
            @click="showTotpCode = !showTotpCode"
            class="link-button"
          >
            {{ showTotpCode ? 'Hide TOTP Code' : 'Show TOTP Code' }}
          </button>
        </div>

        <VButton
          class="mx-2 my-2"
          size="medium"
          type="submit"
          style="letter-spacing: 2px"
          :loading="$wait.is($waiters.Passwords.Create)"
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
import totpCaptureService from '@/utils/totp-capture'
import TOTPCounter from '@/components/TOTPCounter.vue'

export default {
  components: {
    TOTPCounter
  },
  setup() {
    const itemsStore = useItemsStore()
    
    return {
      createLogin: itemsStore.create
    }
  },
  data() {
    return {
      showPass: false,
      showTotpSecret: false,
      showTotpCode: false,
      capturingQR: false,
      form: {
        title: '',
        username: '',
        password: '',
        url: '',
        extra: '',
        totp_secret: ''
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
        this.$router.push({ name: 'Passwords' })
      }
      this.$request(onSuccess, this.$waiters.Passwords.Create)
    },
    
    saveForm: function (event) {
      Storage.setItem('create_form', this.form)
    },

    async captureQRCode() {
      if (!totpCaptureService.canCaptureTotp()) {
        this.$notifyError('QR code capture is not supported in this browser')
        return
      }

      this.capturingQR = true
      try {
        const totpUrl = await totpCaptureService.captureTotpSecret()
        
        if (totpUrl) {
          // Extract secret from otpauth:// URL (admin stores only secret, not full URL)
          const secret = totpCaptureService.extractSecret(totpUrl)
          this.form.totp_secret = secret || totpUrl
          this.showTotpCode = true
          this.$notify({
            title: 'Success',
            text: 'QR code successfully captured!',
            type: 'success'
          })
        } else {
          this.$notifyError('QR code not found. Please ensure the QR code is clearly visible on screen.')
        }
      } catch (error) {
        console.error('QR code capture error:', error)
        this.$notifyError(error.message || 'Failed to capture QR code')
      } finally {
        this.capturingQR = false
      }
    }
  }
}
</script>

<style lang="scss">
.new-logo {
  background-color: $color-gray-400;
  border-radius: 8px;
}

.totp-toggle {
  margin: 8px 0;
  text-align: center;
}

.link-button {
  background: transparent;
  border: none;
  color: #3498db;
  cursor: pointer;
  font-size: 14px;
  text-decoration: underline;
  padding: 4px 8px;

  &:hover {
    color: #2980b9;
  }
}
</style>
