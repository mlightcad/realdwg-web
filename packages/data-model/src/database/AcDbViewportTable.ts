import { AcDbDatabase } from './AcDbDatabase'
import { AcDbSymbolTable } from './AcDbSymbolTable'
import { AcDbViewportTableRecord } from './AcDbViewportTableRecord'

/**
 * This class is the symbol table for viewport table records which represents viewport configurations
 * within AutoCAD.
 */
export class AcDbViewportTable extends AcDbSymbolTable<AcDbViewportTableRecord> {
  constructor(db: AcDbDatabase) {
    super(db)
  }
}
