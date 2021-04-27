<template>
  <div class="container">
    <Header class="bg-black-400">
      <template v-slot:content>
        <VIcon class="c-pointer" name="arrow-left" @click="$router.back()" />
        <div class="d-flex flex-auto ml-2">
          <span class="fw-bold h5 ml-2">Password Generator</span>
        </div>
      </template>
    </Header>
    <div class="mx-4 mt-5">
      <div class="password-length mb-4">
        <div class="d-flex flex-row flex-justify-between mb-2">
          <span>Length</span>
          <input type="text" v-model="passwordLength" class="password-length-input" disabled />
        </div>
        <input type="range" min="6" max="24" v-model="passwordLength" />
      </div>
      <div class="d-flex flex-row flex-justify-between mb-5">
        <div class="password-options" v-for="type in getComplexities" :key="type.name">
          <label class="d-flex flex-items-center">
            <input type="checkbox" :checked="type.checked" @click="type.checked = !type.checked" />
            <span>{{ type.name }}</span>
          </label>
        </div>
      </div>
      <div class="d-flex flex-column">
        <div class="mb-4 password-input">
          <input type="text" :value="password" placeholder="Generate a new Password..." disabled />
          <span class="password-copy-button"><ClipboardButton :copy="password"/></span>
        </div>
        <button @click="onGenerate" class="password-generate-button">Generate</button>
      </div>
    </div>
  </div>
</template>

<script>
import Storage from '@/utils/storage'

const chars = {
  alphabet: 'abcdefghijklmnopqrstuvwxyz',
  numeric: '0123456789',
  special: '_-+=)/(*&^%$#@%!?~'
}

export default {
  name: 'Generator',
  data: function() {
    return {
      complexities: [
        { name: 'abc', value: chars.alphabet, checked: true, visible: false },
        { name: 'Numbers', value: chars.numeric, checked: true },
        { name: 'Symbols', value: chars.special, checked: false },
        { name: 'Capital Letters', value: chars.alphabet.toUpperCase(), checked: true }
      ],
      password: '',
      passwordLength: 10
    }
  },
  computed: {
    getComplexities: function() {
      return this.complexities.filter(item => item.visible !== false)
    }
  },
  methods: {
    onGenerate: function() {
      const charSet = this.complexities
        .filter(item => item.checked)
        .reduce((acc, current) => {
          return acc + current.value
        }, '')

      let generatedPassword = ''
      for (let i = 0; i < this.passwordLength; i++) {
        generatedPassword += charSet.charAt(Math.floor(Math.random() * charSet.length))
      }
      this.password = generatedPassword
      Storage.setItem('generatedPassword', this.password)
    }
  },
  async created() {
    const generatedPassword = await Storage.getItem('generatedPassword')
    if (generatedPassword === null) {
      this.onGenerate()
    } else {
      this.password = generatedPassword
    }
  }
}
</script>

<style lang="scss">
.password-input {
  position: relative;

  input {
    background-color: $color-black-400;
    height: $input-height;
    padding: 15px 10px;
    border: 0;
    color: $color-white;
    font-size: 13px;
    letter-spacing: 1px;
    border-radius: 10px;
    width: 100%;
    text-align: center;
  }

  span.password-copy-button {
    position: absolute;
    transform: translate(-30px, 50%);

    button {
      background-color: transparent;
    }
  }

  span.password-check-button {
    position: absolute;
    transform: translate(-55px, 50%);

    button {
      background-color: transparent;
    }
  }
}

.password-generate-button {
  height: $button-height-small;
  padding-top: 7px;
  padding-bottom: 7px;
  color: $color-white;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  background-color: $color-primary;
  border-radius: 7px;
}

.password-length {
  font-size: 12px;

  span {
    color: #aaa;
    text-transform: uppercase;
    font-size: inherit;
  }

  input[type='text'] {
    width: 20px;
    height: 13px;
    font-size: inherit;
    text-align: center;
    color: #aaa;
    border-width: 0;
    background-color: transparent;
  }

  input[type='range'] {
    width: 100%;
  }
}

.password-options {
  label {
    cursor: pointer;
  }

  input[type='checkbox'] {
    margin-right: 7px;
    cursor: pointer;
    width: 15px;
    height: 15px;
  }

  span {
    font-size: 13px;
  }
}
</style>
