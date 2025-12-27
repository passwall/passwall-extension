<template>
  <div class="content">
    <Header class="bg-black-400">
      <template v-slot:content>
        <div class="d-flex flex-items-center w-100">
          <VIcon class="c-pointer" name="arrow-left" @click="goBack" />
          <div class="d-flex flex-auto flex-items-center ml-3" style="min-width: 0; overflow: hidden;">
            <CompanyLogo :url="form.url" style="flex-shrink: 0;" />
            <span class="title fw-bold h5 ml-2">{{
              form.title || $helpers.getHostName(form.url)
            }}</span>
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
          :force-show="showPass"
          password
        >
          <template v-slot:second-icon>
            <GeneratePassword v-if="isEditMode" v-model="form.password" class="ml-2" />
            <CheckPassword :password="form.password" class="ml-2" />
            <ShowPassButton @click="showPass = $event" class="ml-2" />
          </template>
        </FormRowText>
        <FormRowText v-model="form.url" title="website" :edit-mode="isEditMode" :show-icons="false">
          <template v-slot:second-icon>
            <LinkButton :link="form.url" />
            <ClipboardButton v-if="form.url" class="ml-2" :copy="form.url" />
          </template>
        </FormRowText>

        <div>
          <VTextArea
            v-model="form.extra"
            label="Extra"
            name="extra"
            :placeholder="$t(isEditMode ? 'ClickToFill' : 'ContentHidden')"
            :disabled="!isEditMode"
            minheight=110
          />
        </div>
        <div class="d-flex px-3 mb-2" v-if="form.extra">
          <ClipboardButton :copy="form.extra" />
        </div>

        <!-- TOTP Section -->
        <FormRowText 
          v-model="form.totp_secret" 
          title="Authenticator Key (TOTP)" 
          :edit-mode="isEditMode" 
          :show-icons="true"
          :force-show="showTotpSecret"
          password
        >
          <template v-slot:second-icon>
            <button 
              v-if="isEditMode"
              type="button"
              v-tooltip="'Capture QR Code'"
              @click="captureQRCode"
              class="showpass-btn ml-2"
              :disabled="capturingQR"
            >
              <VIcon name="camera" size="20px" />
            </button>
            <ShowPassButton @click="showTotpSecret = $event" class="ml-2" />
          </template>
        </FormRowText>

        <!-- TOTP Code Display -->
        <div v-if="form.totp_secret && !isEditMode" class="totp-display-section">
          <TOTPCounter :secret="form.totp_secret" />
        </div>

        <!-- Save & Cancel -->
        <div class="d-flex m-2" v-if="isEditMode">
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
import { useLoginsStore } from '@/stores/logins'
import totpCaptureService from '@/utils/totp-capture'
import TOTPCounter from '@/components/TOTPCounter.vue'

export default {
  components: {
    TOTPCounter
  },
  data() {
    return {
      form: {
        title: '',
        username: '',
        password: '',
        url: '',
        extra: '',
        totp_secret: ''
      },
      isEditMode: false,
      showPass: false,
      showTotpSecret: false,
      capturingQR: false
    }
  },

  setup() {
    const loginsStore = useLoginsStore()
    return {
      loginsStore,
      deleteLogin: loginsStore.delete,
      updateLogin: loginsStore.update
    }
  },

  computed: {
    ItemList() {
      return this.loginsStore?.itemList || []
    },
    loading() {
      return this.$wait.is(this.$waiters.Logins.Update)
    }
  },

  mounted() {
    // Primary source: store detail (set by clickItem)
    let detail = this.loginsStore.detail

    // Fallback: route params detail (if present)
    if (!detail || !detail.id) {
      detail = this.$route.params.detail
    }

    // Fallback: find by id in item list
    if ((!detail || !detail.id) && this.$route.params.id) {
      detail = this.ItemList.find(i => i.id == this.$route.params.id)
    }

    if (detail && detail.id) {
      this.form = { ...this.form, ...detail }
    }
  },

  methods: {
    goBack() {
      this.$router.push({ name: 'Logins', params: { cache: true } })
    },

    onClickDelete() {
      const onSuccess = async () => {
        await this.deleteLogin(this.form.id)
        const index = this.ItemList.findIndex(item => item.id == this.form.id)
        if (index !== -1) {
          this.ItemList.splice(index, 1)
        }
        this.$router.push({ name: 'Logins', params: { cache: true } })
      }
      if (confirm('Are you sure you want to delete'))
        this.$request(onSuccess, this.$waiters.Logins.Delete)
    },

    async onClickUpdate() {
      const onSuccess = async () => {
        const updated = await this.updateLogin({ ...this.form })
        // keep detail page open and sync form with updated data
        this.form = { ...this.form, ...updated }
        this.loginsStore.setDetail(updated)
      }

      await this.$request(onSuccess, this.$waiters.Logins.Update)
      this.isEditMode = false
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
          this.form.totp_secret = totpUrl
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

.totp-display-section {
  margin: 12px 16px;
}
</style>
