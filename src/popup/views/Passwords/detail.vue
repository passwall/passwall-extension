<template>
  <div class="content">
    <Header class="bg-black-400">
      <template v-slot:content>
        <div class="d-flex flex-items-center w-100">
          <VIcon class="c-pointer" name="arrow-left" @click="goBack" />
          <div
            class="d-flex flex-auto flex-items-center ml-3"
            style="min-width: 0; overflow: hidden"
          >
            <CompanyLogo :url="form.url" style="flex-shrink: 0" />
            <span class="title fw-bold h5 ml-2">{{
              form.title || $helpers.getHostName(form.url)
            }}</span>
          </div>
          <div class="d-flex" style="flex-shrink: 0">
            <!-- Delete Btn -->
            <button v-tooltip="$t('Delete')" @click="showDeleteConfirm = true">
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
          :show-icons="true"
        />
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
          <VTextArea v-model="form.extra" label="Extra" name="extra" :disabled="!isEditMode" />
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

    <!-- Delete Confirmation Dialog -->
    <ConfirmDialog
      v-model:show="showDeleteConfirm"
      title="Delete Password?"
      :message="deleteConfirmMessage"
      confirm-text="Delete"
      cancel-text="Cancel"
      confirm-theme="danger"
      icon="trash"
      icon-class="icon-danger"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script>
import { useItemsStore, ItemType } from '@/stores/items'
import { storeToRefs } from 'pinia'
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
      capturingQR: false,
      showDeleteConfirm: false
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
    },
    deleteConfirmMessage() {
      const name = this.form.title || this.form.url || 'this password'
      return 'Are you sure you want to delete "' + name + '"?\n\nThis action cannot be undone.'
    }
  },

  async mounted() {
    // Get item ID from route
    const itemId = parseInt(this.$route.params.id)

    if (!itemId) {
      this.$router.push({ name: 'Passwords' })
      return
    }

    // Find item in store
    let item = this.items.find((i) => i.id === itemId)

    // If not found, try to fetch it
    if (!item) {
      try {
        await this.itemsStore.fetchItems({ type: ItemType.Password })
        item = this.items.find((i) => i.id === itemId)
      } catch (error) {
        console.error('Failed to fetch item:', error)
        this.$notifyError?.('Failed to load password')
        this.$router.push({ name: 'Passwords' })
        return
      }
    }

    // If still not found, navigate back
    if (!item) {
      this.$notifyError?.('Password not found')
      this.$router.push({ name: 'Passwords' })
      return
    }

    // Populate form with item data
    this.form = {
      title: item.title || item.metadata?.name || '',
      username: item.username || '',
      password: item.password || '',
      url: item.url || item.metadata?.uri_hint || '',
      extra: item.notes || item.extra || '',
      totp_secret: item.totp || item.totp_secret || ''
    }
  },

  methods: {
    goBack() {
      this.$router.push({ name: 'Passwords', params: { cache: true } })
    },

    async confirmDelete() {
      const onSuccess = async () => {
        await this.deleteLogin(this.form.id)
        const index = this.ItemList.findIndex((item) => item.id == this.form.id)
        if (index !== -1) {
          this.ItemList.splice(index, 1)
        }
        this.$notifySuccess?.('Password deleted successfully')
        this.$router.push({ name: 'Passwords', params: { cache: true } })
      }

      await this.$request(onSuccess, this.$waiters.Passwords.Delete)
    },

    async onClickUpdate() {
      const onSuccess = async () => {
        const updated = await this.updateLogin({ ...this.form })
        // keep detail page open and sync form with updated data
        this.form = { ...this.form, ...updated }
        this.itemsStore.setDetail(updated)
      }

      await this.$request(onSuccess, this.$waiters.Passwords.Update)
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
          // Extract secret from otpauth:// URL (admin stores only secret, not full URL)
          const secret = totpCaptureService.extractSecret(totpUrl)
          this.form.totp_secret = secret || totpUrl
          this.$notify({
            title: 'Success',
            text: 'QR code successfully captured!',
            type: 'success'
          })
        } else {
          this.$notifyError(
            'QR code not found. Please ensure the QR code is clearly visible on screen.'
          )
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
