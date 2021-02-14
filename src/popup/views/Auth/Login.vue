<template>
  <div>
    <div class="d-flex flex-justify-center flex-items-center header">
      <VIcon name="passwall-with-text" width="140px" height="32px" />
    </div>
    <div class="p-4 pt-5">
      <form
        class="login-form d-flex flex-column"
        @submit.stop.prevent="onLogin"
      >
        <label v-text="$t('EMailAddress')" class="mb-2" />
        <VFormText
          v-model="LoginForm.email"
          size="medium"
          name="username"
          v-validate="'required'"
          :placeholder="$t('YourEMailAddress')"
        />

        <label class="mb-2 mt-4" v-text="$t('Password')" />
        <VFormText
          v-model="LoginForm.master_password"
          size="medium"
          type="password"
          name="Password"
          :placeholder="$t('YourPassword')"
          v-validate="'required|min:6|max:100'"
        />

        <!-- Login Btn -->
        <VButton
          class="mt-5"
          type="submit"
          size="medium"
          style="letter-spacing: 2px"
          :loading="$wait.is($waiters.Auth.Login)"
        >
          {{ $t("Login") }}
        </VButton>

        <VButton
          theme="text"
          class="mt-3"
          size="medium"
          style="letter-spacing: 2px"
          @click="newTab"
        >
          {{ $t("SignUp") }}
        </VButton>
      </form>
    </div>
  </div>
</template>

<script>
import { mapActions } from "vuex";

export default {
  name: "Login",
  data() {
    return {
      LoginForm: {
        email: localStorage.email || "",
        master_password: "",
      },
    };
  },
  methods: {
    ...mapActions(["Login"]),
    async onLogin() {
      if (!(await this.$validator.validateAll())) return;
      const onError = (error) => {
        let text = this.$t("Ooops! Something went wrong!");
        if (error.response.status == 401) {
          text = this.$t(error.response.data.message);
        }
        this.$notifyError(text);
      };
      const onSuccess = async () => {
        await this.Login({ ...this.LoginForm });
        this.$router.replace({ name: "Home" });
      };
      this.$request(onSuccess, this.$waiters.Auth.Login, onError);
    },

    newTab() {
      this.$browser.tabs.create({
        url: "https://signup.passwall.io/",
      });
    },
  },
};
</script>

<style lang="scss">
.header {
  height: 95px;
  border-bottom: 2px solid $color-black;
}
</style>
