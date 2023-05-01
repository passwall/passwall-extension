<template>
  <div class="content">
    <Header class="bg-black-400">
      <template v-slot:content>
        <div class="d-flex flex-items-center w-100">
          <VIcon class="c-pointer" name="arrow-left" @click="goBack" />
          <div class="d-flex flex-auto flex-items-center ml-3">
            <CompanyLogo :url="form.url" />
            <span class="title fw-bold h5 ml-2">{{
              form.title || $helpers.getHostName(form.url)
            }}</span>
          </div>
          <div class="d-flex">
            <!-- Delete Btn -->
            <button v-tooltip="$t('Delete')" @click="onClickDelete">
              <VIcon class="c-pointer trash" name="trash" />
            </button>

            <!-- Edit Btn -->
            <button v-if="!isEditMode" v-tooltip="$t('Edit')" @click="isEditMode = true">
              <VIcon class="c-pointer ml-2 cogs" name="cogs" />
            </button>

            <!-- Fill Btn -->
            <button v-if="!isEditMode" v-tooltip="$t('Fill')" @click="fillForm">
              <VIcon class="c-pointer ml-2 plus" name="plus" />
            </button>
          </div>
        </div>
      </template>
    </Header>
    <div class="scroll detail">
      <form class="form" @submit.stop.prevent="onClickUpdate">
        <FormRowText v-model="form.title" title="title" :edit-mode="isEditMode" :show-icons="false">
          <template v-slot:second-icon> <div /> </template>
        </FormRowText>
        <FormRowText
          v-model="form.username"
          title="username"
          :edit-mode="isEditMode"
          :show-icons="true"
        >
          <template v-slot:second-icon> <div /> </template>
        </FormRowText>
        <FormRowText
          v-model="form.password"
          title="password"
          :edit-mode="isEditMode"
          :show-icons="true"
          password
        />
        <FormRowText v-model="form.url" title="website" :edit-mode="isEditMode" :show-icons="true">
          <template v-slot:second-icon>
            <LinkButton :link="form.url" />
          </template>
        </FormRowText>

        <div>
          <VTextArea
            v-model="form.extra"
            label="Extra"
            name="extra"
            :placeholder="$t(isEditMode ? 'ClickToFill' : 'ContentHidden')"
            :disabled="!isEditMode"
            minheight=110
          />
        </div>

        <!-- Save & Cancel -->
        <div class="d-flex m-2" v-if="isEditMode">
          <VButton class="flex-1" theme="text" :disabled="loading" @click="isEditMode = false">
            {{ $t('Cancel') }}
          </VButton>
          <VButton class="flex-1" type="submit" :loading="loading">
            {{ $t('Save') }}
          </VButton>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import DetailMixin from '@/mixins/detail'

export default {
  mixins: [DetailMixin],

  data() {
    return {
      isEditMode: false,
      showPass: false
    }
  },

  beforeRouteUpdate(to, from, next) {
    this.isEditMode = false
    this.showPass = false
    next()
  },

  methods: {
    ...mapActions('Logins', ['Delete', 'Update']),

    openLink() {
      this.$browser.tabs.create({
        url: this.detail.url
      })
    },

    goBack() {
      this.$router.push({ name: 'Logins', params: { cache: true } })
    },

    onClickDelete() {
      const onSuccess = async () => {
        await this.Delete(this.form.id)
        const index = this.ItemList.findIndex(item => item.id == this.form.id)
        if (index !== -1) {
          this.ItemList.splice(index, 1)
        }
        this.$router.push({ name: 'Logins', params: { cache: true } })
      }
      if (confirm('Are you sure you want to delete'))
        this.$request(onSuccess, this.$waiters.Logins.Delete)
    },

    async onClickUpdate() {
      const onSuccess = async () => {
        await this.Update({ ...this.form })
        this.$router.push({ name: 'Logins', params: { cache: true } })
      }

      await this.$request(onSuccess, this.$waiters.Logins.Update)
      this.isEditMode = false
    },

    fillForm() {
      this.$browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        this.$browser.tabs
          .sendMessage(tabs[0].id, {
              message: "fill-form",
              data:{username: this.form.username, password: this.form.password}
            })
          .then(() => {
            console.log("Form data sent successfully")
          })
          .catch((error) => {
            console.error('Can not send form data Error: ', error);
          });
      });
    }
  },
  computed: {
    ...mapState('Logins', ['Detail', 'ItemList']),

    loading() {
      return this.$wait.is(this.$waiters.Logins.Update)
    }
  }
}
</script>

<style lang="scss">
.trash {
  color: $color-danger;
}
.cogs {
  color: #ffffff;
}
.title {
  flex: 1;
  word-break: break-all;
}
</style>
