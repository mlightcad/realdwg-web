import { AcDbBlockTableRecord } from './AcDbBlockTableRecord'
import { AcDbDatabase } from './AcDbDatabase'
import { AcDbSymbolTable } from './AcDbSymbolTable'

/**
 * This class is the symbol table for block table records, which represent
 * block definitions within a drawing database.
 */
export class AcDbBlockTable extends AcDbSymbolTable<AcDbBlockTableRecord> {
  constructor(db: AcDbDatabase) {
    super(db)
  }

  /**
   * Get MODEL_SPACE block table record
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
