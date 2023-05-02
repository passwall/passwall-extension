<template>
  <div class="form-row">
    <label v-text="title" class="title" />
    <VFormText
      v-if="editMode"
      :value="value"
      theme="no-border"
      @input="$emit('input', $event)"
      :placeholder="$t('ClickToFill')"
    />
    <!-- Text -->
    <div v-else class="d-flex flex-items-center flex-justify-between px-3 py-2">
      <span v-text="show ? value : '●●●●●●'" class="fw-medium h6 w-80 mr-2 p-1 field" />
      <div class="d-flex flex-items-center" v-if="showIcons">
        <slot name="second-icon">
          
          <ShowPassButton @click="show = $event" />
        </slot>
        <ClipboardButton class="ml-2" v-if="value" :copy="value" />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FormRowText',

  props: {
    title: String,
    value: String,
    editMode: Boolean,
    showIcons: Boolean,
    password: {
      type: Boolean,
      default: false
    }
  },

  data() {
    return {
      show: !this.password
    }
  }
}
</script>

<style lang="scss" scoped>
.title {
  letter-spacing: 2px;
  color: $color-gray-300;
  text-transform: uppercase;
}
.field {
  white-space: nowrap;
  overflow: auto;
  scrollbar-width: none;
}
</style>
