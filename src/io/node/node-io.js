// @flow

import { makeNodeFolder } from 'disklet'

import type { EdgeRawIo } from '../../edge-core-index.js'

// Dynamically import platform-specific stuff:
let crypto
let fetch
try {
  crypto = require('crypto')
  fetch = require('node-fetch')
} catch (e) {}

/**
 * Returns true if the runtime environment appears to be node.js.
 */
export const isNode = crypto && fetch

/**
 * Creates the io resources needed to run the Edge core on node.js.
 *
 * @param {string} path Location where data should be written to disk.
 */
export function makeNodeIo (path: string): EdgeRawIo {
  if (!isNode) {
    throw new Error('This function only works on node.js')
  }

  return {
    console,
    fetch,
    folder: makeNodeFolder(path),
    random (bytes: number) {
      return crypto.randomBytes(bytes)
    }
  }
}
