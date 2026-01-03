<template>
  <div class="container">
    <Header class="bg-black-400">
      <template v-slot:content>
        <VIcon class="c-pointer c-white" name="arrow-left" @click="goBack" />
        <div class="d-flex flex-auto ml-2">
          <span class="fw-bold h5 ml-2 c-white">Password Generator</span>
        </div>
      </template>
    </Header>
    <div class="mx-4 mt-5">
      <div class="password-length mb-4">
        <div class="d-flex flex-row flex-justify-between mb-2">
          <span>Length</span>
          <input type="text" v-model="passwordLength" class="password-length-input" disabled />
        </div>
        <input 
          ref="rangeSlider"
          type="range" 
          min="6" 
          max="24" 
          v-model.number="passwordLength"
          @input="onSliderChange"
        />
      </div>
      <div class="d-flex flex-row flex-justify-between mb-5">
        <div class="password-options" v-for="(type, index) in getComplexities" :key="type.name">
          <label class="d-flex flex-items-center">
            <input 
              type="checkbox" 
              v-model="type.checked"
              @change="onCheckboxChange"
            />
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
        { name: 'Symbols', value: chars.special, checked: true },
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
    goBack() {
      // Always go to Home instead of using router.back()
      // This fixes the issue when reopening the extension
      this.$router.push({ name: 'Home' })
    },

    onGenerate: function() {
      const charSet = this.complexities
        .filter(item => item.checked)
        .reduce((acc, current) => {
          return acc + current.value
        }, '')

      // Ensure at least one complexity is checked
      if (charSet.length === 0) {
        return
      }

      let generatedPassword = ''
      for (let i = 0; i < this.passwordLength; i++) {
        generatedPassword += charSet.charAt(Math.floor(Math.random() * charSet.length))
      }
      this.password = generatedPassword
      
      // Save to storage
      this.saveSettings()
    },

    onCheckboxChange() {
      this.saveSettings()
      this.onGenerate()
    },

    async saveSettings() {
      await Storage.setItem('passwordLength', this.passwordLength)
      await Storage.setItem('complexities', this.complexities)
      await Storage.setItem('generatedPassword', this.password)
    },

    updateSliderBackground(event) {
      const slider = event.target
      const min = slider.min || 6
      const max = slider.max || 24
      const value = slider.value
      
      // Calculate percentage
      const percentage = ((value - min) / (max - min)) * 100
      
      // Update background gradient (left: blue, right: primary-400)
      slider.style.background = `linear-gradient(to right, #00FFD1 0%, #00FFD1 ${percentage}%, #151C27 ${percentage}%, #151C27 100%)`
    },

    onSliderChange(event) {
      // Update slider background
      this.updateSliderBackground(event)
      // Save length change
      this.saveSettings()
      // Generate new password on slider change
      this.onGenerate()
    }
  },
  async mounted() {
    // Load saved settings from storage FIRST
    const [passwordLength, savedComplexities, generatedPassword] = await Promise.all([
      Storage.getItem('passwordLength'),
      Storage.getItem('complexities'),
      Storage.getItem('generatedPassword')
    ])

    // Restore password length
    if (passwordLength !== null && typeof passwordLength === 'number') {
      this.passwordLength = passwordLength
    }

    // Restore complexities with proper reactivity
    // FIX: Chrome storage converts arrays to objects, so check for both
    let complexitiesArray = null
    if (savedComplexities !== null && typeof savedComplexities === 'object') {
      if (Array.isArray(savedComplexities)) {
        complexitiesArray = savedComplexities
      } else {
        // Convert object to array (Chrome storage bug workaround)
        complexitiesArray = Object.values(savedComplexities)
      }
    }
    
    if (complexitiesArray && complexitiesArray.length === 4) {
      // Create new array to trigger reactivity
      const newComplexities = []
      
      this.complexities.forEach((defaultItem) => {
        const saved = complexitiesArray.find(s => s.name === defaultItem.name)
        newComplexities.push({
          name: defaultItem.name,
          value: defaultItem.value,
          checked: saved ? saved.checked : defaultItem.checked,
          visible: defaultItem.visible
        })
      })
      
      // Replace entire array (triggers reactivity)
      this.complexities = newComplexities
    }

    // Restore password
    if (generatedPassword && typeof generatedPassword === 'string') {
      this.password = generatedPassword
    } else {
      this.onGenerate()
    }

    // THEN initialize slider background
    this.$nextTick(() => {
      if (this.$refs.rangeSlider) {
        const event = { target: this.$refs.rangeSlider }
        this.updateSliderBackground(event)
      }
    })
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
    font-size: 16px;
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
    color: $color-gray-300; // #8b93a1 - Gray 300
    text-transform: uppercase;
    font-size: inherit;
    font-weight: 600;
  }

  input[type='text'] {
    width: 20px;
    height: 13px;
    font-size: inherit;
    text-align: center;
    color: $color-secondary; // #00FFD1 - Mavi
    border-width: 0;
    background-color: transparent;
    font-weight: 600;
  }

  input[type='range'] {
    width: 100%;
    -webkit-appearance: none;
    appearance: none;
    height: 6px;
    background: $color-primary-400; // #151C27
    border-radius: 3px;
    outline: none;

    // Chrome, Safari, Edge - Thumb
    &::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      background: $color-secondary; // #00FFD1 - Mavi
      cursor: pointer;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    // Firefox - Thumb
    &::-moz-range-thumb {
      width: 18px;
      height: 18px;
      background: $color-secondary; // #00FFD1 - Mavi
      cursor: pointer;
      border-radius: 50%;
      border: none;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    // Firefox - Track
    &::-moz-range-track {
      background: $color-primary-400; // #151C27
      border-radius: 3px;
    }

  }
}

.password-options {
  label {
    cursor: pointer;
  }

  input[type='checkbox'] {
    margin-right: 7px;
    cursor: pointer;
    width: 16px;
    height: 16px;
    -webkit-appearance: none;
    appearance: none;
    background-color: transparent;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 3px;
    position: relative;
    transition: all 0.2s;

    &:checked {
      background-color: $color-secondary; // #00FFD1 - Mavi
      border-color: $color-secondary;
    }

    &:checked::after {
      content: '';
      position: absolute;
      left: 4px;
      top: 1px;
      width: 4px;
      height: 8px;
      border: solid $color-gray-500;
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
    }

    &:hover {
      border-color: $color-secondary;
    }
  }

  span {
    font-size: 13px;
    color: $color-gray-450; // #CECFD1 (Numbers, Symbols, Capital Letters)
    font-weight: 500;
  }
}
</style>
