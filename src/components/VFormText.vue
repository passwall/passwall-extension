<template>
  <div class="form-text-wrapper">
    <input
      v-bind="$attrs"
      :type="$attrs.type || 'text'"
      :value="modelValue"
      :class="clazz"
      class="form-text"
      autocorrect="off"
      autocomplete="off"
      spellcheck="false"
      @input="updateModelValue"
    />
    <!-- Error -->
    <p class="error" v-if="getError" v-text="getError" />
  </div>
</template>

<script>
import { computed } from 'vue';

export default {
  name: 'VFormText',

  props: {
    name: String,
    modelValue: String,
    theme: {
      type: String,
      default: 'default'
    },
    size: {
      type: String,
      default: 'small'
    }
  },
  
  emits: ['update:modelValue'],
  
  setup(props, { emit }) {
    const clazz = computed(() => {
      return [`--${props.size}`, `--${props.theme}`, { '--error': getError.value }]
    })

    const getError = computed(() => {
      if (props.errors !== undefined) {
        const error = props.errors.items.find(e => e.field == props.name)
        return error ? error.msg : ''
      }
      return ''
    })

    const updateModelValue = event => {
      emit('update:modelValue', event.target.value);
    }

    return {
      clazz,
      getError,
      updateModelValue
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
