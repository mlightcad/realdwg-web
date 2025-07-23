/**
 * Represents a named unit of work with an asynchronous or synchronous execution function.
 * @template TIn Input type
 * @template TOut Output type
 */
export class AcCmTask<TIn, TOut> {
  /**
   * Name of the task (for logging/debugging purposes)
   */
  readonly name: string

  constructor(name: string) {
    this.name = name
  }

  /**
   * Executes the task.
   */
  run(_input: TIn): TOut | Promise<TOut> {
    throw new Error('run() must be implemented by subclass')
  }
}

/**
 * Reports progress after a task completes.
 * @param progress A number between 0 and 1 indicating task completion
 * @param task The task that was just completed
 */
type AcCmProgressCallback = (
  progress: number,
  task: AcCmTask<unknown, unknown>
) => void

/**
 * Callback function to handle final output.
 */
export type AcCmCompleteCallback<T> = (finalResult: T) => void

/**
 * Handles errors during task execution.
 * @param error The error thrown
 * @param taskIndex Index of the failed task
 * @param task The task that failed
 */
type AcCmErrorCallback = (
  error: unknown,
  taskIndex: number,
  task: AcCmTask<unknown, unknown>
) => void

/**
 * Type-safe task scheduler that executes a chain of named tasks in order,
 * passing results between them and stopping on the first failure.
 *
 * @template TInitial Initial input type
 * @template TFinal Final output type
 */
export class AcCmTaskScheduler<TInitial, TFinal = TInitial> {
  private tasks: AcCmTask<unknown, unknown>[] = []
  private onProgress: AcCmProgressCallback = () => {}
  private onComplete: AcCmCompleteCallback<TFinal> = () => {}
  private onError: AcCmErrorCallback = () => {}

  /**
   * Adds a task to the execution queue.
   *
   * @param task Task instance with name and run function
   */
  addTask<TIn, TOut>(task: AcCmTask<TIn, TOut>): void {
    this.tasks.push(task as AcCmTask<unknown, unknown>)
  }

  /**
   * Sets a callback to receive progress updates.
   */
  setProgressCallback(callback: AcCmProgressCallback): void {
    this.onProgress = callback
  }

  /**
   * Sets a callback to be called after successful completion of all tasks.
   */
  setCompleteCallback(callback: AcCmCompleteCallback<TFinal>): void {
    this.onComplete = callback
  }

  /**
   * Sets a callback to be called if any task throws an error.
   */
  setErrorCallback(callback: AcCmErrorCallback): void {
    this.onError = callback
  }

  /**
   * Starts execution of the task queue with the given initial input.
   */
  async run(initialData: TInitial): Promise<void> {
    const total = this.tasks.length
    let result: unknown = initialData

    for (let i = 0; i < total; i++) {
      const task = this.tasks[i]

      try {
        result = await new Promise((resolve, reject) => {
          setTimeout(async () => {
            try {
              const output = await task.run(result)
              this.onProgress((i + 1) / total, task)
              resolve(output)
            } catch (err) {
              reject(err)
            }
          }, 0)
        })
      } catch (error) {
        this.onError(error, i, task)
        return
      }
    }

    this.onComplete(result as TFinal)
  }
}
