<template>
  <div>
    <div class="d-flex flex-justify-center flex-items-center header">
      <VIcon name="passwall-with-text" width="140px" height="32px" />
    </div>
    <div class="p-3 pt-4">
      <form class="login-form d-flex flex-column">
        <label v-text="$t('Username')" class="mb-2" />
        <VFormText
          v-model="LoginForm.username"
          size="medium"
          name="username"
          v-validate="'required'"
          :placeholder="$t('YourUsername')"
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
        >
          {{ $t("Login") }}
        </VButton>

        <VButton
          theme="text"
          class="mt-3"
          type="submit"
          size="medium"
          style="letter-spacing: 2px"
        >
          {{ $t("SignUp") }}
        </VButton>
      </form>
    </div>
  </div>
</template>

<script>
export default {
  name: "Login",
  data() {
    return {
      LoginForm: {
        username: "",
        master_password: "",
      },
    };
  },
};
</script>

<style lang="scss">
.header {
  height: 95px;
  border-bottom: 2px solid $color-black;
}
</style>
