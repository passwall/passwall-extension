// Vitest setup file
import { vi } from 'vitest'

// Mock browser/chrome APIs for webextension
global.browser = {
  runtime: {
    getURL: (path) => `chrome-extension://mock-id/${path}`,
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn()
    },
    getPlatformInfo: vi.fn((callback) => callback({ os: 'mac' }))
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn(),
    create: vi.fn(),
    onUpdated: {
      addListener: vi.fn()
    }
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined)
    }
  }
}

global.chrome = global.browser

