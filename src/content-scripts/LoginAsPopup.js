import { getOffset, sendPayload } from '@/utils/helpers'

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
   * @param {Array<unknown>} logins
   * @param {import('./content-script').PForm} forms
   */
  constructor(target, logins, forms) {
    this.target = target
    this.logins = logins
    this.forms = forms
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
    let parsedRequest
    try {
      parsedRequest = JSON.parse(request)
    } catch (error) {
      return
    }

    switch (parsedRequest.type) {
      case 'LOGIN_AS_POPUP_RESIZE':
        this.height = parsedRequest.payload.height // resize dynamic height
        this.update()
        this.canDestroy = true
        break
      case 'LOGIN_AS_POPUP_FETCH':
        sendPayload({ type: 'LOGIN_AS_POPUP_FETCH', payload: this.logins }) // send logins to popup
        break
      case 'LOGIN_AS_POPUP_FILL_FORM':
        this.fillForm(parsedRequest.payload)
        break
      case 'LOGIN_AS_POPUP_CLOSE':
        this.destroy()
        break
    }
  }

  /**
   *
   * @param {string} username
   * @param {string} password
   */
  fillForm({ username, password }) {
    this.forms[0].inputs.forEach(input => {
      input.focus()
      if (input.type === 'password') input.value = password
      if (['text', 'email'].includes(input.type)) input.value = username
    })
    this.destroy()
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
