<template>
  <div>
    <Header class="bg-black-400">
      <template v-slot:content>
        <VIcon class="c-pointer" name="arrow-left" @click="$router.back()" />
        <div class="d-flex flex-auto flex-items-center ml-4">
          <CompanyLogo :url="detail.title" />
          <span class="fw-bold h5 ml-2">{{ detail.title }}</span>
        </div>
        <div>
          <VIcon class="c-pointer trash" name="trash" />
          <VIcon class="c-pointer ml-3" name="cogs" />
        </div>
      </template>
    </Header>
    <div class="scroll">
      <FormRowText :value="detail.title" title="title" :edit-mode="false" :show-icons="false">
        <template v-slot:second-icon> <div /> </template>
      </FormRowText>
      <FormRowText
        :value="detail.account_name"
        title="account name"
        :edit-mode="false"
        :show-icons="true"
      >
        <template v-slot:second-icon> <div /> </template>
      </FormRowText>
      <FormRowText
        :value="detail.account_number"
        title="account number"
        :edit-mode="false"
        :show-icons="true"
      >
        <template v-slot:second-icon> <div /> </template>
      </FormRowText>
      <FormRowText :value="detail.iban" title="iban" :edit-mode="false" :show-icons="true">
        <template v-slot:second-icon> <div /> </template>
      </FormRowText>
      <FormRowText :value="detail.currency" title="currency" :edit-mode="false" :show-icons="true">
        <template v-slot:second-icon> <div /> </template>
      </FormRowText>
      <FormRowText
        :value="detail.password"
        title="password"
        :edit-mode="false"
        :show-icons="true"
        password
      />
    </div>
  </div>
</template>

<script>
export default {
  methods: {},
  computed: {
    detail() {
      return this.$store.state.BankAccounts.detail
    }
  }
}
</script>

<style lang="scss">
.trash {
  color: $color-danger;
}
</style>
