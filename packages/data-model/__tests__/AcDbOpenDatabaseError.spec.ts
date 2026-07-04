import { AcDbOpenDatabaseError } from '../src/database/AcDbOpenDatabaseError'

describe('AcDbOpenDatabaseError', () => {
  it('detects worker OOM messages', () => {
    expect(
      AcDbOpenDatabaseError.isWorkerOutOfMemoryMessage(
        "Failed to execute 'postMessage' on 'DedicatedWorkerGlobalScope': Data cannot be cloned, out of memory."
      )
    ).toBe(true)
    expect(
      AcDbOpenDatabaseError.classifyWorkerErrorMessage(
        'Worker operation timed out after 30ms'
      )
    ).toBe('worker_timeout')
  })

  it('normalizes generic errors', () => {
    const error = AcDbOpenDatabaseError.from(new Error('bad dwg'), 'PARSE')
    expect(error.name).toBe('AcDbOpenDatabaseError')
    expect(error.code).toBe('worker_error')
    expect(error.stage).toBe('PARSE')
  })

  it('throws typed parse failures from worker results', () => {
    expect(() =>
      AcDbOpenDatabaseError.throwOnWorkerParseFailure({
        success: false,
        error:
          "Failed to execute 'postMessage' on 'DedicatedWorkerGlobalScope': Data cannot be cloned, out of memory.",
        errorCode: 'worker_oom',
        duration: 1
      })
    ).toThrow(/out of memory/)

    try {
      AcDbOpenDatabaseError.throwOnWorkerParseFailure({
        success: false,
        error:
          "Failed to execute 'postMessage' on 'DedicatedWorkerGlobalScope': Data cannot be cloned, out of memory.",
        errorCode: 'worker_oom',
        duration: 1
      })
    } catch (error) {
      expect((error as AcDbOpenDatabaseError).code).toBe('worker_oom')
      expect((error as AcDbOpenDatabaseError).name).toBe('AcDbOpenDatabaseError')
    }
  })
})
