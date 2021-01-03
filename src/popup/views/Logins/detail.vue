<template>
  <div>
    <Header>
      <template v-slot:content>
        <VIcon class="c-pointer" name="arrow-left" @click="$router.back()" />
        <div class="d-flex flex-auto flex-items-center ml-4">
          <CompanyLogo :url="detail.url" />
          <span class="fw-bold h5 ml-2">{{ detail.title }}</span>
        </div>
        <div>
          <VIcon class="c-pointer trash" name="trash" />
          <VIcon class="c-pointer ml-3" name="cogs" />
        </div>
      </template>
    </Header>
    <FormRowText
      :value="detail.title"
      :title="$t('TITLE')"
      :edit-mode="false"
      :show-icons="true"
    />
  </div>
</template>

<script>
export default {
  data() {
    return {
      form: {
        title: detail.title,
      },
    };
  },
  methods: {},
  computed: {
    detail() {
      return this.$store.state.Logins.detail;
    },
  },
};
</script>

<style lang="scss">
.trash {
  color: $color-danger;
}
</style>
