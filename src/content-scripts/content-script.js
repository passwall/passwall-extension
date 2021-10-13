const browser = require('webextension-polyfill')
import { EVENT_TYPES, PASSWALL_ICON_BS64 } from '@/utils/constants'
import { getDomain, getOffset, PFormParseError, RequestError, sendPayload } from '@/utils/helpers'
import { LoginAsPopup } from './LoginAsPopup'

/**
 * @typedef {Object} PForm
 * @property {HTMLElement} form
 * @property {HTMLElement[]} inputs
 */

/**
 * @typedef {Object} RuntimeRequest
 * @property {EVENT_TYPES} type
 * @property {*} payload
 *
 */

class Injector {
  /**
   * @type PForm[]
   */
  forms
  /**
   * @type string
   */
  domain

  /**
   * @type {Array<Function>} listeners
   */
  listeners
  constructor() {
    console.log('Passwall content-script initialize')
    browser.runtime.onMessage.addListener(this.messageHandler.bind(this)) // for background
    window.addEventListener('message', this.messageHandlerPopup.bind(this)) // for popup
    this.listeners = []
  }

  /**
   *
   * @param {RuntimeRequest} request
   * @param {*} sender
   * @param {*} sendResponse
   */
  async messageHandler(request, sender, sendResponse) {
    this.domain = getDomain(window.location.href)
    switch (request.type) {
      case 'TAB_UPDATE':
        try {
          this.forms = this.findFormAndFields()
          if (this.forms.length > 0) {
            // document has a login or register form
            console.log('forms detected', this.forms)
            sendPayload({
              type: 'REQUEST_LOGINS',
              payload: this.domain
            }).then(logins => {
              this.injectPasswallLogo(this.forms[0], logins)
            })
          }
        } catch (error) {
          if (error instanceof PFormParseError) {
            if (error.type === 'NO_PASSWORD_FIELD') {
              // Do nothing
            }
          } else console.error(error)
        }
        break
      default:
        break
    }
  }

  async messageHandlerPopup(request) {
    this.listeners.forEach(listener => listener(request.data))
  }

  /**
   * Parse inputs
   * @returns {PForm[]}
   */
  findFormAndFields() {
    const formArray = []
    const forms = document.querySelectorAll('form')
    const hasPasswordInput = Boolean(document.querySelector("input[type='password']"))
    if (!hasPasswordInput) throw new PFormParseError('No password field', 'NO_PASSWORD_FIELD')
    forms.forEach(form => {
      /**
       * @type {Array<HTMLElement>}
       */
      const inputs = [...form.querySelectorAll('input')].filter(
        node => ['text', 'email', 'password'].includes(node.type) && !node.hidden
      )
      if (!inputs.some(i => i.type === 'password')) return
      formArray.push({
        form,
        inputs
      })
    })
    return formArray
  }

  /**
   *
   * @param {PForm} form
   * @param {Array<unknown>} logins
   */
  injectPasswallLogo(form, logins) {
    form.inputs.forEach(input => {
      const image = document.createElement('img')
      const { top, left, height, width } = getOffset(input)
      const SIZE = height * 0.7

      image.setAttribute('id', 'passwall-input-icon')
      image.setAttribute(
        'style',
        `
      top: ${top + (height * (1 - SIZE / height)) / 2}px;
      left: ${left + width - SIZE - 5}px;
      height: ${SIZE}px;
      width: ${SIZE}px;
      z-index: 99999;
      `
      )
      image.alt = 'Passwall'
      image.src = PASSWALL_ICON_BS64
      image.onclick = e => this.injectLoginAsPopup(e, input, logins)

      document.body.appendChild(image)
    })
  }

  /**
   *
   * @param {MouseEvent} e
   * @param {HTMLElement} input
   * @param {Array<unknown>} logins
   */
  injectLoginAsPopup(e, input, logins) {
    // TODO: Simgeye çoklu tıkama olunca iframi sürekli açma
    const popup = new LoginAsPopup(input, logins, this.forms)
    this.listeners.push(popup.messageHandler.bind(popup))
    popup.render()
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Injector()
})

/* var Inject = (function() {
  // constants ----------------------------------------------------------------
  var ID = {
    CONTAINER: 'passwall-dialog',
    IFRAME_PREFIX: 'passwall-'
  }

  // variables ----------------------------------------------------------------
  var _this = {},
    _views = {},
    _container = null,
    _username,
    _password

  // initialize ---------------------------------------------------------------
  _this.init = function() {
    console.log('Passwall content script initialized successfully.')
    [_username, _password] = detectFormFields()
    if (_username && _password) {
      _password.addEventListener('blur', passwordListener)
    }

    // create the main container
    _container = $('<div />', { id: ID.CONTAINER })
    _container.appendTo(document.body);

    // add iframe
    getView('savePassword', _container)
    // getView('comment', _container);

    // listen to the iframes/webpages message
    window.addEventListener('message', dom_onMessage, false)

    // listen to the Control Center (background.js) messages
    browser.runtime.onMessage.addListener(background_onMessage)
  }

  // private functions --------------------------------------------------------
  function detectFormFields() {
    var inputs = document.querySelectorAll('input'),i
    var user, pass

    for (i = 0; i < inputs.length; ++i) {
      // Find password field.
      if (inputs[i].type === 'password') {
        pass = inputs[i]

        // Find username field. Check type against type hidden or checkbox etc.
        for (var k = i; k >= 0; k--) {
          if (inputs[k].type == 'text' || inputs[k].type == 'email') {
            user = inputs[k]
            break
          }
        }
      }
    }

    return [user, pass]
  }

  function passwordListener() {
    var data = {
      title: document.title,
      url: window.location.href,
      username: _username.value,
      password: _password.value
    }
    tell('fill-hashmap-from-content', data)
  }

  function getView(id) {
    // return the view if it's already created
    if (_views[id]) return _views[id]

    // iframe initial details
    var src = browser.runtime.getURL('popup.html#/savePassword')
    const iframeId = ID.IFRAME_PREFIX + id

    const iframe = $('<iframe />', {
      id: iframeId,
      src: src,
      scrolling: 'no'
    })

    // view
    _views[id] = {
      isLoaded: false,
      iframe: iframe
    }

    // add to the container
    _container.append(iframe)

    return _views[id]
  }

  // tell sends message to "background.js"
  function tell(message, data) {
    var data = data || {}

    browser.runtime.sendMessage({
      message: message,
      data: data
    })
  }

  function resizeIframe(height) {
    document.getElementById('passwall-savePassword').style.height = height + 'px'
  }

  function processMessage(request) {
    if (!request.message) return
    console.log('content scripte gelen: ', request.message)
    switch (request.message) {
      case 'close-iframe':
        _container.detach()
        break
      case 'fill-form':
        message_onFillForm(request.data)
        break
      case 'create-login':
        message_onCreateLogin(request.data)
        break
      case 'update-login':
        message_onUpdateLogin(request.data)
        break
      case 'iframe-loaded':
        message_onIframeLoaded(request.data)
        break
      case 'iframe-resize':
        resizeIframe(request.data.height)
        break
      //case 'heart-clicked': message_onHeartClicked(request.data); break;
      //case 'save-iheart': message_onSaved(request.data); break;
    }
  }

  // events -------------------------------------------------------------------
  // messages coming from iframes and the current webpage
  function dom_onMessage(event) {
    if (!event.data.message) return

    // tell another iframe a message
    if (event.data.view) {
      tell(event.data)
    } else {
      processMessage(event.data)
    }
  }

  // messages coming from "background.js"
  function background_onMessage(request, sender, sendResponse) {
    // if (request.data.view) return;
    processMessage(request)
  }

  // messages -----------------------------------------------------------------
  function message_onUpdateLogin(data) {
    // var view 		= getView(data.source),
    // 	allLoaded	= true;
    // view.isLoaded = true;
    // for (var i in _views){
    // 	if (_views[i].isLoaded === false) allLoaded = false;
    // }
    // // tell "background.js" that all the frames are loaded
    // if (allLoaded) tell('all-iframes-loaded');
  }

  function message_onCreateLogin(data) {
    var view = getView('savePassword')
    if (view.isLoaded) return

    view.isLoaded = true
    allLoaded = true

    for (var i in _views) {
      if (_views[i].isLoaded === false) allLoaded = false
    }

    _container.appendTo(document.body)
    // getView('savePassword', _container);

    // tell "background.js" that all the frames are loaded
    // if (allLoaded) tell('all-iframes-loaded');
  }

  function message_onFillForm(data) {
    if (_username !== '') {
      _username.style.borderColor = '#5707FF'
      _username.value = data.username
    }

    if (_password !== '') {
      _password.style.borderColor = '#5707FF'
      _password.value = data.password
    }
  }

  function message_onIframeLoaded(data) {
    var view = getView(data.source),
      allLoaded = true

    view.isLoaded = true

    for (var i in _views) {
      if (_views[i].isLoaded === false) allLoaded = false
    }

    // tell "background.js" that all the frames are loaded
    if (allLoaded) tell('all-iframes-loaded')
  }

  function message_onHeartClicked(data) {
    var comment = getView('comment')

    comment.iframe.show()

    // tell the "comment" iframe to show dynamic info (the page title)
    tell('open-comment', { view: 'comment', url: window.location.href, title: document.title })
  }

  function message_onSaved(data) {
    var comment = getView('comment')

    comment.iframe.hide()

    // tell "background.js" to save the liked page
    tell('save-iheart', { url: window.location.href, title: document.title, comment: data.comment })
  }

  return _this
})()
document.addEventListener(
  'DOMContentLoaded',
  function() {
    Inject.init()
  },
  false
)
 */
