import browser from 'webextension-polyfill'

// Use chrome.storage.local instead of IndexedDB for better reliability in extensions
// IndexedDB can be cleared unexpectedly in service worker contexts
const storage = {
  async getItem(key) {
    const result = await browser.storage.local.get(key)
    return result[key] !== undefined ? result[key] : null
  },
  
  async setItem(key, value) {
    await browser.storage.local.set({ [key]: value })
    return value
  },
  
  async removeItem(key) {
    await browser.storage.local.remove(key)
  },
  
  async clear() {
    await browser.storage.local.clear()
  },
  
  async keys() {
    const allData = await browser.storage.local.get(null)
    return Object.keys(allData)
  }
}

export default storage
