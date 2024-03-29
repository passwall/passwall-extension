module.exports = {
  pages: {
    popup: {
      template: 'public/browser-extension.html',
      entry: './src/popup/main.js',
      title: 'Popup'
    },
    options: {
      template: 'public/options-page.html',
      entry: 'src/options/main.js',
      title: 'Passwall Extension Options'
    }
  },
  css: {
    loaderOptions: {
      sass: {
        additionalData: `@import "./src/styles/config/variables.scss";`
      }
    }
  },
  pluginOptions: {
    browserExtension: {
      componentOptions: {
        background: {
          entry: 'src/background-scripts/background-script.js'
        },
        contentScripts: {
          entries: {
            'content-script': ['src/content-scripts/content-script.js']
          }
        }
      }
    }
  }
}
