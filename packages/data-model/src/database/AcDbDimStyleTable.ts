import { AcDbDatabase } from './AcDbDatabase'
import { AcDbDimStyleTableRecord } from './AcDbDimStyleTableRecord'
import { AcDbSymbolTable } from './AcDbSymbolTable'

/**
 * This class is the symbol table for dimension style table records which represent dimension styles
 * within the drawing database.
 */
export class AcDbDimStyleTable extends AcDbSymbolTable<AcDbDimStyleTableRecord> {
  constructor(db: AcDbDatabase) {
    super(db)
  }
}
