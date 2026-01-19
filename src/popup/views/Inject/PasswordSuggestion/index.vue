<template>
  <div ref="window" class="px-3 py-3 window">
    <div class="suggestion-card" @click="applyPassword">
      <div class="card-left">
        <p class="label">Password suggestion</p>
        <p class="value">{{ password }}</p>
      </div>
      <div class="card-actions" @click.stop>
        <button class="icon-btn" type="button" title="Copy" @click.stop="copyPassword">
          <VIcon name="duplicate" size="18px" />
        </button>
        <button class="icon-btn" type="button" title="Refresh" @click.stop="refreshPassword">
          <VIcon name="refresh" size="18px" />
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PasswordSuggestion',
  data() {
    return {
      password: ''
    }
  },
  created() {
    this.on('PASSWORD_SUGGESTION_INIT', (message) => {
      this.password = message?.payload?.password || ''
    })
    this.on('PASSWORD_SUGGESTION_UPDATE', (message) => {
      this.password = message?.payload?.password || ''
    })
  },
  mounted() {
    const resizeObserver = new ResizeObserver(([box]) => {
      const currentHeight = box.borderBoxSize[0].blockSize
      this.messageToContentScript({
        type: 'PASSWORD_SUGGESTION_RESIZE',
        payload: { height: currentHeight }
      })
    })
    resizeObserver.observe(this.$refs.window)

    this.$nextTick(() => {
      this.messageToContentScript({ type: 'PASSWORD_SUGGESTION_READY' })
    })
  },
  methods: {
    applyPassword() {
      if (!this.password) return
      this.messageToContentScript({
        type: 'PASSWORD_SUGGESTION_APPLY',
        payload: { password: this.password }
      })
    },
    refreshPassword() {
      this.messageToContentScript({ type: 'PASSWORD_SUGGESTION_REFRESH' })
    },
    async copyPassword() {
      if (!this.password) return
      try {
        await navigator.clipboard.writeText(this.password)
      } catch {
        // ignore copy failures
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.window {
  min-width: 260px;
}

.suggestion-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: $color-gray-600;
  border: 1px solid $color-gray-500;
  cursor: pointer;
  user-select: none;
}

.suggestion-card:hover {
  border-color: $color-gray-400;
}

.card-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}


.label {
  font-size: 11px;
  color: $color-gray-300;
  text-transform: none;
}

.value {
  font-size: 13px;
  color: $color-white;
  word-break: break-all;
  font-weight: 600;
}

.card-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: $color-white;
  cursor: pointer;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.16);
}
</style>
