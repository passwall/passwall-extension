module.exports = {
  pages: {
    popup: {
      template: 'public/browser-extension.html',
      entry: './src/popup/main.js',
      title: 'Popup'
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
          entry: 'src/background.js'
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
