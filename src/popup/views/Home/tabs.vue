<template>
  <div class="d-flex flex-justify-between tabs" v-bind="$attrs">
    <VIcon
      name="lock"
      :class="[{ active: getColor('Logins') }, 'c-pointer']"
      @click="switchTabs('Logins')"
    />
    <VIcon
      name="credit-card"
      :class="[{ active: getColor('CreditCards') }, 'c-pointer']"
      @click="switchTabs('CreditCards')"
    />
    <VIcon
      name="at-symbol"
      :class="[{ active: getColor('Emails') }, 'c-pointer']"
      @click="switchTabs('Emails')"
    />
    <VIcon
      name="shield-check"
      :class="[{ active: getColor('BankAccounts') }, 'c-pointer']"
      @click="switchTabs('BankAccounts')"
    />
    <VIcon
      name="clipboard-secure"
      :class="[{ active: getColor('Notes') }, 'c-pointer']"
      @click="switchTabs('Notes')"
    />
    <VIcon
      name="terminal"
      :class="[{ active: getColor('Servers') }, 'c-pointer']"
      @click="switchTabs('Servers')"
    />
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'Tabs',
  computed: {
    ...mapGetters(['hasProPlan'])
  },
  methods: {
    switchTabs(name) {
      if (this.hasProPlan) {
        this.$router.replace({ name })
      } else {
        if (name === "Logins") {this.$router.replace({ name })}
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
