<template>
  <li class="d-flex flex-justify-between flex-content-center py-3 item" v-bind="$attrs">
    <CompanyLogo :url="url" :check="check" />
    <div class="flex-auto ml-3">
      <p class="fs-medium fw-medium c-white" v-text="title" />
      <p class="fs-small fw-medium c-gray-300 mt-1" v-text="subtitle" />
    </div>

    <!-- Action Buttons -->
    <div class="actions d-flex flex-items-center">
      <!-- Copy Dropdown -->
      <VDropdown ref="copyDropdown" :distance="6" placement="bottom-end">
        <button class="action-btn" v-tooltip="'Copy'" @click.stop>
          <VIcon name="duplicate" width="20px" height="20px" color="#8B93A1" />
        </button>

        <template #popper="{ hide }">
          <div class="dropdown-menu">
            <button class="dropdown-item" @click.stop="copyUsername(hide)">
              <VIcon name="duplicate" width="16px" height="16px" />
              <span>Copy Username</span>
            </button>
            <button class="dropdown-item" @click.stop="copyPassword(hide)">
              <VIcon name="duplicate" width="16px" height="16px" />
              <span>Copy Password</span>
            </button>
            <button v-if="totpSecret" class="dropdown-item" @click.stop="copyTOTP(hide)">
              <VIcon name="duplicate" width="16px" height="16px" />
              <span>Copy TOTP</span>
            </button>
          </div>
        </template>
      </VDropdown>

      <!-- More Options Dropdown -->
      <VDropdown ref="moreDropdown" :distance="6" placement="bottom-end">
        <button class="action-btn ml-2" v-tooltip="'More'" @click.stop>
          <VIcon name="settings" width="5px" height="18px" color="#8B93A1" />
        </button>

        <template #popper="{ hide }">
          <div class="dropdown-menu">
            <button class="dropdown-item" @click.stop="handleEdit(hide)">
              <VIcon name="cogs" width="16px" height="16px" />
              <span>Edit</span>
            </button>
            <button class="dropdown-item dropdown-item-danger" @click.stop="handleDelete(hide)">
              <VIcon name="trash" width="16px" height="16px" />
              <span>Delete</span>
            </button>
          </div>
        </template>
      </VDropdown>
    </div>
  </li>
</template>

<script>
import totpService from '@/utils/totp'

export default {
  name: 'ListItem',
  inheritAttrs: false,

  emits: ['edit', 'delete'],

  props: {
    url: {
      type: String,
      default: ''
    },
    title: {
      type: String,
      default: ''
    },
    subtitle: {
      type: String,
      default: ''
    },
    check: {
      type: Boolean,
      default: true
    },
    itemData: {
      type: Object,
      default: () => ({})
    }
  },

  computed: {
    totpSecret() {
      const item = this.itemData || {}
      return item.totp_secret || item.totp || item.totpSecret || item.totpSecretKey || ''
    }
  },

  methods: {
    async copyUsername(hide) {
      // Blur active element before hiding dropdown (accessibility fix)
      document.activeElement?.blur()

      const text = this.itemData.username
      if (!text) {
        this.$notifyError?.('No username to copy')
        hide()
        return
      }

      try {
        await navigator.clipboard.writeText(text)
        this.$notifySuccess?.('Username copied!')
        hide()
      } catch (error) {
        console.error('Failed to copy username:', error)
        this.$notifyError?.('Failed to copy')
        hide()
      }
    },

    async copyPassword(hide) {
      // Blur active element before hiding dropdown (accessibility fix)
      document.activeElement?.blur()

      const text = this.itemData.password
      if (!text) {
        this.$notifyError?.('No password to copy')
        hide()
        return
      }

      try {
        await navigator.clipboard.writeText(text)
        this.$notifySuccess?.('Password copied!')
        hide()
      } catch (error) {
        console.error('Failed to copy password:', error)
        this.$notifyError?.('Failed to copy')
        hide()
      }
    },

    async copyTOTP(hide) {
      // Blur active element before hiding dropdown (accessibility fix)
      document.activeElement?.blur()

      const secret = this.totpSecret
      if (!secret) {
        this.$notifyError?.('No TOTP secret configured')
        hide()
        return
      }

      try {
        const code = totpService.generateCode(secret)
        if (!code) {
          this.$notifyError?.('Failed to generate TOTP code')
          hide()
          return
        }

        await navigator.clipboard.writeText(code)
        this.$notifySuccess?.('TOTP code copied!')
        hide()
      } catch (error) {
        console.error('Failed to copy TOTP:', error)
        this.$notifyError?.('Failed to copy TOTP')
        hide()
      }
    },

    handleEdit(hide) {
      // Blur active element before hiding dropdown (accessibility fix)
      document.activeElement?.blur()
      hide()
      this.$emit('edit', this.itemData)
    },

    handleDelete(hide) {
      // Blur active element before hiding dropdown (accessibility fix)
      document.activeElement?.blur()
      hide()
      this.$emit('delete', this.itemData)
    }
  }
}
</script>

<style lang="scss" scoped>
.item {
  border-bottom: 2px solid $color-black;
}

.actions {
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background-color: transparent;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
}

.dropdown-menu {
  background: $color-gray-400;
  border-radius: 6px;
  padding: 0;
  min-width: 180px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  color: $color-white;
  font-size: 14px;
  font-weight: 500;
  border-radius: 6px;
  transition: all 0.2s;
  text-align: left;
  cursor: pointer;

  svg {
    color: $color-gray-300;
    transition: color 0.2s;
  }

  &:hover {
    background-color: rgba(255, 255, 255, 0.08);

    svg {
      color: $color-secondary;
    }
  }

  &-danger {
    color: $color-danger;

    svg {
      color: $color-danger;
    }

    &:hover {
      background-color: rgba(255, 81, 81, 0.12);

      svg {
        color: $color-danger;
      }
    }
  }
}
</style>
