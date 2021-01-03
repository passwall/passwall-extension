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
      <span v-text="value" class="fw-medium h6 mr-2" />
      <div class="d-flex flex-items-center" v-if="showIcons">
        <slot name="second-icon">
          <VIcon name="eye" size="20" />
        </slot>
        <ClipboardButton class="ml-2" v-if="value" :copy="value" />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "FormRowText",

  props: {
    title: String,
    value: String,
    editMode: Boolean,
    showIcons: Boolean,
  },
};
</script>

<style lang="scss" scoped>
.title {
  letter-spacing: 2px;
  color: $color-gray-300;
}
</style>
