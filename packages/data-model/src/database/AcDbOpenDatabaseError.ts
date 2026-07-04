import { AcCmTaskError } from '@mlightcad/common'

import type { AcDbWorkerErrorCode } from '../converter/worker/AcDbBaseWorker'
import { AcDbWorkerResult } from '../converter/worker/AcDbWorkerManager'
import { AcDbConversionStage } from './AcDbDatabaseConverter'

/**
 * Machine-readable reason for a failed {@link AcDbDatabase.read} or {@link AcDbDatabase.openUri}.
 *
 * - `worker_oom` — worker serialization or postMessage failed due to memory limits
 * - `worker_timeout` — a worker task exceeded its configured timeout
 * - `worker_error` — generic worker or postMessage failure
 * - `parse_failed` — the drawing could not be parsed into an {@link AcDbDatabase}
 * - `font_load_failed` — required font files could not be downloaded or loaded
 * - `fetch_failed` — the drawing source could not be fetched from a URI
 * - `unknown` — failure reason could not be classified
 */
export type AcDbOpenDatabaseErrorCode =
  | 'worker_oom'
  | 'worker_timeout'
  | 'worker_error'
  | 'parse_failed'
  | 'font_load_failed'
  | 'fetch_failed'
  | 'unknown'

/**
 * Structured error thrown when opening a drawing database fails.
 *
 * Callers can inspect {@link code} to distinguish worker out-of-memory failures
 * from parse errors, timeouts, and other failure modes.
 */
export class AcDbOpenDatabaseError extends Error {
  /** Machine-readable failure category for programmatic handling. */
  readonly code: AcDbOpenDatabaseErrorCode

  /**
   * Conversion stage that was active when the failure occurred, when known.
   *
   * Populated for failures raised during {@link AcDbDatabase.read} or
   * {@link AcDbDatabase.openUri} pipeline tasks.
   */
  readonly stage?: AcDbConversionStage

  /**
   * Substrings matched against worker error messages to detect out-of-memory failures.
   *
   * Used by {@link isWorkerOutOfMemoryMessage} when structured worker error codes
   * are unavailable.
   */
  private static readonly WORKER_OOM_PATTERNS = [
    'out of memory',
    'data cannot be cloned',
    'allocation failed',
    'memory access out of bounds'
  ]

  /**
   * Creates a new open-database error.
   *
   * @param message - Human-readable failure description
   * @param code - Machine-readable failure category
   * @param options - Optional conversion stage and original cause
   */
  constructor(
    message: string,
    code: AcDbOpenDatabaseErrorCode,
    options?: { stage?: AcDbConversionStage; cause?: unknown }
  ) {
    super(message)
    this.name = 'AcDbOpenDatabaseError'
    this.code = code
    this.stage = options?.stage
  }

  /**
   * Returns `true` when the message indicates a worker serialization OOM failure.
   *
   * @param message - Worker or postMessage error text to inspect
   * @returns Whether the message matches a known out-of-memory pattern
   */
  static isWorkerOutOfMemoryMessage(message: string): boolean {
    const lower = message.toLowerCase()
    return AcDbOpenDatabaseError.WORKER_OOM_PATTERNS.some(pattern =>
      lower.includes(pattern)
    )
  }

  /**
   * Classifies a worker error message into an {@link AcDbOpenDatabaseErrorCode}.
   *
   * Checks out-of-memory patterns first, then timeout wording, and falls back to
   * `worker_error` for all other messages.
   *
   * @param message - Worker or postMessage error text to classify
   * @returns The inferred open-database error code
   */
  static classifyWorkerErrorMessage(
    message: string
  ): AcDbOpenDatabaseErrorCode {
    if (AcDbOpenDatabaseError.isWorkerOutOfMemoryMessage(message)) {
      return 'worker_oom'
    }
    if (message.toLowerCase().includes('timed out')) {
      return 'worker_timeout'
    }
    return 'worker_error'
  }

  /**
   * Normalizes any thrown value into an {@link AcDbOpenDatabaseError}.
   *
   * Returns the input unchanged when it is already an instance of this class.
   * Otherwise extracts a message, classifies it, and wraps it in a new error.
   *
   * @param error - Thrown value from an open or conversion operation
   * @param stage - Conversion stage active when the failure occurred
   * @returns A typed open-database error
   */
  static from(
    error: unknown,
    stage?: AcDbConversionStage
  ): AcDbOpenDatabaseError {
    if (error instanceof AcDbOpenDatabaseError) {
      return error
    }

    const message = error instanceof Error ? error.message : String(error)
    const code = AcDbOpenDatabaseError.classifyWorkerErrorMessage(message)
    return new AcDbOpenDatabaseError(message, code, { stage, cause: error })
  }

  /**
   * Normalizes a task scheduler failure into an {@link AcDbOpenDatabaseError}.
   *
   * Uses the failed task name as the conversion {@link stage}.
   *
   * @param taskError - Error emitted by {@link AcCmTaskScheduler} for a failed task
   * @returns A typed open-database error with stage populated from the task name
   */
  static fromTask(taskError: AcCmTaskError): AcDbOpenDatabaseError {
    const stage = taskError.task.name as AcDbConversionStage
    return AcDbOpenDatabaseError.from(taskError.error, stage)
  }

  /**
   * Throws an {@link AcDbOpenDatabaseError} when a worker parse result failed.
   *
   * Acts as a type guard: when this method returns normally, `result.success`
   * is known to be `true` and {@link AcDbWorkerResult.data} is defined.
   *
   * @param result - Worker task result to validate
   * @param stage - Conversion stage to attach to the thrown error
   * @throws {@link AcDbOpenDatabaseError} when `result.success` is `false`
   */
  static throwOnWorkerParseFailure<T>(
    result: AcDbWorkerResult<T>,
    stage: AcDbConversionStage = 'PARSE'
  ): asserts result is AcDbWorkerResult<T> & { success: true; data: T } {
    if (result.success) {
      return
    }

    const message =
      result.error != null
        ? `Failed to parse drawing due to error: '${result.error}'`
        : 'Failed to parse drawing due to an unknown worker error'

    const code = AcDbOpenDatabaseError.mapWorkerResultCode(
      result.errorCode,
      result.error
    )
    throw new AcDbOpenDatabaseError(message, code, { stage })
  }

  /**
   * Maps a structured worker error code to an {@link AcDbOpenDatabaseErrorCode}.
   *
   * When the worker code is missing or unrecognized, falls back to
   * {@link classifyWorkerErrorMessage} on the optional message text.
   *
   * @param errorCode - Structured error category from the worker response
   * @param message - Worker error text used for heuristic classification
   * @returns The corresponding open-database error code
   */
  private static mapWorkerResultCode(
    errorCode?: AcDbWorkerErrorCode,
    message?: string
  ): AcDbOpenDatabaseErrorCode {
    switch (errorCode) {
      case 'worker_oom':
        return 'worker_oom'
      case 'worker_timeout':
        return 'worker_timeout'
      case 'worker_error':
        return 'worker_error'
      default:
        return AcDbOpenDatabaseError.classifyWorkerErrorMessage(message ?? '')
    }
  }
}
