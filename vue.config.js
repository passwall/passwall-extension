
const fs = require('fs');
const path = require('path');

module.exports = {
  configureWebpack: {
    devtool: 'source-map',
    optimization: {
      minimize: true,
    },
    performance: {
      hints: 'warning',
      maxAssetSize: 1000000,
      maxEntrypointSize: 800000,
    },
  },
  chainWebpack: (config) => {
    // Build sırasında content_security_policy alanını string olarak ayarla
    config.plugin('copy').tap(([options]) => {
      const to = options[0].to;
      const from = options[0].from;
      const transform = options[0].transform;

      options[0].transform = (content, path) => {
        if (path.endsWith('manifest.json')) {
          const manifest = JSON.parse(content.toString());

          // content_security_policy alanını string olarak ayarla
          manifest.content_security_policy = "script-src 'self'; object-src 'self';";

          return JSON.stringify(manifest, null, 2);
        }
        return transform ? transform(content, path) : content;
      };

      return [options];
    });
  },
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
