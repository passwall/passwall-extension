<template>
  <div ref="window" class="px-3 py-4 window" @wheel.prevent @touchmove.prevent>
    <header class="d-flex flex-items-center flex-justify-between">
      <div class="d-flex flex-row flex-items-center">
        <VIcon name="passwall-logo" size="32px" />
        <p class="fs-medium fw-bold ml-2">
          {{ action === 'update' ? 'UPDATE PASSWORD?' : 'SAVE NEW PASSWORD?' }}
        </p>
      </div>
      <VIcon name="cross" size="20px" class="c-gray-300 mr-2 c-pointer" @click="onCancel" />
    </header>
    <ul class="mt-2">
      <li
        class="d-flex flex-row bg-black p-3 w-100 flex-items-center flex-justify-between radius c-pointer no-select"
        @click="showContent = !showContent"
      >
        <div class="d-flex flex-row">
          <CompanyLogo :url="form.url" check />
          <div class="ml-2">
            <p>{{ form.title }}</p>
            <p class="c-gray-300">{{ form.username }}</p>
          </div>
        </div>
        <VIcon
          name="down-arrow"
          size="24px"
          class="c-gray-300"
          :style="{
            transform: showContent ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s'
          }"
        />
      </li>
      <div v-show="showContent" class="content bg-black">
        <FormRowText v-model="form.title" title="name" :show-icons="false" edit-mode />
        <FormRowText v-model="form.username" title="username" :show-icons="false" edit-mode>
          <template v-slot:second-icon> <div /> </template>
        </FormRowText>
        <FormRowText v-model="form.password" title="password" :show-icons="true" password edit-mode />
        <FormRowText v-model="form.url" title="website" :show-icons="true" edit-mode>
          <template v-slot:second-icon>
            <LinkButton :link="form.url" />
          </template>
        </FormRowText>
        <div class="form-row">
          <label class="title">FOLDER</label>
          <select v-model="form.folder_id" class="pw-input pw-select">
            <option value="">No folder</option>
            <option v-for="folder in folders" :key="folder.id" :value="String(folder.id)">
              {{ folder.name }}
            </option>
          </select>
        </div>
        <div class="form-row pw-checkbox-group">
          <div class="d-flex flex-column" style="gap: 8px;">
            <label class="pw-checkbox">
              <input type="checkbox" v-model="form.auto_fill" />
              <span>Enable autofill</span>
            </label>
            <label class="pw-checkbox">
              <input type="checkbox" v-model="form.auto_login" />
              <span>Log in automatically</span>
            </label>
            <label class="pw-checkbox">
              <input type="checkbox" v-model="form.reprompt" />
              <span>Require master password reprompt</span>
            </label>
          </div>
        </div>
      </div>
    </ul>
    <footer class="d-flex flex-row mt-3 flex-items-center flex-justify-between">
      <div class="d-flex flex-row flex-items-center">
        <VIcon name="passwall-logo" size="20px" />
        <span class="fs-medium fw-bold ml-2">Passwall</span>
      </div>
      <div class="d-flex flex-row flex-items-center" style="gap: 12px">
        <VButton theme="text" @click="onCancel">
          <span class="fs-medium fw-bold c-gray-300">NOT NOW</span>
        </VButton>
        <VButton @click="onSave" :disabled="saving">
          <span class="fs-medium fw-bold">{{
            saving ? 'SAVING...' : action === 'update' ? 'UPDATE' : 'SAVE'
          }}</span>
        </VButton>
      </div>
    </footer>
  </div>
</template>

<script>
import { useItemsStore, ItemType } from '@/stores/items'
import Storage from '@/utils/storage'
import HTTPClient from '@/api/HTTPClient'
import { getDomain } from '@/utils/helpers'

export default {
  name: 'SavePassword',
  setup() {
    const itemsStore = useItemsStore()
    return {
      createLogin: itemsStore.create,
      updatePassword: itemsStore.update
    }
  },
  data() {
    return {
      showContent: false,
      saving: false,
      folders: [],
      foldersLoading: false,
      form: {
        title: '',
        username: '',
        password: '',
        folder_id: '',
        auto_fill: true,
        auto_login: false,
        reprompt: false,
        url: '',
        extra: ''
      },
      action: 'add', // 'add' or 'update'
      loginId: null, // For update action
      domain: '',
      resizeObserver: null
    }
  },

  created() {
    // Listen for messages from content script
    window.addEventListener('message', this.handleMessage)
  },

  mounted() {
    // Setup ResizeObserver to adjust iframe height dynamically
    this.setupResizeObserver()
    this.fetchFolders()

    // Notify content script that SavePassword iframe is ready (prevents race with SPA route mount)
    this.tellParent({
      type: 'PASSWALL_SAVE_READY'
    })
  },

  beforeUnmount() {
    window.removeEventListener('message', this.handleMessage)
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
    }
  },

  methods: {
    /**
     * Handle messages from content script
     */
    handleMessage(event) {
      let message = event.data
      if (typeof message === 'string') {
        try {
          message = JSON.parse(message)
        } catch {
          return
        }
      }

      const { type, data } = message || {}

      if (type === 'PASSWALL_SAVE_INIT') {
        this.initializeForm(data)
      }
    },

    /**
     * Initialize form with data from content script
     */
    initializeForm(data) {
      this.form.username = data.username || ''
      this.form.password = data.password || ''
      this.form.folder_id =
        data.folder_id !== undefined && data.folder_id !== null ? String(data.folder_id) : ''
      this.form.auto_fill = data.auto_fill !== undefined ? !!data.auto_fill : true
      this.form.auto_login = data.auto_login !== undefined ? !!data.auto_login : false
      this.form.reprompt = data.reprompt !== undefined ? !!data.reprompt : false
      this.form.url = data.url || ''
      this.action = data.action || 'add'
      this.loginId = data.loginId || null
      this.domain = data.domain || ''
      this.showContent = false

      // Use title from data if provided (for update), otherwise use domain
      this.form.title = data.title || this.domain || getDomain(this.form.url) || 'New Login'
    },

    /**
     * Handle save button click
     */
    async onSave() {
      if (this.saving) return

      if (!this.form.username) {
        return
      }

      this.saving = true

      const dataToSend = {
        username: this.form.username,
        password: this.form.password || undefined,
        folder_id: this.form.folder_id ? Number(this.form.folder_id) : null,
        auto_fill: !!this.form.auto_fill,
        auto_login: !!this.form.auto_login,
        reprompt: !!this.form.reprompt,
        url: this.form.url,
        title: this.form.title,
        action: this.action,
        loginId: this.loginId,
        domain: this.domain
      }

      // Notify content script that user confirmed save
      // Content script will handle the actual save via background script
      this.tellParent({
        type: 'PASSWALL_SAVE_CONFIRMED',
        data: dataToSend
      })
    },

    /**
     * Handle cancel button click
     */
    onCancel() {
      this.tellParent({
        type: 'PASSWALL_SAVE_CANCELLED'
      })
    },

    async fetchFolders() {
      if (this.foldersLoading) return
      this.foldersLoading = true
      try {
        const { data } = await HTTPClient.get('/api/folders')
        this.folders = data?.folders || []
      } catch {
        this.folders = []
      } finally {
        this.foldersLoading = false
      }
    },

    /**
     * Handle never button click
     * TODO: Add domain to never save list
     */
    async onNever() {
      // TODO: Implement domain blacklist
      // await Storage.addToNeverSaveList(this.domain)

      this.tellParent({
        type: 'PASSWALL_SAVE_CANCELLED'
      })
    },

    /**
     * Send message to parent (content script)
     */
    tellParent(message) {
      const parentOrigin = window.location?.ancestorOrigins?.[0] || '*'
      const nonce = window.__PASSWALL_NONCE
      const payload = nonce ? { ...message, nonce } : message
      window.parent.postMessage(JSON.stringify(payload), parentOrigin)
    },

    /**
     * Setup ResizeObserver to notify parent of height changes
     */
    setupResizeObserver() {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const height = entry.contentRect.height
          // Notify parent iframe to adjust height
          this.tellParent({
            type: 'PASSWALL_SAVE_RESIZE',
            data: {
              height: Math.ceil(height) + 50 // Increased padding for expanded state
            }
          })
        }
      })

      // Observe the root element
      const root = this.$el
      if (root) {
        this.resizeObserver.observe(root)
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.window {
  overflow: hidden;
  overscroll-behavior: contain;
  padding-bottom: 16px;
}

.content {
  border-top: 1px solid $color-gray-500;
}

.pw-select {
  width: 100%;
  max-width: 330px;
  padding: 8px 12px;
  border-radius: 8px;
  background: transparent;
  color: #fff;
  border: 1px solid $color-gray-500;
}

.pw-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  font-weight: 500;
}

.pw-checkbox input {
  accent-color: $color-primary;
}

.pw-checkbox-group {
  margin-bottom: 24px;
}
</style>
