import browser from 'webextension-polyfill'
import { EVENT_TYPES } from '@/utils/constants'
import LoginsService from '@/api/services/Logins'
import Storage from '@/utils/storage'
import HTTPClient from '@/api/HTTPClient'
import CryptoUtils from '@/utils/crypto'
import { RequestError } from '@/utils/helpers'

const EncryptedFields = ['username', 'password', 'extra']

class Agent {
  isAuthenticated = false
  constructor() {
    console.log('Background initalize')
    this.init()
  }

  async init() {
    await this.fetchTokens()
    browser.runtime.onMessage.addListener(this.handleMessage.bind(this)) // for content-scirpt/popup events events

    browser.tabs.onUpdated.addListener((tabId, changeInfo, tabInfo) => {
      browser.tabs.sendMessage(tabId, { type: EVENT_TYPES.TAB_UPDATE, payload: {} })
    })
  }

  async fetchTokens() {
    const token = await Storage.getItem('access_token')
    if (!token) {
      console.warn('Login first!!')
      this.isAuthenticated = false
      return
    }
    HTTPClient.setHeader('Authorization', `Bearer ${token}`)

    CryptoUtils.encryptKey = await Storage.getItem('master_hash')
    CryptoUtils.transmissionKey = await Storage.getItem('transmission_key')
    this.isAuthenticated = true
  }

  /**
   *
   * @param {import('@/content-scripts/content-script').RuntimeRequest} request
   */
  async handleMessage(request, sender, sendResponse) {
    if (request.who === 'popup') {
      // popup
      switch (request.type) {
        case 'REFRESH_TOKENS':
          this.fetchTokens()

        case 'LOGIN_AS_POPUP_RESIZE':
        case 'LOGIN_AS_POPUP_CLOSE':
          // direct connection between popup and content-scirpt
          this.sendResponseToContentScirpt(request)
      }
    }
    if (request.who === 'content-script') {
      // content-script
      switch (request.type) {
        case 'REQUEST_LOGINS':
          try {
            const logins = await this.requestLogins(request.payload)
            return Promise.resolve(logins)
          } catch (error) {
            console.error(error)
            return Promise.reject(error)
          }
      }
    }
  }

  /**
   *
   * @param {string} domain
   * @returns {Promise<Array>}
   */
  async requestLogins(domain) {
    if (!this.isAuthenticated) throw new RequestError('No token found!', 'NO_AUTH')
    const { data } = await LoginsService.FetchAll()
    const itemList = JSON.parse(CryptoUtils.aesDecrypt(data.data))
    itemList.forEach(element => {
      CryptoUtils.decryptFields(element, EncryptedFields)
    })

    const filteredItems = itemList.filter(item =>
      Object.values(item).some(value =>
        (value || '')
          .toString()
          .toLowerCase()
          .includes(domain.toLowerCase())
      )
    )
    if (filteredItems.length === 0) throw new RequestError('No logins found', 'NO_LOGINS')
    return filteredItems
  }

  async sendResponseToContentScirpt(data = {}) {
    // find the current tab and send a message to "content-script.js" and all the iframes
    browser.tabs.query({ active: true, lastFocusedWindow: true }).then(tabs => {
      if (!tabs[0]) return
      browser.tabs.sendMessage(tabs[0].id, data)
    })
  }
}

window.addEventListener('load', () => {
  new Agent()
})

/* var Background = (function (){
	// variables ----------------------------------------------------------------
	var _this 		= {},
		_websites	= [];
  
    // Login Hashmap
  var loginHashmap = new Map()
			
	// initialize ---------------------------------------------------------------
	_this.init = function (){
    console.log("Passwall background script initialized successfully.");

		// list of website liked
		_websites = [];
		
		// receive post messages from "content-script.js" and any iframes
		browser.runtime.onMessage.addListener(onPostMessage);
		
		// manage when a user change tabs
		// browser.tabs.onActivated.addListener(onTabActivated);		

    browser.tabs.onUpdated.addListener(onTabUpdated);
    
	};

  // events -------------------------------------------------------------------
	function onPostMessage (request, sender, sendResponse){
		if (!request.message) return;
    
		// if it has a "view", it resends the message to all the frames in the current tab
		// if (request.data.view){
		// 	_this.tell(request.message, request.data);
		// 	return;
		// }
		
		processMessage(request);
	};

	function onTabActivated (){
		upateCurrentTab();
	};

  function onTabUpdated() {
		updateTab();
	};
	
	// private functions --------------------------------------------------------
	function processMessage (request){
    console.log('background scripte gelen: ',request.message);
		switch (request.message){
      case 'fill-hashmap-from-popup': fillHashmapFromPopup(request.data); break;
      case 'fill-hashmap-from-content': fillHashmapFromContent(request.data); break;
			case 'save-iheart': message_onSaved(request.data); break;
			case 'all-iframes-loaded': message_allIframesLoaded(request.data); break;
		};
    console.log(loginHashmap);
	};

  function updateTab(url){
    browser.tabs.query({lastFocusedWindow: true, active: true}).then(tabs => {
      if (!tabs[0]) return;

      let url = getDomainFromURL(tabs[0].url);
      let contentKey = getByValue(loginHashmap, url, 'content');
      
      if (contentKey === false) return;

      let popupKey = contentKey.replace(":content", ":popup");
      
      if (!loginHashmap.has(popupKey) && loginHashmap.has(contentKey)) {
          _this.tell('create-login', loginHashmap.get(contentKey));
      }

      if (loginHashmap.has(popupKey) && loginHashmap.has(contentKey)) {
        let popupItem = loginHashmap.get(popupKey);
        let contentItem = loginHashmap.get(contentKey);
        if (popupItem.password !== contentItem.password) {
          popupItem.password = contentItem.password
          _this.tell('update-login', popupItem);
        };
      };
    });    
  };
  
  function upateCurrentTab (){
    // highlight the "heart" if the web page is already liked
    let activeTab = browser.tabs.query({lastFocusedWindow: true, active: true});
    activeTab.then(function (tabs) {
    
      var website = null;	
			for (var i in _websites){
				if (_websites[i].url == tabs[0].url) website = _websites[i];
			}
			
			if (website){
				// send a message to all the views (with "*" wildcard)
				_this.tell('website-is-hearted', {view:'*', comment:website.comment});
			}
      
    }, null);
    
	};	

	// actions -------------------------------------------------------------------
  function fillHashmapFromPopup(data) {
    data.forEach((item,index)=>{
      let key = getKey(item.url, item.username, 'popup');
      if (!loginHashmap.has(key)) {
        loginHashmap.set(key, {
          id: item.id,
          title: item.title,
          url: getDomainFromURL(item.url),
          username: item.username,
          password: item.password,
          source: 'popup',
        });
      }; // end if
    }); // end foreach
  };

  function fillHashmapFromContent(data) {
    let key = getKey(data.url, data.username, 'content');
    if (!loginHashmap.has(key)) {
      loginHashmap.set(key, {
        id: -1,
        title: data.title,
        url: getDomainFromURL(data.url),
        username: data.username,
        password: data.password,
        source: 'content',
      });
    }; // end if
  };

	function message_onSaved (data){
		_websites.push({
			url			: data.url,
			title		: data.title,
			comment		: data.comment
		});
	};
	
	function message_allIframesLoaded (data){
		upateCurrentTab();
	};
	
  // util functions ---------------------------------------------------------
  function getKey(url,username,source) {
    url = getDomainFromURL(url);
    return url + ":" + username + ":" + source
  };
  
  function getDomainFromURL(url) {
    const matches = url.match(/^(?:https?:)?(?:\/\/)?([^\/\?]+)/i)
    return matches ? matches[1] : 'NONE'
  };

  function getByValue(map, url, source) {
    for (let [key, value] of map.entries()) {
      if ((value.url === url) && (value.source === source)) 
        return key;
    }
    return false;
  };
	
	// public functions ---------------------------------------------------------
	_this.getWebsites = function (){
		return _websites;
	};
	
	_this.tell = function (message, data){
		var data = data || {};

    // find the current tab and send a message to "content-script.js" and all the iframes
    browser.tabs.query({active: true, lastFocusedWindow: true}).then(tabs => {
      if (!tabs[0]) return;
      browser.tabs.sendMessage(tabs[0].id, {
				message	: message,
				data	: data
			});
    });

	};
	
	return _this;
}());

window.addEventListener("load", function() { Background.init(); }, false); */

/*

// Login Hashmap
let loginHashmap = new Map()

// Message Listener
browser.runtime.onMessage.addListener(handleMessage);

// Tabs url on updated listener fired when a tab URL is changed
browser.tabs.onUpdated.addListener(handleTabURLUpdated);

// Message handler
function handleMessage(request, sender, sendResponse) {
  // Fill hashmap from popup
  if (request.source === 'popup') {
    request.loginList.forEach(fillHashmapFromPopup);
  }

  // Fill hashmap from content script
  if (request.source === 'content' && request.action === 'fill') {
    let item = {
      id: -1,
      title: sender.tab.title,
      url: getDomainFromURL(sender.tab.url),
      username: request.username,
      password: request.password,
      source: request.source
    };

    let contentKey = getKey(item.url, request.username, 'content');
    if (!loginHashmap.has(contentKey)) {
      fillHashmapFromContent(item);
    }    

    // TODO : parola farklıysa ne yapılacak?
    // if (!loginHashmap.has(key)) {
    //   let found = loginHashmap.get(key)
    //   if (found.password !== item.password) {
    //     // TODO : send message to content ask for update
    //     console.log("passwords are different");
    //   }
    // } else {
    //   fillHashmapFromContent(item);
    // }
  }

  console.log(loginHashmap);
}

function handleTabURLUpdated(tabId, changeInfo, tabInfo) {
  if (tabInfo.active) {
    let url = getDomainFromURL(tabInfo.url);
    let contentKey = getByValue(loginHashmap, url, 'content');
    
    if (contentKey !== false) {
      let popupKey = contentKey.replace(":content", ":popup");
      
      if (!loginHashmap.has(popupKey) && loginHashmap.has(contentKey)) {
          // alert("Do you want to save this login information?");
      }

      if (loginHashmap.has(popupKey) && loginHashmap.has(contentKey)) {
        let popupItem = loginHashmap.get(popupKey);
        let contentItem = loginHashmap.get(contentKey);
        if (popupItem.password !== contentItem.password) {
          // alert("Do you want to update login information for this website?");
        }
      }

    }
    

    // console.log(getByValue(loginHashmap, url, source))
    // console.log(`handleUpdates : ${tabInfo.url}`);
  }
  // console.log(tabId);
  // console.log(changeInfo);
  // console.log(tabInfo);
  // let url = getDomainFromURL(tabInfo.url);
  

  // Bu üçü de sistemde yoksa yeni login aç
  // url     : sender.tab.url,
  // username: request.username,
  // password: request.password,

  // Bu üçü de sistemde var ve aynıysa hiç popup çıkarma

  // url ve username ayni ve parola farkliysa update olmali



 

  // if (loginHashmap.has(tabInfo.url)) {
  //   console.log(loginHashmap.get(tabInfo.url))
  // }
}

*/
