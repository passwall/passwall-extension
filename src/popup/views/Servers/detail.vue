<template>
  <div>
    <Header class="bg-black-400">
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
    <div class="scroll">
      <FormRowText
        :value="detail.title"
        title="title"
        :edit-mode="false"
        :show-icons="false"
      >
        <template v-slot:second-icon> <div /> </template>
      </FormRowText>
      <FormRowText
        :value="detail.ip"
        title="ip"
        :edit-mode="false"
        :show-icons="false"
      >
        <template v-slot:second-icon> <div /> </template>
      </FormRowText>
      <FormRowText
        :value="detail.username"
        title="username"
        :edit-mode="false"
        :show-icons="true"
      >
        <template v-slot:second-icon> <div /> </template>
      </FormRowText>
      <FormRowText
        :value="detail.password"
        title="password"
        :edit-mode="false"
        :show-icons="true"
        password
      />
      <FormRowText
        :value="detail.url"
        title="website"
        :edit-mode="false"
        :show-icons="true"
      >
        <template v-slot:second-icon>
          <VIcon class="c-pointer" name="external-link" @click="openLink" />
        </template>
      </FormRowText>
      <FormRowText
        :value="detail.hosting_username"
        title="hosting username"
        :edit-mode="false"
        :show-icons="true"
      >
        <template v-slot:second-icon> <div /> </template>
      </FormRowText>
      <FormRowText
        :value="detail.hosting_password"
        title="hosting password"
        :edit-mode="false"
        :show-icons="true"
        password
      />
      <FormRowText
        :value="detail.admin_username"
        title="admin username"
        :edit-mode="false"
        :show-icons="true"
      >
        <template v-slot:second-icon> <div /> </template>
      </FormRowText>
      <FormRowText
        :value="detail.admin_password"
        title="admin password"
        :edit-mode="false"
        :show-icons="true"
        password
      />
      <div class="mb-7">
        <VTextArea :value="detail.extra" label="Extra" name="extra" disabled />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  methods: {
    openLink() {
      this.$browser.tabs.create({
        url: this.detail.url,
      });
    },
  },
  computed: {
    detail() {
      return this.$store.state.Servers.detail;
    },
  },
};
</script>

<style lang="scss">
.trash {
  color: $color-danger;
}
</style>
