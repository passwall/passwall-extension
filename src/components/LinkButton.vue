<template>
  <button
    type="button"
    class="external-btn"
    v-tooltip="$t('OpenLink')"
    @click="openLink"
  >
    <VIcon class="c-pointer" name="external-link" size="20px" />
  </button>
</template>

<script>
export default {
  name: "LinkButton",
  props: {
    link: {
      type: String,
      default: "",
    },
  },
  methods: {
    openLink() {
      if (this.$helpers.isValidHttpUrl(this.link))
        this.$browser.tabs.create({
          url: this.link,
        });
    },
  },
};
</script>

<style lang="scss">
.external-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background-color: $color-gray-500;
  color: $color-gray-300;
}
</style>
