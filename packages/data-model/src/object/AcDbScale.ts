import { AcDbDxfFiler } from '../base/AcDbDxfFiler.js'
import { AcDbObject } from '../base/AcDbObject.js'

/**
 * Nongraphical SCALE object (`AcDbScale`) stored in `ACAD_SCALELIST`.
 *
 * The annotation scale factor used for annotative objects is
 * {@link drawingUnits} / {@link paperUnits}.
 */
export class AcDbScale extends AcDbObject {
  private _classVersion = 0
  private _scaleName = ''
  private _paperUnits = 1
  private _drawingUnits = 1
  /** DXF group 290 — unit scale / temporary flag as written by AutoCAD. */
  private _isUnitScale = false

  get classVersion() {
    return this._classVersion
  }
  set classVersion(value: number) {
    this._classVersion = value
  }

  /** Human-readable scale name (DXF group 300), e.g. `"1:50"`. */
  get scaleName() {
    return this._scaleName
  }
  set scaleName(value: string) {
    this._scaleName = value
  }

  /** Paper units (DXF group 140). */
  get paperUnits() {
    return this._paperUnits
  }
  set paperUnits(value: number) {
    this._paperUnits = value > 0 ? value : 1
  }

  /** Drawing (model) units (DXF group 141). */
  get drawingUnits() {
    return this._drawingUnits
  }
  set drawingUnits(value: number) {
    this._drawingUnits = value > 0 ? value : 1
  }

  get isUnitScale() {
    return this._isUnitScale
  }
  set isUnitScale(value: boolean) {
    this._isUnitScale = value
  }

  /**
   * Scale factor that converts paper size to model size
   * (`drawingUnits / paperUnits`).
   */
  get scaleFactor() {
    return this._drawingUnits / this._paperUnits
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbScale')
    filer.writeInt16(70, this._classVersion)
    filer.writeString(300, this._scaleName)
    filer.writeDouble(140, this._paperUnits)
    filer.writeDouble(141, this._drawingUnits)
    filer.writeBoolean(290, this._isUnitScale)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    filer.atSubclassData('AcDbScale')

    while (!filer.atEndOfObject && !filer.atEof && !filer.atExtendedData) {
      const item = filer.readItem()
      if (!item) break
      const code = Number(item.code)
      if (code === 100) {
        filer.pushBackItem(item)
        break
      }
      switch (code) {
        case 70:
          this._classVersion = Number(item.value)
          break
        case 300:
          this._scaleName = String(item.value)
          break
        case 140:
          this.paperUnits = Number(item.value)
          break
        case 141:
          this.drawingUnits = Number(item.value)
          break
        case 290:
          this._isUnitScale = Boolean(Number(item.value))
          break
        default:
          break
      }
    }
    return this
  }
}
