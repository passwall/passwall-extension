<template>
  <div class="text-area-wrapper">
    <label v-if="label" class="title">{{ label }}</label>
    <textarea
      :value="sensitive ? '●●●●●●' : value"
      autocorrect="off"
      autocomplete="off"
      spellcheck="false"
      v-on="inputListeners"
      v-bind="$attrs"
    />
    <!-- Error -->
    <p class="error" v-if="getError" v-text="getError" />
  </div>
</template>

<script>
export default {
  name: 'VTextArea',

  props: {
    name: String,
    value: String,
    sensitive: Boolean,
    label: {
      type: String,
      default: ''
    }
  },

  computed: {
    getError() {
      const error = this.errors.items.find(e => e.field == this.name)
      return error ? error.msg : ''
    },

    inputListeners() {
      return Object.assign({}, this.$listeners, {
        input: event => this.$emit('input', event.target.value)
      })
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
    resize: none;
    color: $color-gray-300;
    border-radius: 12px;
    padding: $spacer-2;
    min-height: 150px;
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
