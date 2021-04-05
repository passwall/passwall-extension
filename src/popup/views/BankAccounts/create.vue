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
      <form @submit.prevent="onSubmit" class="create-form">
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
          <label v-text="'Account Name'" />
          <VFormText
            name="account name"
            v-model="form.account_name"
            v-validate="'required'"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Account Number'" />
          <VFormText
            name="account number"
            v-model="form.account_number"
            v-validate="'required'"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'IBAN'" />
          <VFormText
            name="iban"
            v-model="form.iban"
            v-validate="'required'"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Currency'" />
          <VFormText
            name="currency"
            v-model="form.currency"
            v-validate="'required'"
            :placeholder="$t('ClickToFill')"
            theme="no-border"
          />
        </div>

        <div class="form-row">
          <label v-text="'Password'" />
          <div class="d-flex flex-justify-between ">
            <VFormText
              name="Password"
              class="flex-auto"
              v-model="form.password"
              v-validate="'required'"
              :placeholder="$t('ClickToFill')"
              theme="no-border"
              :type="showPass ? 'text' : 'password'"
            />
            <div class="d-flex flex-items-center mr-3">
              <ClipboardButton :copy="form.password" v-if="form.password" />
              <ShowPassButton @click="showPass = $event" />
            </div>
          </div>
        </div>

        <VButton
          class="mx-2 my-2"
          size="medium"
          type="submit"
          style="letter-spacing: 2px"
          :loading="$wait.is($waiters.BankAccounts.Create)"
        >
          Save
        </VButton>
      </form>
    </div>
  </div>
</template>

<script>
import { mapActions } from 'vuex'

export default {
  data() {
    return {
      showPass: false,
      form: {
        title: '',
        account_name: '',
        account_number: '',
        iban: '',
        currency: '',
        password: ''
      }
    }
  },
  methods: {
    ...mapActions('BankAccounts', ['Create']),
    async onSubmit() {
      if (!(await this.$validator.validateAll())) return
      const onSuccess = async () => {
        await this.Create({ ...this.form })
        this.$router.push({ name: 'BankAccounts' })
      }
      this.$request(onSuccess, this.$waiters.BankAccounts.Create)
    }
  }
}
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
