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
    <div class="mx-3 my-3">
      <div class="d-flex flex-column">
        <div class="d-flex flex-row flex-items-center">
          <input
            type="text"
            :value="password"
            class="password-input flex-1"
            placeholder="Generate a new Password..."
            disabled
          />
          <ClipboardButton :copy="password" />
        </div>
        <button @click="onGenerate" class="password-button">Generate</button>
      </div>
      <div class="d-flex flex-row flex-justify-center mt-3">
        <input type="range" min="6" max="24" v-model="passwordLength" />
        <input type="text" v-model="passwordLength" class="password-length-input" disabled />
      </div>
      <div class="d-flex flex-row flex-justify-between mt-3">
        <div
          class="password-options"
          v-for="type in complexities"
          :key="type.name"
          v-tooltip="$t(type.tooltip)"
        >
          <label class="d-flex flex-items-center">
            <input type="checkbox" :checked="type.checked" @click="type.checked = !type.checked" />
            <span>{{ type.name }}</span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
const chars = {
  alphabet: "abcdefghijklmnopqrstuvwxyz",
  numeric: "0123456789",
  special: "_-+=)/(*&^%$#@%!?~"
}

export default {
  name: "Generator",
  data: function() {
    return {
      complexities: [
        { name: "abc", value: chars.alphabet, checked: true, tooltip: "Lowercase" },
        { name: "ABC", value: chars.alphabet.toUpperCase(), checked: true, tooltip: "Uppercase" },
        { name: "123", value: chars.numeric, checked: true, tooltip: "Numeric" },
        { name: "*?!%&", value: chars.special, checked: false, tooltip: "Special Chars" }
      ],
      password: "",
      passwordLength: 8
    }
  },
  methods: {
    onGenerate: function() {
      const charSet = this.complexities
        .filter(item => item.checked)
        .reduce((acc, current) => {
          return acc + current.value
        }, "")

      let generatedPassword = ""
      for (let i = 0; i < this.passwordLength; i++) {
        generatedPassword += charSet.charAt(Math.floor(Math.random() * charSet.length))
      }
      this.password = generatedPassword
    }
  }
}
</script>

<style lang="scss">
.password-input {
  background-color: $color-black-400;
  height: $input-height;
  padding-top: 5px;
  padding-bottom: 5px;
  margin-right: 5px;
  border: 0;
  color: $color-white;
  font-size: 15px;
  text-align: center;
}

.password-button {
  height: $button-height-small;
  padding-top: 5px;
  padding-bottom: 5px;
  color: $color-white;
  font-size: 17px;
  font-weight: 600;
  background-color: $color-primary;
}

.password-length-input {
  width: 24px;
  height: 24px;
  font-size: 13px;
  font-weight: 500;
  text-align: center;
  color: $color-white;
  background-color: $color-primary;
  border-width: 0;
  border-radius: 28px;
  margin-left: 10px;
}

.password-options {
  label {
    cursor: pointer;
  }

  input {
    margin-right: 7px;
    cursor: pointer;
  }

  span {
    font-size: 14px;
  }
}
</style>
