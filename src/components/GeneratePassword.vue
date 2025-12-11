<template>
  <v-popover offset="16">
    <button 
      type="button" 
      @click="onClickGenerate" 
      class="btn-generate-pass"
      v-tooltip="$t('Generate')">
      <VIcon name="refresh" size="20px" />
    </button>

    <!-- Popover -->
    <template slot="popover">
      <div class="generate-password">
        <span v-text="password" />
        <hr />
        <VButton size="mini" v-close-popover @click="onClickUseThis">
          {{ $t('UseThis') }}
        </VButton>
      </div>
    </template>
  </v-popover>
</template>

<script>
import SystemService from '@/api/services/System'

export default {
  name: 'GeneratePassword',
  emits: ['update:modelValue', 'input'],

  props: {
    modelValue: String,
    value: String // backwards compatibility
  },

  data() {
    return {
      password: ''
    }
  },

  methods: {
    onClickItem(name) {
      this.$router.push({ name })
      this.$emit('hide')
    },

    onClickUseThis() {
      const val = this.password
      this.$emit('update:modelValue', val)
      this.$emit('input', val) // legacy
    },

    async onClickGenerate() {
      this.password = await this.$helpers.generatePassword()
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
