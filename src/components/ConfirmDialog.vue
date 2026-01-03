<template>
  <teleport to="body">
    <transition name="fade">
      <div v-if="show" class="confirm-overlay" @click="handleOverlayClick">
        <transition name="scale">
          <div v-if="show" class="confirm-dialog" @click.stop>
            <!-- Icon -->
            <div class="icon-container">
              <VIcon :name="icon" size="48px" :class="iconClass" />
            </div>

            <!-- Title -->
            <h3 class="dialog-title">{{ title }}</h3>

            <!-- Message -->
            <p class="dialog-message">{{ message }}</p>

            <!-- Actions -->
            <div class="dialog-actions">
              <VButton 
                theme="text" 
                class="flex-1"
                @click="handleCancel"
              >
                {{ cancelText }}
              </VButton>
              <VButton 
                :theme="confirmTheme"
                class="flex-1"
                @click="handleConfirm"
              >
                {{ confirmText }}
              </VButton>
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </teleport>
</template>

<script>
export default {
  name: 'ConfirmDialog',
  
  props: {
    show: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: 'Confirm'
    },
    message: {
      type: String,
      default: 'Are you sure?'
    },
    confirmText: {
      type: String,
      default: 'Confirm'
    },
    cancelText: {
      type: String,
      default: 'Cancel'
    },
    confirmTheme: {
      type: String,
      default: 'danger' // or 'primary'
    },
    icon: {
      type: String,
      default: 'trash'
    },
    iconClass: {
      type: String,
      default: 'icon-danger'
    }
  },

  emits: ['confirm', 'cancel', 'update:show'],

  methods: {
    handleConfirm() {
      this.$emit('confirm')
      this.$emit('update:show', false)
    },

    handleCancel() {
      this.$emit('cancel')
      this.$emit('update:show', false)
    },

    handleOverlayClick() {
      this.handleCancel()
    }
  }
}
</script>

<style lang="scss" scoped>
.confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
}

.confirm-dialog {
  background: $color-gray-400;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 24px;
  max-width: 320px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.icon-container {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
  
  .icon-danger {
    color: $color-danger;
  }
  
  .icon-warning {
    color: $color-warning;
  }
  
  .icon-info {
    color: $color-secondary;
  }
}

.dialog-title {
  color: $color-white;
  font-size: 18px;
  font-weight: 700;
  text-align: center;
  margin: 0 0 12px 0;
}

.dialog-message {
  color: $color-gray-450;
  font-size: 14px;
  line-height: 1.6;
  text-align: center;
  margin: 0 0 24px 0;
}

.dialog-actions {
  display: flex;
  gap: 12px;
}

// Animations
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-enter-active,
.scale-leave-active {
  transition: all 0.3s ease;
}

.scale-enter-from,
.scale-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>

