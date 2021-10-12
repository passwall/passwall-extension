import { getOffset } from '@/utils/helpers'

export class LoginAsPopup {
  /**
   * @type {HTMLElement} iframe
   */
  iframe

  /**
   * @type {boolean} canDestroy
   */
  canDestroy = false

  /**
   *
   * @param {HTMLElement} target
   */
  constructor(target) {
    this.target = target
    this.WIDTH = 350
    this.height = 206 // this will change
    this.className = `passwall-login-as-popup-${Math.floor(Math.random() * 9999)}`
  }

  /**
   *
   * @param {import('./content-script').RuntimeRequest} request
   * @param {*} sender
   * @param {*} sendResponse
   */
  async messageHandler(request, sender, sendResponse) {
    switch (request.type) {
      case 'LOGIN_AS_POPUP_RESIZE':
        this.height = request.payload.height // resize dynamic height
        this.update()
        this.canDestroy = true
        break
    }
  }

  onClickOutside(e) {
    if (!e.target.className.includes(this.className)) {
      if (this.canDestroy) this.destroy()
    }
  }

  create() {
    this.iframe = document.createElement('iframe')
    this.iframe.setAttribute('id', 'passwall-input-dialog')
    this.iframe.setAttribute('src', browser.runtime.getURL('popup.html#/Inject/loginAsPopup'))
    this.iframe.setAttribute('scrolling', 'no')
    this.iframe.setAttribute('class', this.className)

    document.body.appendChild(this.iframe)
    window.addEventListener('click', this.onClickOutside.bind(this), true)
  }

  update() {
    const { top, left, height, width } = getOffset(this.target)
    this.iframe.setAttribute(
      'style',
      `
    top: ${top + height + 1}px;
    left: ${left}px;
    width: ${this.WIDTH}px;
    height: ${this.height}px;
    border: 1px solid #8b93a1;
    border-radius: 16px;
    `
    )
  }

  render() {
    this.create()
    this.update()
  }

  destroy() {
    this.iframe.remove()
    window.removeEventListener('click', this.onClickOutside.bind(this), true)
  }
}
