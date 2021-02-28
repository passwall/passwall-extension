<template>
  <div>
    <Header class="bg-black-400">
      <template v-slot:content>
        <div class="d-flex flex-items-center w-100">
          <VIcon class="c-pointer" name="arrow-left" @click="goBack" />
          <div class="d-flex flex-auto flex-items-center ml-3">
            <CompanyLogo :url="form.title" />
            <span class="title fw-bold h5 ml-2">{{ form.title }}</span>
          </div>
          <div class="d-flex">
            <button v-tooltip="$t('Delete')" @click="onClickDelete">
              <VIcon class="c-pointer trash" name="trash" />
            </button>
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
        <template v-slot:second-icon> <div /> </template>
      </FormRowText>
      <FormRowText 
        :value="form.cardholder_name" 
        title="cardholder name" 
        :edit-mode="false" 
        :show-icons="true"
      >
        <template v-slot:second-icon> <div /> </template>
      </FormRowText>
      <FormRowText 
        :value="form.type" 
        title="type" 
        :edit-mode="false" 
        :show-icons="true"
      >
        <template v-slot:second-icon> <div /> </template>
      </FormRowText>
      <FormRowText 
        :value="form.number" 
        title="number" 
        :edit-mode="false" 
        :show-icons="true"
      >
        <template v-slot:second-icon> <div /> </template>
      </FormRowText>
      <FormRowText
        :value="form.expiry_date"
        title="expiry date"
        :edit-mode="false"
        :show-icons="true"
      >
        <template v-slot:second-icon> <div /> </template>
      </FormRowText>
      <FormRowText
        :value="form.verification_number"
        title="verification number"
        :edit-mode="false"
        :show-icons="true"
        password
      />
    </div>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import DetailMixin from '@/mixins/detail'

export default {
  mixins: [DetailMixin],
  methods: {
    ...mapActions('CreditCards', ['Delete']),

    openLink() {
      this.$browser.tabs.create({
        url: this.detail.url
      })
    },

    goBack() {
      this.$router.push({ name: 'CreditCards', params: { cache: true } })
    },

    onClickDelete() {
      const onSuccess = async () => {
        await this.Delete(this.form.id)
        const index = this.ItemList.findIndex(item => item.id == this.form.id)
        if (index !== -1) {
          this.ItemList.splice(index, 1)
        }
        this.$router.push({ name: 'CreditCards', params: { cache: true } })
      }

      this.$request(onSuccess, this.$waiters.CreditCards.Delete)
    }
  },
  computed: {
    ...mapState('CreditCards', ['ItemList'])
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
