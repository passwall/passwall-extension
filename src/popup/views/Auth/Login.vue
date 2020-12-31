<template>
  <div>
    <div class="d-flex flex-justify-center flex-items-center header">
      <VIcon name="passwall-with-text" width="140px" height="32px" />
    </div>
    <div class="p-3 pt-4">
      <form class="login-form d-flex flex-column">
        <label v-text="'Username'" class="mb-2" />
        <VFormText
          v-model="LoginForm.username"
          size="medium"
          name="username"
          v-validate="'required'"
          placeholder="Your username"
        />
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
        passworld: "",
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
