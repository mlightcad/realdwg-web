import { AcDbDatabase } from './AcDbDatabase'
import { AcDbLinetypeTableRecord } from './AcDbLinetypeTableRecord'
import { AcDbSymbolTable } from './AcDbSymbolTable'

/**
 * This class is the symbol table for line type table records. It represents the line types within a
 * drawing database.
 */
export class AcDbLinetypeTable extends AcDbSymbolTable<AcDbLinetypeTableRecord> {
  constructor(db: AcDbDatabase) {
    super(db)
  }
}
