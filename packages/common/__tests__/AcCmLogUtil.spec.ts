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

    // Invalid levels fall back to 'error' and call log.error. Spy console
    // rather than log.error: setLevel rebuilds logger methods and would
    // discard a spy on the logger itself.
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    expect(() => logUtil.setLogLevel('bad-level')).not.toThrow()
    expect(consoleError).toHaveBeenCalled()
    expect(logUtil.log.getLevel()).toBe(loglevel.levels.ERROR)
    consoleError.mockRestore()
  })
})
