module.exports = {
  root: true,
  env: {
    node: true,
    webextensions: true
  },
  extends: ['plugin:vue/essential'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',

    // Legacy Vue codebase compatibility (keep lint usable for releases)
    'vue/multi-word-component-names': 'off',
    'vue/no-reserved-component-names': 'off',
    'vue/no-v-model-argument': 'off',
    'vue/no-reserved-keys': 'off',
    'vue/no-unused-vars': 'off'
  }
}

