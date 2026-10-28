import { AcDbUndoRecord } from './AcDbUndoRecord.js'

/**
 * Manages undo and redo history for database changes.
 *
 * Stores committed {@link AcDbUndoRecord} entries. {@link push} is the
 * user-initiated entry point and clears the redo stack, while
 * {@link pushUndo} only restores an undone record during a redo so the
 * remaining redo records survive.
 */
export class AcDbUndoStack {
  private readonly undoRecords: AcDbUndoRecord[] = []
  private readonly redoRecords: AcDbUndoRecord[] = []

  /** Maximum number of undo records retained. */
  maxDepth = 100

  /**
   * Pushes a new undo record and clears redo history.
   *
   * Use this when the user performs a new operation: any previously undone
   * step can no longer be redone, so the redo stack is discarded.
   *
   * When {@link maxDepth} is exceeded, the oldest undo record is discarded.
   *
   * @param record - Undo record produced by {@link AcDbDatabaseTransactionManager}
   */
  push(record: AcDbUndoRecord): void {
    this.undoRecords.push(record)
    this.redoRecords.length = 0
    this.trimUndoRecords()
  }

  /**
   * Pushes a record back onto the undo stack without clearing redo history.
   *
   * Used when replaying a redo. Calling {@link push} in that situation would
   * discard the remaining redo records, which made it impossible to redo more
   * than one step in a row.
   *
   * @param record - Record that was just redone
   */
  pushUndo(record: AcDbUndoRecord): void {
    this.undoRecords.push(record)
    this.trimUndoRecords()
  }

  /**
   * Discards the oldest undo records when {@link maxDepth} is exceeded.
   */
  private trimUndoRecords(): void {
    if (this.undoRecords.length > this.maxDepth) {
      this.undoRecords.shift()
    }
  }

  /**
   * Removes and returns the most recent undo record.
   *
   * @returns The record popped from the undo stack, or undefined when empty
   */
  popUndo(): AcDbUndoRecord | undefined {
    return this.undoRecords.pop()
  }

  /**
   * Stores an undo record on the redo stack after {@link popUndo}.
   *
   * @param record - Record that was just undone and may be redone
   */
  pushRedo(record: AcDbUndoRecord): void {
    this.redoRecords.push(record)
  }

  /**
   * Removes and returns the most recent redo record.
   *
   * @returns The record popped from the redo stack, or undefined when empty
   */
  popRedo(): AcDbUndoRecord | undefined {
    return this.redoRecords.pop()
  }

  /**
   * Returns true when at least one undo record is available.
   */
  canUndo(): boolean {
    return this.undoRecords.length > 0
  }

  /**
   * Returns true when at least one redo record is available.
   */
  canRedo(): boolean {
    return this.redoRecords.length > 0
  }

  /**
   * Discards all undo and redo records.
   */
  clear(): void {
    this.undoRecords.length = 0
    this.redoRecords.length = 0
  }
}
