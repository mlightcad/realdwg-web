import { AcGePoint3d } from '@mlightcad/geometry-engine'

import { AcDbDxfFiler } from '../base/AcDbDxfFiler.js'

import { AcDbAnnotScaleObjectContextData } from './AcDbAnnotScaleObjectContextData.js'

/**
 * Per-annotation-scale representation for annotative multileaders
 * (`ACDB_MLEADEROBJECTCONTEXTDATA_CLASS` / `AcDbMLeaderObjectContextData`).
 *
 * Stores the feature sizes and text anchor needed to redraw at CANNOSCALE.
 * Full leader vertex trees are still owned by the entity; when present this
 * context overrides scale-dependent sizes and the text landing point.
 */
export class AcDbMLeaderObjectContextData extends AcDbAnnotScaleObjectContextData {
  private _contentScale = 1
  private _textHeight = 0
  private _arrowheadSize = 0
  private _textAnchor = new AcGePoint3d()
  private _hasTextAnchor = false

  /** Content / overall scale for this representation (DXF 40). */
  get contentScale() {
    return this._contentScale
  }
  set contentScale(value: number) {
    this._contentScale = value > 0 ? value : 1
  }

  /** Text height at this scale (DXF 41 / 44). */
  get textHeight() {
    return this._textHeight
  }
  set textHeight(value: number) {
    this._textHeight = value
  }

  /** Arrowhead size at this scale (DXF 140). */
  get arrowheadSize() {
    return this._arrowheadSize
  }
  set arrowheadSize(value: number) {
    this._arrowheadSize = value
  }

  /** MText landing / anchor point at this scale (DXF 12). */
  get textAnchor() {
    return this._textAnchor
  }
  set textAnchor(value: AcGePoint3d) {
    this._textAnchor.copy(value)
    this._hasTextAnchor = true
  }

  get hasTextAnchor() {
    return this._hasTextAnchor
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbMLeaderObjectContextData')
    filer.writeDouble(40, this._contentScale)
    if (this._textHeight > 0) filer.writeDouble(41, this._textHeight)
    if (this._arrowheadSize > 0) filer.writeDouble(140, this._arrowheadSize)
    if (this._hasTextAnchor) filer.writePoint3d(12, this._textAnchor)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)

    let section: 'object' | 'annot' | 'mleader' = 'object'
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
        if (marker === 'AcDbMLeaderObjectContextData') {
          section = 'mleader'
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

      if (section === 'annot' && code === 340) {
        this.scaleId = String(item.value)
        continue
      }

      switch (code) {
        case 40:
          this._contentScale = Number(item.value) > 0 ? Number(item.value) : 1
          break
        case 41:
        case 44:
          if (Number(item.value) > 0) this._textHeight = Number(item.value)
          break
        case 140:
          if (Number(item.value) > 0) this._arrowheadSize = Number(item.value)
          break
        case 12:
          this._textAnchor.x = Number(item.value)
          this._hasTextAnchor = true
          break
        case 22:
          this._textAnchor.y = Number(item.value)
          this._hasTextAnchor = true
          break
        case 32:
          this._textAnchor.z = Number(item.value)
          this._hasTextAnchor = true
          break
        default:
          break
      }
    }
    return this
  }
}
