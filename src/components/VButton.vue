<template>
  <button
    :type="$attrs.type || 'button'"
    :disabled="$attrs.disabled || loading"
    :class="clazz"
    class="btn"
    v-bind="$attrs"
    v-on="inputListeners"
  >
    <slot />
    <VIcon v-if="loading" name="refresh" size="14px" class="spin c-white ml-2" />
  </button>
</template>

<script>
export default {
  name: 'VButton',
  inheritAttrs: false,

  props: {
    size: {
      type: String,
      default: 'small'
    },
    theme: {
      type: String,
      default: 'primary',
      validator: value => ['primary', 'text', 'danger'].includes(value)
    },
    loading: {
      type: Boolean,
      default: false
    }
  },

  computed: {
    clazz() {
      return [`--${this.size}`, `--theme-${this.theme}`, { '--loading': this.loading }]
    },

    getError() {
      if (!this.errors) return ''
      const error = this.errors.items.find(e => e.field == this.name)
      return error ? error.msg : ''
    },

    inputListeners() {
      // Vue 3: $listeners merged into $attrs
      return this.$attrs
    }
  }
}
</script>

<style lang="scss">
.btn {
  border: 1px solid #151c27;
  border-radius: 8px;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  font-family: 'Inter', sans-serif;

  &.--loading {
    opacity: 0.6;
    cursor: no-drop;
  }

  /* themes */
  &.--theme-primary {
    background-color: $color-primary;
    transition: background-color 0.2s;

    &:hover:not(:disabled) {
      background-color: #6f1fff; // Slightly lighter primary
    }
  }

  &.--theme-danger {
    background-color: $color-danger;
    border-color: $color-danger;
    transition: background-color 0.2s;

    &:hover:not(:disabled) {
      background-color: #e63939; // Slightly darker danger
    }
  }

  &.--theme-text {
    border-color: transparent;
    background-color: rgba(255, 255, 255, 0.05);
    transition: background-color 0.2s;

    &:hover:not(:disabled) {
      background-color: rgba(255, 255, 255, 0.1);
    }
  }

  /* size */
  &.--mini {
    height: 24px;
    border-radius: 4px;
    padding: 2px 16px;
    font-size: 12px;
    line-height: 18px;
  }

  &.--small {
    height: 34px;
    padding: 4px 16px;
    font-size: 12px;
    line-height: 18px;
  }

  &.--medium {
    height: 48px;
    padding: 12px 16px;
    font-size: 14px;
    line-height: 24px;
  }
}
</style>
