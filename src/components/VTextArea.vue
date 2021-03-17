<template>
  <div class="text-area-wrapper">
    <div class="d-flex">
      <label v-if="label" class="title">{{ label }}</label>
            <!-- Copy button goes here -->
            <ClipboardButton :copy="value"></ClipboardButton>
            <!-- Show/Hide button goes here -->
            <button
              type="button"
              @click="showNote = !showNote"
              class="detail-page-header-icon ml-2"
              v-tooltip="$t(showNote ? 'Hide' : 'Show')">
              <VIcon :name="showNote ? 'eye-off' : 'eye'" size="12px" />
            </button>
    </div>
    <textarea
      :value="showNote || isEditable ? value : '●●●●●●'"
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
    isEditable: Boolean,
    label: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      showNote: false
    }
  },
  computed: {
    getError() {
      const error = this.errors.items.find(e => e.field == this.name)
      return error ? error.msg : ''
    },
    hiddenNote() {
      return this.note.replaceAll("","*");
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
