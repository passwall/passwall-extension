<template>
  <VDropdown :distance="6">
    <button 
      type="button" 
      class="btn-generate-pass"
      v-tooltip="$t('Generate')">
      <VIcon name="refresh" size="20px" />
    </button>

    <template #popper="{ hide }">
      <div class="generate-password">
        <span v-text="password || 'Generating...'" />
        <hr />
        <VButton size="mini" @click.stop="onClickUseThis(hide)">
          {{ $t('UseThis') }}
        </VButton>
      </div>
    </template>
  </VDropdown>
</template>

<script>
export default {
  name: 'GeneratePassword',
  emits: ['update:modelValue', 'input'],

  props: {
    modelValue: String,
    value: String
  },

  data() {
    return {
      password: ''
    }
  },
  
  async mounted() {
    // Generate password on mount so it's ready when dropdown opens
    this.password = await this.$helpers.generatePassword()
  },

  methods: {
    onClickUseThis(hide) {
      if (!this.password) return
      this.$emit('update:modelValue', this.password)
      this.$emit('input', this.password)

      // Close dropdown (user expects "Use this" to apply & close)
      if (typeof hide === 'function') {
        document.activeElement?.blur()
        hide()
      }

      // Prepare a new password for next time (after close so it doesn't look like it "changed")
      setTimeout(() => {
        this.$helpers.generatePassword().then(p => (this.password = p))
      }, 0)
    }
  }
}
</script>

<style lang="scss">
.btn-generate-pass {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background-color: $color-gray-500;
  margin-left: $spacer-2;
  color: $color-gray-300;
}
.btn-generate-pass:hover {
  color: $color-secondary;
}

.generate-password {
  text-align: center;
  border-radius: 4px;
  padding: $spacer-3;
  background-color: black;

  span {
    color: #fff;
    font-size: 14px;
    line-height: 22px;
  }

  hr {
    margin: 12px #{-$spacer-3};
    border-bottom: 1px solid $color-gray-500;
  }
}
</style>
