<template>
  <div ref="window" class="px-3 py-4 window">
    <header class="d-flex flex-items-center flex-justify-between">
      <div class="d-flex flex-row flex-items-center">
        <VIcon name="passwall-logo" size="32px" />
        <p class="fs-medium fw-bold ml-2">SAVE NEW PASSWORD?</p>
      </div>
      <VIcon name="cross" size="20px" class="c-gray-300 mr-2 c-pointer" />
    </header>
    <ul class="mt-2">
      <li
        class="d-flex flex-row bg-black p-3 w-100 flex-items-center flex-justify-between radius c-pointer no-select"
        @click="showContent = !showContent"
      >
        <div class="d-flex flex-row">
          <CompanyLogo :url="'https://github.com/session'" check />
          <div class="ml-2">
            <p>Github</p>
            <p class="c-gray-300">ooruc471@yandex.com</p>
          </div>
        </div>
        <VIcon name="down-arrow" size="24px" class="c-gray-300" />
      </li>
      <div v-show="showContent" class="content bg-black">
        <FormRowText v-model="form.title" title="title" :show-icons="false"> </FormRowText>
        <FormRowText v-model="form.username" title="username" :show-icons="false">
          <template v-slot:second-icon> <div /> </template>
        </FormRowText>
        <FormRowText v-model="form.password" title="password" :show-icons="true" password />
        <FormRowText v-model="form.url" title="website" :show-icons="true">
          <template v-slot:second-icon>
            <LinkButton :link="form.url" />
          </template>
        </FormRowText>
      </div>
    </ul>
    <footer class="d-flex flex-row mt-3 flex-row-reverse flex-items-center flex-justify-between">
      <div class="d-flex flex-row-reverse flex-items-center">
        <VButton>
          <span class="fs-medium fw-bold">SAVE</span>
        </VButton>
        <VButton theme="text">
          <span class="fs-medium fw-bold c-gray-300">LATER</span>
        </VButton>
      </div>
      <VButton theme="text">
        <span class="fs-medium fw-bold c-danger">NEVER</span>
      </VButton>
    </footer>
  </div>
</template>

<script>
import { useLoginsStore } from '@/stores/logins'
import Storage from '@/utils/storage'

export default {
  name: 'SavePassword',
  setup() {
    const loginsStore = useLoginsStore()
    return {
      createLogin: loginsStore.create
    }
  },
  data() {
    return {
      showContent: false,
      showPass: false,
      form: {
        title: 'Github',
        username: 'ooruc471@yandex.com',
        password: 'test1234',
        url: 'https://news.ycombinator.com/login',
        extra: ''
      },
      action: '',
      listener: null
    }
  },

  async created() {
    console.log('Passwall save password iframe initialized successfully.')

    const storageFormData = await Storage.getItem('create_form')
    if (storageFormData === null) {
      this.$browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        console.log(tabs)
        /*   this.form.title = tabs[0].title
        this.form.url = tabs[0].url */
      })
    } else {
      this.form = storageFormData
    }

    // Report iframe loaded
    //this.tell('iframe-loaded')

    // Listen incoming messages
    this.$browser.runtime.onMessage.addListener(this.background_onMessage)
  },
  mounted() {
    // Tell dynamic height to content scirpt.
    const resizeObserver = new ResizeObserver(([box]) => {
      const currentHeight = box.borderBoxSize[0].blockSize
      console.log(box)
      this.tell('iframe-resize', { height: currentHeight })
    })
    resizeObserver.observe(this.$refs.window)
  },
  methods: {

    async onSubmit() {
      if (!(await this.$validator.validateAll())) return
      const onSuccess = async () => {
        await this.createLogin({ ...this.form })
        this.tell('close-iframe')
      }
      this.$request(onSuccess, this.$waiters.Logins.Create)
    },

    saveForm: function(event) {
      Storage.setItem('create_form', this.form)
    },

    cancel: function() {
      this.tell('close-iframe')
    },

    background_onMessage: function(request, sender, sendResponse) {
      // make sure the message was for this view (you can use the "*" wildcard to target all views)
      // if (!request.message || !request.data.view || (request.data.view != this.view && request.data.view != '*')) return;

      console.log("iframe'e gelen:" + request.message)

      this.processMessage(request.data)
    },

    processMessage: function(data) {
      this.form.username = data.username
      this.form.password = data.password
    },

    tell: function(message, data) {
      var data = data || {}

      window.parent.postMessage(
        {
          message: message,
          data: data
        },
        '*'
      )
    }
  }
}
</script>

<style lang="scss" scoped>
.content {
  border-top: 1px solid $color-gray-500;
}
</style>
