const browser = require("webextension-polyfill");

browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("Hello from the background");
  console.log(browser);
});
