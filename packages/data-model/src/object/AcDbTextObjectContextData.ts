import { AcGePoint3d } from '@mlightcad/geometry-engine'

import { AcDbDxfFiler } from '../base/AcDbDxfFiler.js'
import { AcDbAnnotScaleObjectContextData } from './AcDbAnnotScaleObjectContextData.js'

/**
 * Per-annotation-scale representation for annotative TEXT
 * (`ACDB_TEXTOBJECTCONTEXTDATA_CLASS` / `AcDbTextObjectContextData`).
 */
export class AcDbTextObjectContextData extends AcDbAnnotScaleObjectContextData {
  private _horizontalMode = 0
  private _rotation = 0
  private _alignmentPoint = new AcGePoint3d()
  private _position = new AcGePoint3d()

  get horizontalMode() {
    return this._horizontalMode
  }
  set horizontalMode(value: number) {
    this._horizontalMode = value
  }

  get rotation() {
    return this._rotation
  }
  set rotation(value: number) {
    this._rotation = value
  }

  get alignmentPoint() {
    return this._alignmentPoint
  }
  set alignmentPoint(value: AcGePoint3d) {
    this._alignmentPoint.copy(value)
  }

  get position() {
    return this._position
  }
  set position(value: AcGePoint3d) {
    this._position.copy(value)
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbTextObjectContextData')
    filer.writeInt16(70, this._horizontalMode)
    filer.writeDouble(50, this._rotation)
    filer.writePoint3d(10, this._alignmentPoint)
    filer.writePoint3d(11, this._position)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)

    let section: 'object' | 'annot' | 'text' = 'object'
    filer.atSubclassData('AcDbObjectContextData')

    while (!filer.atEndOfObject && !filer.atEof && !filer.atExtendedData) {
      const item = filer.readItem()
      if (!item) break
      const code = Number(item.code)
      if (code === 100) {
        const marker = String(item.value)
        if (marker === 'AcDbAnnotScaleObjectContextData') {
          section = 'annot'
          continue
        }
        if (marker === 'AcDbTextObjectContextData') {
          section = 'text'
          continue
        }
        filer.pushBackItem(item)
        break
      }

      if (section === 'object') {
        switch (code) {
          case 70:
            this.classVersion = Number(item.value)
            break
          case 290:
            this.isDefault = Boolean(Number(item.value))
            break
          default:
            break
        }
        continue
      }

      if (section === 'annot') {
        if (code === 340) this.scaleId = String(item.value)
        continue
      }

      switch (code) {
        case 70:
          this._horizontalMode = Number(item.value)
          break
        case 50:
          this._rotation = Number(item.value)
          break
        case 10:
          this._alignmentPoint.x = Number(item.value)
          break
        case 20:
          this._alignmentPoint.y = Number(item.value)
          break
        case 30:
          this._alignmentPoint.z = Number(item.value)
          break
        case 11:
          this._position.x = Number(item.value)
          break
        case 21:
          this._position.y = Number(item.value)
          break
        case 31:
          this._position.z = Number(item.value)
          break
        default:
          break
      }
    }
    return this
  }
}
