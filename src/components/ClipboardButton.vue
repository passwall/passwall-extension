<template>
  <button 
    type="button" 
    class="clipboard-btn" 
    @click="handleCopy"
    v-tooltip="$t('Copy')">
    <VIcon name="duplicate" size="20px" />
  </button>
</template>

<script>
export default {
  name: 'ClipboardButton',

  props: {
    copy: {
      type: [String, Number, Object],
      default: ''
    }
  },

  computed: {
    copyValue() {
      if (this.copy === undefined || this.copy === null) return ''
      if (typeof this.copy === 'string') return this.copy
      if (typeof this.copy === 'number') return String(this.copy)
      try {
        return JSON.stringify(this.copy)
      } catch (e) {
        return String(this.copy)
      }
    }
  },
  
  methods: {
    async handleCopy() {
      const text = this.copyValue
      if (!text) return
      
      try {
        await navigator.clipboard.writeText(text)
        this.$notifySuccess?.(this.$t('Copied') || 'Copied!')
      } catch (error) {
        console.error('Failed to copy:', error)
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        document.body.appendChild(textArea)
        textArea.select()
        try {
          document.execCommand('copy')
          this.$notifySuccess?.(this.$t('Copied') || 'Copied!')
        } catch (err) {
          console.error('Fallback copy failed:', err)
        }
        document.body.removeChild(textArea)
      }
    }
  }
}
</script>

<style lang="scss">
.clipboard-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background-color: $color-gray-500;
  color: $color-gray-300;
}
.clipboard-btn:hover {
  color: $color-secondary;
}
</style>
