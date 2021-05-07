const browser = require('webextension-polyfill')

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

function getByValue(map, url, source) {
  for (let [key, value] of map.entries()) {
    if ((value.url === url) && (value.source === source)) 
      return key;
  }
  return false;
}

function fillHashmapFromPopup(item, index) {
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
  };
}

function fillHashmapFromContent(item) {
  let key = getKey(item.url, item.username, item.source);
  if (!loginHashmap.has(key)) {
    loginHashmap.set(key, {
      id: -1,
      title: item.title,
      url: getDomainFromURL(item.url),
      username: item.username,
      password: item.password,
      source: item.source,
    });
  };
}

function getKey(url,username,source) {
  url = getDomainFromURL(url);
  return url + ":" + username + ":" + source
}

function getDomainFromURL(url) {
  const matches = url.match(/^(?:https?:)?(?:\/\/)?([^\/\?]+)/i)
  return matches ? matches[1] : 'NONE'
}

*/