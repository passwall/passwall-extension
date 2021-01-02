<template>
  <div class="d-flex flex-justify-center flex-items-center logoWrap">
    <img
      v-if="logoAvailable"
      class="logo"
      :src="`http://logo.clearbit.com/${domain}?size=40?format=png`"
      alt="logo"
      height="40"
      width="40"
      @error="logoAvailable = false"
    />
    <span class="fw-bold fs-big c-secondary" v-else v-text="logoLetter" />
  </div>
</template>

<script>
export default {
  name: "CompanyLogo",
  props: {
    url: {
      type: String,
      default: "",
    },
  },
  data() {
    return {
      logoAvailable: true,
    };
  },

  methods: {
    domainFromUrl(url) {
      const matches = url.match(/^(?:https?:)?(?:\/\/)?([^\/\?]+)/i);
      return matches ? matches[1] : "NONE";
    },
  },
  computed: {
    logoLetter() {
      return this.domain[0].toUpperCase();
    },
    domain() {
      return this.domainFromUrl(this.url);
    },
  },
};
</script>

<style lang="scss">
.logoWrap {
  width: 40px;
  height: 40px;
  background-color: $color-gray-400;
  border-radius: 8px;
}

.logo {
  border-radius: 8px;
}
</style>
