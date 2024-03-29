<template>
  <div class="form-text-wrapper">
    <input
      :type="$attrs.type || 'text'"
      :value="value"
      :class="clazz"
      class="form-text"
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
  name: 'VFormText',

  props: {
    name: String,
    value: String,
    theme: {
      type: String,
      default: 'default'
    },
    size: {
      type: String,
      default: 'small'
    }
  },

  computed: {
    clazz() {
      return [`--${this.size}`, `--${this.theme}`, { '--error': this.getError }]
    },

    getError() {
      if (this.errors !== undefined) {
        const error = this.errors.items.find(e => e.field == this.name)
        return error ? error.msg : ''
      }
      return ''
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
.form-text-wrapper {
  .error {
    font-size: 10px;
    color: $color-danger;
    margin-top: $spacer-1;
  }

  .form-text {
    width: 100%;
    color: #fff;
    border: 0;

    &::placeholder {
      font-weight: normal;
      font-size: $font-size-small;
      color: $color-gray-300;
    }

    // themes
    &.--default {
      color: #fff;
      border: 1px solid #151c27;
      background-color: transparent;
      caret-color: $color-primary;

      &.--error {
        border: 1px solid #ff0000;
      }

      &:focus {
        border: 1px solid $color-primary;
      }
    }

    &.--black {
      color: $color-gray-300;
      background-color: black;
      border: 1px solid black;
      caret-color: $color-primary;

      &.--error {
        border: 1px solid #ff0000;
      }

      &:focus {
        border: 1px solid $color-primary;
      }
    }

    &.--no-border {
      caret-color: $color-primary;
      background-color: transparent;

      & + .error {
        margin: 0 0 $spacer-1 $spacer-3;
      }
    }

    // sizes
    &.--small {
      height: 32px;
      border-radius: 4px;
      padding: 0 16px;
    }

    &.--medium {
      border-radius: 8px;
      height: 48px;
      padding: 0 16px;
      font-size: 12px;
      line-height: 18px;
    }
  }
}
</style>
