import { AcDbDxfFiler } from '../base'
import { AcDbSymbolTableRecord } from './AcDbSymbolTableRecord'

/**
 * Represents records in the AcDbRegAppTable (known as the APPID symbol table in AutoCAD and DXF).
 * Each of these records represents an application ID used to identify a group of Extended Entity
 * Data attached to objects in the drawing database.
 */
export class AcDbRegAppTableRecord extends AcDbSymbolTableRecord {
  constructor(name: string) {
    super()
    this.name = name
  }

  /**
   * Writes DXF fields for this object.
   *
   * @param filer - DXF output writer.
   * @returns The instance (for chaining).
   */
  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbRegAppTableRecord')
    filer.writeString(2, this.name)
    filer.writeInt16(70, 0)
    return this
  }
}
