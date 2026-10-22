import { AcDbDatabase } from './AcDbDatabase.js'
import { AcDbDimStyleTableRecord } from './AcDbDimStyleTableRecord.js'
import { AcDbSymbolTable } from './AcDbSymbolTable.js'

/**
 * Symbol table for dimension style table records.
 *
 * This class manages dimension style table records which represent dimension styles
 * within the drawing database. Dimension styles define the appearance and behavior
 * of dimension entities, including text formatting, arrow styles, extension lines,
 * and other dimension-specific properties.
 *
 * @example
 * ```typescript
 * const dimStyleTable = new AcDbDimStyleTable(database);
 * const dimStyle = dimStyleTable.getAt('Standard');
 * ```
 */
export class AcDbDimStyleTable extends AcDbSymbolTable<AcDbDimStyleTableRecord> {
  /**
   * Creates a new AcDbDimStyleTable instance.
   *
   * @param db - The database this dimension style table belongs to
   *
   * @example
   * ```typescript
   * const dimStyleTable = new AcDbDimStyleTable(database);
   * ```
   */
  constructor(db: AcDbDatabase) {
    super(db)
  }
}
