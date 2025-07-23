import * as loglevel from 'loglevel'

export const DEBUG_MODE = true
export const log = loglevel

if (DEBUG_MODE) {
  log.setLevel('debug')
} else {
  log.setLevel('warn')
}

/**
 * Sets log level.
 * Note that, we limit user to set only some of the levels.
 */
export const setLogLevel = (level: string) => {
  try {
    log.setLevel(level as loglevel.LogLevelDesc)
  } catch (ex) {
    log.setLevel('error')
    log.error(ex)
  }
}
