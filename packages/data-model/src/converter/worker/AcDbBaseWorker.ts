/**
 * Base class for worker scripts that handles all message passing
 * Users only need to implement the executeTask method
 */

/// <reference lib="webworker" />

/** Message sent from the main thread to a worker task. */
export interface AcDbWorkerMessage<TInput = unknown> {
  /** Unique task identifier used to correlate the response. */
  id: string
  /** Task input payload. */
  input: TInput
}

/**
 * Machine-readable error category for worker failures.
 *
 * - `worker_oom` — postMessage failed due to memory or clone limits
 * - `worker_timeout` — task exceeded the configured timeout (main thread)
 * - `worker_error` — generic worker or postMessage failure
 */
export type AcDbWorkerErrorCode =
  | 'worker_oom'
  | 'worker_timeout'
  | 'worker_error'

/** Response posted back to the main thread after a worker task completes. */
export interface AcDbWorkerResponse<TOutput = unknown> {
  /** Task identifier matching the originating {@link AcDbWorkerMessage.id}. */
  id: string
  /** Whether the task completed without throwing. */
  success: boolean
  /** Task result when {@link success} is true. */
  data?: TOutput
  /** Human-readable error message when {@link success} is false. */
  error?: string
  /** Structured error category when {@link success} is false. */
  errorCode?: AcDbWorkerErrorCode
}

/**
 * Base class for worker scripts
 * Handles all message passing - users only need to implement executeTask
 */
export abstract class AcDbBaseWorker<TInput = unknown, TOutput = unknown> {
  constructor() {
    this.setupMessageHandler()
  }

  /**
   * Set up message handler - called automatically
   */
  private setupMessageHandler(): void {
    self.onmessage = async (event: MessageEvent<AcDbWorkerMessage<TInput>>) => {
      const { id, input } = event.data

      try {
        const result = await this.executeTask(input)
        this.sendResponse(id, true, result)
      } catch (error) {
        this.sendResponse(
          id,
          false,
          undefined,
          error instanceof Error ? error.message : String(error)
        )
      }
    }
  }

  /**
   * Send response back to main thread
   */
  private sendResponse(
    id: string,
    success: boolean,
    data?: TOutput,
    error?: string,
    errorCode?: AcDbWorkerErrorCode
  ): void {
    const response: AcDbWorkerResponse<TOutput> = {
      id,
      success,
      data,
      error,
      errorCode
    }

    try {
      self.postMessage(response)
    } catch (postError) {
      const message =
        postError instanceof Error ? postError.message : String(postError)
      self.postMessage({
        id,
        success: false,
        error: message,
        errorCode: this.classifyPostMessageError(message)
      })
    }
  }

  /**
   * Map a postMessage failure message to a structured error code.
   */
  private classifyPostMessageError(message: string): AcDbWorkerErrorCode {
    const lower = message.toLowerCase()
    if (
      lower.includes('out of memory') ||
      lower.includes('data cannot be cloned')
    ) {
      return 'worker_oom'
    }
    return 'worker_error'
  }

  /**
   * Execute the actual task - users must implement this
   * @param input - Input data for the task
   * @returns Promise or direct result
   */
  protected abstract executeTask(input: TInput): Promise<TOutput> | TOutput
}
