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

        <div>
          <VTextArea 
            :placeholder="$t('ClickToFill')" 
            v-model="form.note" 
            label="Note" 
            name="note" 
          />
        </div>

        <VButton
          class="mx-2 my-2"
          size="medium"
          type="submit"
          style="letter-spacing: 2px"
          :loading="$wait.is($waiters.Notes.Create)"
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
        note: ''
      }
    }
  },
  methods: {
    ...mapActions('Notes', ['Create']),
    async onSubmit() {
      if (!(await this.$validator.validateAll())) return
      const onSuccess = async () => {
        await this.Create({ ...this.form })
        this.$router.push({ name: 'Notes' })
      }
      this.$request(onSuccess, this.$waiters.Notes.Create)
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
