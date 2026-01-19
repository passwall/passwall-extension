import browser from 'webextension-polyfill'
import { getOffset } from '@/utils/helpers'

const POPUP_CONFIG = {
  ID: 'passwall-password-suggestion-popup',
  WIDTH: 320,
  INITIAL_HEIGHT: 84,
  BORDER: '1px solid #8b93a1',
  BORDER_RADIUS: '12px',
  Z_INDEX: 99999
}

const MESSAGE_TYPES = {
  READY: 'PASSWORD_SUGGESTION_READY',
  RESIZE: 'PASSWORD_SUGGESTION_RESIZE',
  INIT: 'PASSWORD_SUGGESTION_INIT',
  UPDATE: 'PASSWORD_SUGGESTION_UPDATE',
  APPLY: 'PASSWORD_SUGGESTION_APPLY',
  REFRESH: 'PASSWORD_SUGGESTION_REFRESH',
  CLOSE: 'PASSWORD_SUGGESTION_CLOSE'
}

function generateNonce() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export class PasswordSuggestionPopup {
  constructor(targetInput, password, { onApply, onRefresh, onDestroy } = {}) {
    if (!targetInput) {
      throw new Error('PasswordSuggestionPopup requires targetInput')
    }

    this.targetInput = targetInput
    this.password = password || ''
    this.onApply = typeof onApply === 'function' ? onApply : null
    this.onRefresh = typeof onRefresh === 'function' ? onRefresh : null
    this.onDestroy = typeof onDestroy === 'function' ? onDestroy : null

    this.iframeElement = null
    this.iframeReady = false
    this.pendingMessages = []
    this.width = POPUP_CONFIG.WIDTH
    this.height = POPUP_CONFIG.INITIAL_HEIGHT
    this.className = this.generateUniqueClassName()
    this.canDestroy = false

    this.boundClickHandler = null

    this.EXTENSION_ORIGIN = browser.runtime.getURL('').replace(/\/$/, '')
    this.nonce = generateNonce()
  }

  getIframeWindow() {
    return this.iframeElement?.contentWindow || null
  }

  getNonce() {
    return this.nonce
  }

  getExtensionOrigin() {
    return this.EXTENSION_ORIGIN
  }

  generateUniqueClassName() {
    const randomId = Math.floor(Math.random() * 9999)
    return `${POPUP_CONFIG.ID}-${randomId}`
  }

  sendMessageToIframe(message) {
    if (!this.iframeElement) {
      this.pendingMessages.push(message)
      return
    }

    if (!this.iframeReady) {
      this.pendingMessages.push(message)
      return
    }

    if (this.iframeElement.contentWindow) {
      this.iframeElement.contentWindow.postMessage(JSON.stringify(message), this.EXTENSION_ORIGIN)
    } else {
      this.pendingMessages.push(message)
    }
  }

  flushPendingMessages() {
    if (this.pendingMessages.length > 0 && this.iframeElement?.contentWindow) {
      this.pendingMessages.forEach((message) => {
        this.iframeElement.contentWindow.postMessage(JSON.stringify(message), this.EXTENSION_ORIGIN)
      })
      this.pendingMessages = []
    }
  }

  messageHandler(messageData) {
    const message =
      typeof messageData === 'string'
        ? (() => {
            try {
              return JSON.parse(messageData)
            } catch {
              return null
            }
          })()
        : messageData

    if (!message) return

    switch (message.type) {
      case MESSAGE_TYPES.READY:
        this.sendMessageToIframe({
          type: MESSAGE_TYPES.INIT,
          payload: { password: this.password }
        })
        break
      case MESSAGE_TYPES.RESIZE:
        this.handleResize(message.payload)
        break
      case MESSAGE_TYPES.APPLY:
        this.onApply?.(message.payload?.password || this.password)
        this.destroy()
        break
      case MESSAGE_TYPES.REFRESH:
        this.onRefresh?.()
        break
      case MESSAGE_TYPES.CLOSE:
        this.destroy()
        break
      default:
        break
    }
  }

  handleResize(payload) {
    if (payload?.height) {
      this.height = payload.height
      this.updatePosition()
    }
    this.canDestroy = true
  }

  setPassword(password) {
    this.password = password || ''
    this.sendMessageToIframe({
      type: MESSAGE_TYPES.UPDATE,
      payload: { password: this.password }
    })
  }

  handleClickOutside(event) {
    const isClickInsidePopup = event.target?.className?.includes?.(this.className)
    if (!isClickInsidePopup && this.canDestroy) {
      this.destroy()
    }
  }

  createIframe() {
    const iframe = document.createElement('iframe')
    const popupUrl = browser.runtime.getURL(
      `src/popup/index.html?pw_nonce=${this.nonce}#/Inject/passwordSuggestion`
    )

    iframe.setAttribute('id', POPUP_CONFIG.ID)
    iframe.setAttribute('src', popupUrl)
    iframe.setAttribute('scrolling', 'no')
    iframe.setAttribute('class', this.className)
    iframe.style.position = 'absolute'
    iframe.style.border = POPUP_CONFIG.BORDER
    iframe.style.borderRadius = POPUP_CONFIG.BORDER_RADIUS
    iframe.style.zIndex = POPUP_CONFIG.Z_INDEX

    this.iframeElement = iframe
    document.body.appendChild(iframe)

    iframe.addEventListener('load', () => {
      this.iframeReady = true
      this.sendMessageToIframe({ type: 'PASSWALL_HANDSHAKE', nonce: this.nonce })
      this.flushPendingMessages()
    })

    this.boundClickHandler = this.handleClickOutside.bind(this)
    window.addEventListener('click', this.boundClickHandler, true)
  }

  updatePosition() {
    if (!this.iframeElement) return

    const { top, left, height } = getOffset(this.targetInput)
    Object.assign(this.iframeElement.style, {
      top: `${top + height + 6}px`,
      left: `${left}px`,
      width: `${this.width}px`,
      height: `${this.height}px`
    })
  }

  render() {
    this.createIframe()
    this.updatePosition()
  }

  destroy() {
    if (this.iframeElement) {
      this.iframeElement.remove()
      this.iframeElement = null
    }

    if (this.boundClickHandler) {
      window.removeEventListener('click', this.boundClickHandler, true)
      this.boundClickHandler = null
    }

    this.pendingMessages = []
    this.iframeReady = false
    this.onDestroy?.()
  }
}
