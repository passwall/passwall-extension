<template>
  <div>
    <Header class="bg-black-400">
      <template v-slot:content>
        <VIcon class="c-pointer" name="arrow-left" @click="$router.back()" />
        <div class="d-flex flex-auto flex-items-center ml-3">
          <CompanyLogo :url="detail.title" />
          <span class="fw-bold h5 ml-2">{{ detail.title }}</span>
        </div>
        <div class="d-flex">
          <VIcon class="c-pointer trash flex-shrink-0 " name="trash" />
          <VIcon class="c-pointer ml-3 flex-shrink-0 " name="cogs" />
        </div>
      </template>
    </Header>
    <div class="scroll">
      <FormRowText :value="detail.title" title="title" :edit-mode="false" :show-icons="false">
        <template v-slot:second-icon>
          <div />
        </template>
      </FormRowText>

      <div class="mb-7">
        <VTextArea :value="detail.note" label="Note" name="note" disabled />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  methods: {},
  computed: {
    detail() {
      return this.$store.state.Notes.detail
    }
  }
}
</script>

<style lang="scss">
.trash {
  color: $color-danger;
}
</style>
