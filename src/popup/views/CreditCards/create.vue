<template>
  <div>
    <Header class="bg-black-400">
      <template v-slot:content>
        <VIcon class="c-pointer" name="arrow-left" @click="$router.back()" />
        <div class="d-flex flex-auto flex-items-center ml-4">
          <div class="new-logo">
            <VIcon name="logo-simple" height="40px" width="40px" />
          </div>
          <span class="fw-bold h5 ml-2">New</span>
        </div>
        <div>
          <VIcon class="c-pointer trash" name="trash" />
          <VIcon class="c-pointer ml-3" name="cogs" />
        </div>
      </template>
    </Header>
    <div class="scroll">
      <form @submit.stop.prevent="onSubmit">
        <div class="form-row">
          <label v-text="'Title'" />
          <VFormText
            name="Title"
            v-model="form.title"
            v-validate="'required'"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Card Holder Name'" />
          <VFormText
            name="Card Holder Name"
            v-model="form.cardHolderName"
            v-validate="'required'"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Type'" />
          <VFormText
            name="Type"
            v-model="form.type"
            v-validate="'required'"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Number'" />
          <VFormText
            name="Number"
            v-model="form.number"
            v-validate="'required'"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Expiration Date'" />
          <VFormText
            name="Expiration Date"
            v-model="form.expiryDate"
            v-validate="'required'"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>
        <div class="form-row">
          <label v-text="'Verification Number'" />
          <div class="d-flex flex-justify-between ">
            <VFormText
              name="Verification Number"
              v-model="form.verificationNumber"
              v-validate="'required'"
              :placeholder="$t('ClickToFill')"
              theme="no-border"
              :type="showPass ? 'text' : 'password'"
            />
            <div class="d-flex flex-items-center mr-3">
              <ShowPassButton @click="showPass = $event" />
            </div>
          </div>
          <div class="form-row px-3 pb-3">
            <VButton type="submit" class="flex-auto mt-3" size="medium">
              {{ $t("Save") }}
            </VButton>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      showPass: false,
      form: {
        title: "",
        cardHolderName: "",
        type: "",
        number: "",
        expiryDate: "",
        verificationNumber: "",
      },
    };
  },
  methods: {
    async onSubmit() {
      if (!(await this.$validator.validateAll())) return;
    },
  },
  computed: {
    detail() {
      return this.$store.state.CreditCards.detail;
    },
  },
};
</script>

<style lang="scss">
.trash {
  color: $color-danger;
}

.new-logo {
  background-color: $color-gray-400;
  border-radius: 8px;
}
</style>
