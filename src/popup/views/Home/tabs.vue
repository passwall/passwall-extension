<template>
  <div class="d-flex flex-justify-between tabs" v-bind="$attrs">
    <VIcon
      name="lock"
      :class="[{ active: getColor('Passwords') }, 'c-pointer']"
      @click="switchTabs('Passwords')"
    />
    <VIcon
      name="clipboard-secure"
      :class="[{ active: getColor('Notes') }, 'c-pointer']"
      @click="switchTabs('Notes')"
    />
    <VIcon
      name="map-pin"
      :class="[{ active: getColor('Addresses') }, 'c-pointer']"
      @click="switchTabs('Addresses')"
    />
    <VIcon
      name="credit-card"
      :class="[{ active: getColor('PaymentCards') }, 'c-pointer']"
      @click="switchTabs('PaymentCards')"
    />
    <VIcon
      name="shield-check"
      :class="[{ active: getColor('BankAccounts') }, 'c-pointer']"
      @click="switchTabs('BankAccounts')"
    />
  </div>
</template>

<script>
import { useAuthStore } from '@/stores/auth'
import { storeToRefs } from 'pinia'

export default {
  name: 'Tabs',
  setup() {
    const authStore = useAuthStore()
    const { hasProPlan } = storeToRefs(authStore)
    
    return {
      hasProPlan
    }
  },
  methods: {
    switchTabs(name) {
      if (this.hasProPlan) {
        this.$router.replace({ name })
      } else {
        if (name === "Passwords") {this.$router.replace({ name })}
      }
    },
    getColor(name) {
      return this.$route.name === name
    }
  }
}
</script>

<style lang="scss" scoped>
.active {
  transition: 0.2s;
  color: $color-secondary;
}
</style>
