// Callback function to execute business logic of chunk processing.
type AcDbChunkProcessingCallback = (start: number, end: number) => Promise<void>

/**
 * This class is used to break up the work into smaller chunks that are executed asynchronously.
 * This is often referred to "batch processing" or "cooperative multitasking," where the
 * time-consuming task is broken into smaller pieces and executed in small intervals to allow
 * the UI to remain responsive.
 */
export class AcDbBatchProcessing {
  private _count: number
  private _numerOfChunk: number
  private _chunkSize: number = -1
  private _minimumChunkSize: number = 50

  /**
   * Construct one instance of this class
   * @param count Input the total number of items to process
   * @param numerOfChunk Input the number of chunks to process
   * @param minimumChunkSize Input the minimum number of items in one chunk. If it is greater
   * than the total number of items to process, the total number is used.
   */
  constructor(count: number, numerOfChunk: number, minimumChunkSize: number) {
    this._count = count
    this._numerOfChunk = numerOfChunk < 1 ? 1 : numerOfChunk
    this._minimumChunkSize = minimumChunkSize
    this.calculateChunkSize()
  }

  /**
   * The total number of items to process
   */
  get count() {
    return this._count
  }

  /**
   * The number of chunks to process
   */
  get numerOfChunk() {
    return this._numerOfChunk
  }

  /**
   * The minimum number of items in one chunk.
   */
  get minimumChunkSize() {
    return this._minimumChunkSize
  }
  set minimumChunkSize(value: number) {
    this._minimumChunkSize = value
    this.calculateChunkSize()
  }

  /**
   * The number of items in one chunk
   */
  get chunkSize() {
    return this._chunkSize
  }

  private calculateChunkSize() {
    let demicalChunkSize = this._count / this._numerOfChunk
    if (demicalChunkSize < this._minimumChunkSize) {
      demicalChunkSize = Math.min(this._minimumChunkSize, this._count)
    }
    this._chunkSize =
      demicalChunkSize < 1 ? this._count : Math.floor(demicalChunkSize)
  }

  private scheduleTask(callback: () => void) {
    if (
      typeof window !== 'undefined' &&
      typeof window.requestAnimationFrame === 'function'
    ) {
      // Browser environment with requestAnimationFrame
      window.requestAnimationFrame(callback)
    } else {
      // Node.js or fallback to setTimeout
      setTimeout(callback, 0)
    }
  }

  // Use the ChunkProcessingCallback type for the callback parameter
  public async processChunk(callback: AcDbChunkProcessingCallback) {
    let currentIndex = 0

    const processNextChunk = async () => {
      const start = currentIndex
      const end = Math.min(currentIndex + this._chunkSize, this._count)

      // Call the provided callback with the chunk's range
      await callback(start, end)

      currentIndex = end

      // If there are more items to process, schedule the next chunk
      if (currentIndex < this._count) {
        this.scheduleTask(processNextChunk) // Schedule the next chunk to be processed asynchronously
      }
    }

    // Start processing the first chunk
    await processNextChunk()
  }
}
