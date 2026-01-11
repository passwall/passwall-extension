<template>
  <div class="text-area-wrapper">
    <div class="d-flex">
      <label v-if="label" class="title">{{ label }}</label>
      <ClipboardButton :copy="modelValue || value"></ClipboardButton>
    </div>
    <textarea
      :value="modelValue || value"
      autocorrect="off"
      autocomplete="off"
      spellcheck="false"
      v-on="inputListeners"
      v-bind="$attrs"
      :style="cssVars"
    />
    <!-- Error -->
    <p class="error" v-if="getError" v-text="getError" />
  </div>
</template>

<script>
export default {
  name: 'VTextArea',
  inheritAttrs: false,
  emits: ['input', 'update:modelValue'],
  
  props: {
    name: String,
    value: String,
    modelValue: String,
    isEditable: Boolean,
    label: {
      type: String,
      default: ''
    },
    minheight: {
      type: String,
      default: '110'
    }
  },
  computed: {
    getError() {
      if (!this.errors) return ''
      const error = this.errors.items.find(e => e.field == this.name)
      return error ? error.msg : ''
    },
    inputListeners() {
      // Vue 3: $listeners merged into $attrs
      return {
        ...this.$attrs,
        input: event => {
          this.$emit('input', event.target.value)
          this.$emit('update:modelValue', event.target.value)
        }
      }
    },
    cssVars() {
      return {
        'min-height': this.minheight + 'px'
      }
    }
  }
}
</script>

<style lang="scss">
.text-area-wrapper {
  display: flex;
  flex-direction: column;
  padding: $spacer-2 $spacer-3;
  width: 100%;

  .title {
    letter-spacing: 2px;
    color: $color-gray-300;
    text-transform: uppercase;
  }

  textarea {
    width: 100%;
    min-width: 280px;
    resize: none;
    color: $color-white;
    border-radius: 12px;
    padding: $spacer-2;
    background-color: $color-gray-600;
    border: solid 1px $color-gray-700;
    font-size: $font-size-medium;
    line-height: 22px;

    &::placeholder {
      font-weight: normal;
      font-size: $font-size-medium;
      color: $color-gray-300;
    }

    &:disabled {
      border: 0;
    }

    &:not(:placeholder-shown) {
      resize: vertical;
    }
  }

  .error {
    font-size: 10px;
    color: $color-danger;
    margin-top: $spacer-1;
  }
}
</style>
