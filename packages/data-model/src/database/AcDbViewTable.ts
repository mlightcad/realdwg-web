import { AcDbDatabase } from './AcDbDatabase.js'
import { AcDbSymbolTable } from './AcDbSymbolTable.js'
import { AcDbViewTableRecord } from './AcDbViewTableRecord.js'

/**
 * Symbol table for view table records.
 *
 * This class manages view table records which represent named views
 * within AutoCAD. Views define a saved camera configuration including
 * view direction, target, and display settings.
 *
 * @example
 * ```typescript
 * const viewTable = new AcDbViewTable(database);
 * const view = viewTable.getAt('Front');
 * ```
 */
export class AcDbViewTable extends AcDbSymbolTable<AcDbViewTableRecord> {
  /**
   * Creates a new AcDbViewTable instance.
   *
   * @param db - The database this view table belongs to
   *
   * @example
   * ```typescript
   * const viewTable = new AcDbViewTable(database);
   * ```
   */
  constructor(db: AcDbDatabase) {
    super(db)
  }
}
