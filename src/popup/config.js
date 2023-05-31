import Vue from 'vue'
import store from '@p/store'
import router from '@p/router'

const request = async (callback, waitKey, errorCallback = null, retry = false) => {
  window.wait.start(waitKey)

  try {
    await callback()
  } catch (error) {
    console.error(error)

    // No connection
    if (!error.response) {
      this.$notifyError('Network Error !')
      window.wait.end(waitKey)
      return
    }

    if (error.response.status === 401 && !router.app._route.meta.auth && !retry) {
      // Refresh token
      try {
        await store.dispatch('RefreshToken')
        // Retry the connection
        return this.$request(callback, waitKey, errorCallback, true)
      } catch (refreshError) {
        this.$notifyError('Authorization expired.')

        // Reset all tokens
        await store.dispatch('Logout')
        return router.push({ name: 'Login' })
      }
    }

    if (errorCallback) {
      errorCallback(error)
    } else if (error.response.status >= 500) {
      this.$notifyError(i18n.t('API500ErrorMessage'))
    } else if (error.response.data.Message && error.response.status != 401) {
      this.$notifyError(error.response.data.Message)
    }
  } finally {
    window.wait.end(waitKey)
  }
}
export default request

if (
  // From testing the following conditions seem to indicate that the popup was opened on a secondary monitor
  window.screenLeft < 0 ||
  window.screenTop < 0 ||
  window.screenLeft > window.screen.width ||
  window.screenTop > window.screen.height
) {
  chrome.runtime.getPlatformInfo(function (info) {
    if (info.os === 'mac') {
      const fontFaceSheet = new CSSStyleSheet()
      fontFaceSheet.insertRule(`
        @keyframes redraw {
          0% {
            opacity: 1;
          }
          100% {
            opacity: .99;
          }
        }
      `)
      fontFaceSheet.insertRule(`
        html {
          animation: redraw 1s linear infinite;
        }
      `)
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, fontFaceSheet]
    }
  })
}
