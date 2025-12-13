<template>
  <VDropdown :distance="6">
    <button 
      type="button" 
      class="btn-generate-pass"
      v-tooltip="$t('Generate')">
      <VIcon name="refresh" size="20px" />
    </button>

    <template #popper>
      <div class="generate-password">
        <span v-text="password || 'Generating...'" />
        <hr />
        <VButton size="mini" @click="onClickUseThis">
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
    onClickUseThis() {
      if (!this.password) return
      this.$emit('update:modelValue', this.password)
      this.$emit('input', this.password)
      // Generate new password for next time
      this.$helpers.generatePassword().then(p => this.password = p)
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
