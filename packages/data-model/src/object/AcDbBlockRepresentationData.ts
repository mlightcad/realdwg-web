import { AcDbDxfFiler } from '../base/AcDbDxfFiler'
import { AcDbObject, AcDbObjectId } from '../base/AcDbObject'

/**
 * Database-resident object that stores the dynamic-block definition referenced
 * by an evaluated anonymous representation.
 *
 * Mirrors the role of AutoCAD's `AcDbBlockRepresentationData` (DXF
 * `ACDB_BLOCKREPRESENTATION_DATA`): the soft pointer to the original dynamic
 * {@link AcDbBlockTableRecord} used by
 * {@link AcDbDynBlockReference.dynamicBlockTableRecord}.
 */
export class AcDbBlockRepresentationData extends AcDbObject {
  private _blockId: AcDbObjectId = ''

  /**
   * Object id of the original dynamic block table record.
   */
  get blockId(): AcDbObjectId {
    return this._blockId
  }
  set blockId(value: AcDbObjectId) {
    this._blockId = value ?? ''
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeObjectId(340, this._blockId)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    filer.atSubclassData('AcDbBlockRepresentationData')

    while (!filer.atEndOfObject && !filer.atEof && !filer.atExtendedData) {
      const item = filer.readItem()
      if (!item) break
      const code = Number(item.code)
      if (code === 100) {
        filer.pushBackItem(item)
        break
      }
      if (code === 340) {
        this._blockId = String(item.value ?? '')
      }
    }
    return this
  }
}
