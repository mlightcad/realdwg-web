import { AcDbDxfFiler } from '../base/AcDbDxfFiler.js'
import { AcDbObject } from '../base/AcDbObject.js'

/**
 * Base class for per-context representation data
 * (`AcDbObjectContextData` in AutoCAD ObjectARX).
 */
export class AcDbObjectContextData extends AcDbObject {
  private _classVersion = 4
  private _isDefault = false

  get classVersion() {
    return this._classVersion
  }
  set classVersion(value: number) {
    this._classVersion = value
  }

  /** True when this representation matches the entity record (DXF 290). */
  get isDefault() {
    return this._isDefault
  }
  set isDefault(value: boolean) {
    this._isDefault = value
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbObjectContextData')
    filer.writeInt16(70, this._classVersion)
    filer.writeBoolean(290, this._isDefault)
    return this
  }

  /**
   * Reads `AcDbObjectContextData` fields. Returns the next subclass marker
   * when present so subclasses can continue the section walk.
   */
  protected dxfInObjectContextData(
    filer: AcDbDxfFiler
  ): string | undefined {
    filer.atSubclassData('AcDbObjectContextData')
    while (!filer.atEndOfObject && !filer.atEof && !filer.atExtendedData) {
      const item = filer.readItem()
      if (!item) break
      const code = Number(item.code)
      if (code === 100) {
        return String(item.value)
      }
      switch (code) {
        case 70:
          this._classVersion = Number(item.value)
          break
        case 290:
          this._isDefault = Boolean(Number(item.value))
          break
        default:
          break
      }
    }
    return undefined
  }
}
