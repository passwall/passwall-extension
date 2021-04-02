const browser = require('webextension-polyfill')

// Login Hashmap
let loginHashmap = new Map()

// Listener
browser.runtime.onMessage.addListener(handleMessage);

// Handler
function handleMessage(request, sender, sendResponse) {
  let status = "No new record"

  // Create new record  
  if ((typeof request.username !== 'undefined') && (typeof request.password !== 'undefined')) {

    let url = domainFromUrl(sender.tab.url);
    let key = url + ":" + request.username;

    if (!loginHashmap.has(key)) {
      loginHashmap.set(key, {
        title: sender.tab.title,
        url: url,
        username: request.username,
        password: request.password,
      });
      status = "New record added";
    }
  }

  sendResponse({
    response: status,
  });
}

//onUpdated listener fired when a tab URL is changed
browser.tabs.onUpdated.addListener(handleUpdated);

function handleUpdated(tabId, changeInfo, tabInfo) {
  
  let url = domainFromUrl(tabInfo.url);
  console.log(url);

  // Bu üçü de sistemde yoksa yeni login aç
  // url     : sender.tab.url,
  // username: request.username,
  // password: request.password,

  // Bu üçü de sistemde var ve aynıysa hiç popup çıkarma

  // url ve username ayni ve parola farkliysa update olmali



  if (tabInfo.active) {
    // console.log(`handleUpdates : ${tabInfo.url}`);
  }

  // if (loginHashmap.has(tabInfo.url)) {
  //   console.log(loginHashmap.get(tabInfo.url))
  // }
}

function domainFromUrl(url) {
  const matches = url.match(/^(?:https?:)?(?:\/\/)?([^\/\?]+)/i)
  return matches ? matches[1] : 'NONE'
}

