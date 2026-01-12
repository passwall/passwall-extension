<template>
  <div ref="window" class="px-3 py-4 window">
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
        <FormRowText v-model="form.title" title="title" :show-icons="false" />
        <FormRowText v-model="form.username" title="username" :show-icons="false">
          <template v-slot:second-icon> <div /> </template>
        </FormRowText>
        <FormRowText v-model="form.password" title="password" :show-icons="true" password />
        <FormRowText v-model="form.url" title="website" :show-icons="true">
          <template v-slot:second-icon>
            <LinkButton :link="form.url" />
          </template>
        </FormRowText>
      </div>
    </ul>
    <footer class="d-flex flex-row mt-3 flex-row-reverse flex-items-center flex-justify-end">
      <div class="d-flex flex-row-reverse flex-items-center" style="gap: 12px">
        <VButton @click="onSave" :disabled="saving">
          <span class="fs-medium fw-bold">{{
            saving ? 'SAVING...' : action === 'update' ? 'UPDATE' : 'SAVE'
          }}</span>
        </VButton>
        <VButton theme="text" @click="onCancel">
          <span class="fs-medium fw-bold c-gray-300">CANCEL</span>
        </VButton>
      </div>
    </footer>
  </div>
</template>

<script>
import { useItemsStore, ItemType } from '@/stores/items'
import Storage from '@/utils/storage'
import { getDomain } from '@/utils/helpers'

export default {
  name: 'SavePassword',
  setup() {
    const itemsStore = useItemsStore()
    return {
      createLogin: itemsStore.create,
      updateLogin: itemsStore.update
    }
  },
  data() {
    return {
      showContent: false,
      saving: false,
      form: {
        title: '',
        username: '',
        password: '',
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
      this.form.password = '' // intentionally blank; user may edit/override
      this.form.url = data.url || ''
      this.action = data.action || 'add'
      this.loginId = data.loginId || null
      this.domain = data.domain || ''

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
.content {
  border-top: 1px solid $color-gray-500;
}
</style>
