/**
 * @fileoverview Logging utilities for the AutoCAD Common library.
 *
 * This module provides a centralized logging interface using the loglevel library,
 * with configurable log levels for development and production environments.
 *
 * @module AcCmLogUtil
 * @version 1.0.0
 */

import loglevel from 'loglevel'

/**
 * Flag indicating whether debug mode is enabled.
 * When true, sets the default log level to 'debug'; otherwise 'warn'.
 *
 * Kept for API compatibility. Prefer {@link setLogLevel} or building with a
 * debug flag rather than relying on this constant at runtime.
 *
 * @constant {boolean}
 */
export const DEBUG_MODE = false

/**
 * Named logger for mlightcad packages. Using a dedicated logger avoids
 * overriding the app's default `loglevel` instance and does not persist
 * levels into `localStorage` unless explicitly requested.
 *
 * @constant {loglevel.Logger}
 *
 * @example
 * ```typescript
 * import { log } from './AcCmLogUtil.js'
 *
 * log.debug('Debug message')
 * log.info('Info message')
 * log.warn('Warning message')
 * log.error('Error message')
 * ```
 */
export const log = loglevel.getLogger('mlightcad')

// setDefaultLevel does not persist and does not override a level the caller
// already chose on this named logger.
log.setDefaultLevel(DEBUG_MODE ? 'debug' : 'warn')

/**
 * Sets the log level for the mlightcad logging system.
 *
 * Valid log levels are: 'trace', 'debug', 'info', 'warn', 'error', 'silent'.
 * If an invalid level is provided, the level will default to 'error' and an error will be logged.
 * Levels are not written to `localStorage`.
 *
 * @param {string} level - The log level to set.
 *
 * @example
 * ```typescript
 * import { setLogLevel } from './AcCmLogUtil.js'
 *
 * // Set to debug level for development
 * setLogLevel('debug')
 *
 * // Set to error level for production
 * setLogLevel('error')
 *
 * // Silent all logging
 * setLogLevel('silent')
 * ```
 */
export const setLogLevel = (level: string) => {
  try {
    log.setLevel(level as loglevel.LogLevelDesc, false)
  } catch (ex) {
    log.setLevel('error', false)
    log.error(ex)
  }
}
