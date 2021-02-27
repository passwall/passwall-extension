<template>
  <div>
    <Header class="bg-black-400">
      <template v-slot:content>
        <div class="d-flex flex-items-center w-100">
          <VIcon class="c-pointer" name="arrow-left" @click="goBack" />
          <div class="d-flex flex-auto flex-items-center ml-3">
            <CompanyLogo :url="form.url" />
            <span class="title fw-bold h5 ml-2">{{
              form.title || $helpers.parseHostName(form.url)
            }}</span>
          </div>
          <div class="d-flex">
            <VIcon class="c-pointer trash" name="trash" />
            <VIcon class="c-pointer ml-2" name="cogs" />
          </div>
        </div>
      </template>
    </Header>
    <div class="scroll">
      <FormRowText
        :value="form.title || $helpers.parseHostName(form.url)"
        title="title"
        :edit-mode="false"
        :show-icons="false"
      >
        <template v-slot:second-icon>
          <div />
        </template>
      </FormRowText>
      <FormRowText 
        :value="form.username" 
        title="username" 
        :edit-mode="false" 
        :show-icons="true"
      >
        <template v-slot:second-icon> <div /> </template>
      </FormRowText>
      <FormRowText
        :value="form.password"
        title="password"
        :edit-mode="false"
        :show-icons="true"
        password
      />
      <FormRowText 
        :value="form.url" 
        title="website" 
        :edit-mode="false" 
        :show-icons="true"
      >
        <template v-slot:second-icon>
          <LinkButton :link="form.url" />
        </template>
      </FormRowText>

      <div class="mb-7">
        <VTextArea :value="form.extra" label="Note" name="note" disabled />
      </div>
    </div>
  </div>
</template>

<script>
import DetailMixin from '@/mixins/detail'

export default {
  mixins: [DetailMixin],
  methods: {
    openLink() {
      this.$browser.tabs.create({
        url: this.detail.url
      })
    },
    goBack() {
      this.$router.push({ name: 'Logins', params: { cache: true } })
    }
  }
}
</script>

<style lang="scss">
.trash {
  color: $color-danger;
}
.title {
  flex: 1;

  word-break: break-all;
}
</style>
