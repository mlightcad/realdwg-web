import { AcDbBlockTableRecord } from './AcDbBlockTableRecord'
import { AcDbDatabase } from './AcDbDatabase'
import { AcDbSymbolTable } from './AcDbSymbolTable'

/**
 * Symbol table for block table records.
 * 
 * This class manages block table records which represent block definitions
 * within a drawing database. Blocks are reusable collections of entities
 * that can be inserted multiple times into a drawing.
 * 
 * @example
 * ```typescript
 * const blockTable = new AcDbBlockTable(database);
 * const modelSpace = blockTable.modelSpace;
 * const block = blockTable.getAt('MyBlock');
 * ```
 */
export class AcDbBlockTable extends AcDbSymbolTable<AcDbBlockTableRecord> {
  /**
   * Creates a new AcDbBlockTable instance.
   * 
   * @param db - The database this block table belongs to
   * 
   * @example
   * ```typescript
   * const blockTable = new AcDbBlockTable(database);
   * ```
   */
  constructor(db: AcDbDatabase) {
    super(db)
  }

  /**
   * Adds a block table record and indexes it by a regularized name key.
   *
   * - For model space: indexed under `*MODEL_SPACE`.
   * - For paper space: indexed under `*PAPER_SPACE` plus the original name suffix after the prefix.
   * - For other blocks: indexed under the record's `name` as-is.
   *
   * Note: Only the internal index key is regularized; the record's `name` is not mutated.
   *
   * @param record - The record to add to the table
   * 
   */
  add(record: AcDbBlockTableRecord) {
    record.database = this.database
    let regularizedName = record.name
    if (record.isModelSapce) {
      regularizedName = AcDbBlockTableRecord.MODEL_SPACE_NAME
    } else if (record.isPaperSapce) {
      const prefix = AcDbBlockTableRecord.PAPER_SPACE_NAME_PREFIX
      const suffix = record.name.substring(prefix.length)
      regularizedName = prefix + suffix
    }
    this._recordsByName.set(regularizedName, record)
    this._recordsById.set(record.objectId, record)
  }

  /**
   * Gets the MODEL_SPACE block table record.
   * 
   * This method returns the model space block table record, creating it
   * if it doesn't exist. Model space is the primary drawing area where
   * most entities are created and stored.
   * 
   * @returns The MODEL_SPACE block table record
   * 
   * @example
   * ```typescript
   * const modelSpace = blockTable.modelSpace;
   * const entities = modelSpace.entities;
   * ```
   */
  get modelSpace(): AcDbBlockTableRecord {
    let modelSpace = this.getAt(AcDbBlockTableRecord.MODEL_SPACE_NAME)
    if (!modelSpace) {
      modelSpace = new AcDbBlockTableRecord()
      modelSpace.name = AcDbBlockTableRecord.MODEL_SPACE_NAME
      this.add(modelSpace)
    }
    return modelSpace
  }
}
