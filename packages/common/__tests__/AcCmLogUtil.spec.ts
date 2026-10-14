import loglevel from 'loglevel'

import * as logUtil from '../src/AcCmLogUtil'

describe('AcCmLogUtil', () => {
  it('exports a named logger with warn as the default level', () => {
    expect(logUtil.DEBUG_MODE).toBe(false)
    expect(typeof logUtil.log.setLevel).toBe('function')
    expect(logUtil.log.getLevel()).toBe(loglevel.levels.WARN)
  })

  it('does not override the default loglevel logger', () => {
    const root = loglevel
    root.setLevel('error', false)
    expect(root.getLevel()).toBe(loglevel.levels.ERROR)
    expect(logUtil.log.getLevel()).toBe(loglevel.levels.WARN)
  })

  it('accepts valid and invalid log levels without throwing or persisting', () => {
    expect(() => logUtil.setLogLevel('warn')).not.toThrow()
    expect(() => logUtil.setLogLevel('bad-level')).not.toThrow()
    expect(logUtil.log.getLevel()).toBe(loglevel.levels.ERROR)
  })
})
