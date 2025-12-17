<template>
  <div class="form-row">
    <label v-text="title" class="title" />
    <!-- Edit Mode -->
    <div v-if="editMode" class="d-flex flex-items-center flex-justify-between">
      <VFormText
        class="flex-auto"
        style="min-width: 0; overflow: hidden;"
        :modelValue="modelValue"
        theme="no-border"
        @update:modelValue="$emit('update:modelValue', $event)"
        :placeholder="$t('ClickToFill')"
        :type="password && !forceShow && !show ? 'password' : 'text'"
      />
      <div class="d-flex flex-items-center mr-3" style="flex-shrink: 0;" v-if="showIcons">
        <slot name="second-icon">
          <ShowPassButton v-if="password" @click="show = $event" class="ml-2" />
        </slot>
        <ClipboardButton v-if="modelValue" :copy="modelValue" class="ml-2" />
      </div>
    </div>
    <!-- Display Mode -->
    <div v-else class="d-flex flex-items-center flex-justify-between px-3 py-2">
      <span v-text="displayValue" class="fw-medium h6 mr-2 p-1 field" style="flex: 1; min-width: 0;" />
      <div class="d-flex flex-items-center" style="flex-shrink: 0;" v-if="showIcons">
        <slot name="second-icon">
          <ShowPassButton v-if="password" @click="show = $event" class="ml-2" />
        </slot>
        <ClipboardButton v-if="modelValue" :copy="modelValue" class="ml-2" />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FormRowText',

  props: {
    title: String,
    modelValue: [String, Number],
    editMode: Boolean,
    showIcons: Boolean,
    password: {
      type: Boolean,
      default: false
    },
    forceShow: {
      type: Boolean,
      default: false
    }
  },

  emits: ['update:modelValue'],

  data() {
    return {
      show: !this.password
    }
  },

  computed: {
    displayValue() {
      if (!this.password) return this.modelValue
      if (this.forceShow || this.show) return this.modelValue
      return '●●●●●●'
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
  color: #fff;
}
</style>
