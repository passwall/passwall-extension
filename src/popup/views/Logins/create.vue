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
      <form @submit="onSubmit">
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
          <label v-text="'Username'" />
          <VFormText
            name="Username"
            v-model="form.username"
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
              <ClipboardButton :copy="form.password" />
              <!-- Show/Hide -->
              <ShowPassButton @click="showPass = $event" />
            </div>
          </div>
        </div>
        <div class="form-row">
          <label v-text="'Web Site'" />
          <div class="d-flex flex-justify-between">
            <VFormText
              name="Web Site"
              class="flex-auto"
              v-model="form.website"
              v-validate="'required'"
              :placeholder="$t('ClickToFill')"
              theme="no-border"
            />
            <LinkButton class="mr-3" :link="form.website" />
          </div>
        </div>

        <div class="mb-7">
          <VTextArea :value="form.note" label="Note" name="note" />
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
        title: '',
        username: '',
        password: '',
        website: '',
        note: ''
      }
    }
  },
  methods: {
    onSubmit() {
      console.log('submit')
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
