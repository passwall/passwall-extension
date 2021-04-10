<template>
  <button
    type="button"
    @click="checkPassword"
    class="password-check-btn"
    v-tooltip="$t('Check if password has been exposed.')"
  >
    <VIcon name="check" size="20px" />
  </button>
</template>

<script>
import Axios from 'axios'
import CryptoUtils from '@/utils/crypto'

export default {
  name: 'CheckPassword',

  props: {
    password: {
      type: String,
      default: ''
    }
  },

  methods: {
    async checkPassword() {
      var hash = CryptoUtils.sha1(this.password)
      var first = hash.substring(0, 5)
      var last = hash.slice(hash.length - 5)
      var found = false
      var times = ""


      try {
        const response = await Axios.get(`https://api.pwnedpasswords.com/range/${first}`)
        var returnedPasswords = response.data.split('\n')
        for (var i = 0; i < returnedPasswords.length; i++) {
          var row = returnedPasswords[i].split(':')
          if (row[0].slice(row[0].length - 5) === last) {
            found = true
            times = row[1]
            break
          }
        }

        if (found) {
          alert(`Password has been exposed ${times} times.`)
        } else {
          alert("Password is safe.")
        }

      } catch (err) {
        // Handle Error Here
        console.error(err)
      }
    }
  }
}
</script>

<style lang="scss">
.password-check-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background-color: $color-gray-500;
  color: $color-gray-300;
}
</style>
