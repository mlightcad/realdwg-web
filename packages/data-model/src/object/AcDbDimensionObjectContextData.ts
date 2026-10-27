import { AcGePoint3d } from '@mlightcad/geometry-engine'

import { AcDbDxfFiler } from '../base/AcDbDxfFiler.js'
import { AcDbAnnotScaleObjectContextData } from './AcDbAnnotScaleObjectContextData.js'

/**
 * Per-annotation-scale representation for annotative dimensions
 * (`ACDB_*DIMOBJECTCONTEXTDATA_CLASS` / `AcDbDimensionObjectContextData`).
 *
 * Critical fields for viewing:
 * - {@link blockName} — anonymous dim block for this scale (DXF 2)
 * - {@link definitionPoint} — OCS definition / insertion point (DXF 10)
 * - {@link dimLinePoint} — common subclass point (DXF 11), e.g. aligned dim line
 */
export class AcDbDimensionObjectContextData extends AcDbAnnotScaleObjectContextData {
  private _blockName = ''
  private _definitionPoint = new AcGePoint3d()
  private _dimLinePoint = new AcGePoint3d()
  private _hasDimLinePoint = false
  private _b293 = false
  private _b294 = false
  private _bd140 = 0
  private _b298 = false
  private _b291 = false
  private _flag = 0
  private _b292 = false
  private _bs71 = 0
  private _b280 = 0
  private _b295 = false
  private _b296 = false
  private _b297 = false

  /** Anonymous dimension block name for this scale (DXF 2), e.g. `*D94`. */
  get blockName() {
    return this._blockName
  }
  set blockName(value: string) {
    this._blockName = value
  }

  /** Definition / insertion point for this scale (DXF 10). */
  get definitionPoint() {
    return this._definitionPoint
  }
  set definitionPoint(value: AcGePoint3d) {
    this._definitionPoint.copy(value)
  }

  /**
   * Dim-line / type-specific point commonly stored as DXF 11 after the
   * aligned/rotated/… subclass marker.
   */
  get dimLinePoint() {
    return this._dimLinePoint
  }
  set dimLinePoint(value: AcGePoint3d) {
    this._dimLinePoint.copy(value)
    this._hasDimLinePoint = true
  }

  get hasDimLinePoint() {
    return this._hasDimLinePoint
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbDimensionObjectContextData')
    filer.writeString(2, this._blockName)
    filer.writeBoolean(293, this._b293)
    filer.writePoint3d(10, this._definitionPoint)
    filer.writeBoolean(294, this._b294)
    filer.writeDouble(140, this._bd140)
    filer.writeBoolean(298, this._b298)
    filer.writeBoolean(291, this._b291)
    filer.writeInt16(70, this._flag)
    filer.writeBoolean(292, this._b292)
    filer.writeInt16(71, this._bs71)
    filer.writeInt16(280, this._b280)
    filer.writeBoolean(295, this._b295)
    filer.writeBoolean(296, this._b296)
    filer.writeBoolean(297, this._b297)
    if (this._hasDimLinePoint) {
      filer.writePoint3d(11, this._dimLinePoint)
    }
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)

    let section: 'object' | 'annot' | 'dim' | 'typed' = 'object'
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
        if (marker === 'AcDbDimensionObjectContextData') {
          section = 'dim'
          continue
        }
        if (marker.includes('DimensionObjectContextData')) {
          // AcDbAlignedDimensionObjectContextData, etc.
          section = 'typed'
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

      // Shared dim + typed-subclass fields
      switch (code) {
        case 2:
          this._blockName = String(item.value)
          break
        case 10:
          this._definitionPoint.x = Number(item.value)
          break
        case 20:
          this._definitionPoint.y = Number(item.value)
          break
        case 30:
          this._definitionPoint.z = Number(item.value)
          break
        case 11:
          this._dimLinePoint.x = Number(item.value)
          this._hasDimLinePoint = true
          break
        case 21:
          this._dimLinePoint.y = Number(item.value)
          this._hasDimLinePoint = true
          break
        case 31:
          this._dimLinePoint.z = Number(item.value)
          this._hasDimLinePoint = true
          break
        case 293:
          this._b293 = Boolean(Number(item.value))
          break
        case 294:
          this._b294 = Boolean(Number(item.value))
          break
        case 140:
          this._bd140 = Number(item.value)
          break
        case 298:
          this._b298 = Boolean(Number(item.value))
          break
        case 291:
          this._b291 = Boolean(Number(item.value))
          break
        case 70:
          this._flag = Number(item.value)
          break
        case 292:
          this._b292 = Boolean(Number(item.value))
          break
        case 71:
          this._bs71 = Number(item.value)
          break
        case 280:
          this._b280 = Number(item.value)
          break
        case 295:
          this._b295 = Boolean(Number(item.value))
          break
        case 296:
          this._b296 = Boolean(Number(item.value))
          break
        case 297:
          this._b297 = Boolean(Number(item.value))
          break
        default:
          break
      }
    }
    return this
  }
}
