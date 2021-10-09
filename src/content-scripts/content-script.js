const browser = require('webextension-polyfill')

var Inject = (function() {
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
    ;[_username, _password] = detectFormFields()
    if (_username && _password) {
      _password.addEventListener('blur', passwordListener)
    }

    // create the main container
    _container = $('<div />', { id: ID.CONTAINER })
    // _container.appendTo(document.body);

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
    var inputs = document.querySelectorAll('input'),
      i
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
    iframe = $('<iframe />', { id: ID.IFRAME_PREFIX + id, src: src, scrolling: 'no' })

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
