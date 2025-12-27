/**
 * Polyfills for browser extension environment
 * This file MUST be imported before any other modules
 */

import { Buffer as BufferPolyfill } from 'buffer'

// Make Buffer available globally as both Buffer and buffer (for compatibility)
if (typeof window !== 'undefined') {
  window.Buffer = BufferPolyfill
  window.buffer = { Buffer: BufferPolyfill } // For libraries expecting 'buffer.Buffer'
  window.global = window
}

export { BufferPolyfill as Buffer }
