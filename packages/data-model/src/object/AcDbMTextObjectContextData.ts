import { AcGePoint3d, AcGeVector3d } from '@mlightcad/geometry-engine'

import { AcDbDxfFiler } from '../base/AcDbDxfFiler.js'
import { AcDbObject, type AcDbObjectId } from '../base/AcDbObject.js'

/**
 * Per-annotation-scale representation for an annotative MTEXT
 * (`ACDB_MTEXTOBJECTCONTEXTDATA_CLASS` / `AcDbMTextObjectContextData`).
 *
 * Text height is not stored here — derive it from the linked {@link scaleId}
 * and the entity's stored height for the default scale.
 */
export class AcDbMTextObjectContextData extends AcDbObject {
  private _classVersion = 4
  private _isDefault = false
  private _scaleId: AcDbObjectId = ''
  private _attachmentPoint = 1
  private _direction = new AcGeVector3d(1, 0, 0)
  private _insertionPoint = new AcGePoint3d()
  private _definedWidth = 0
  private _definedHeight = 0
  private _extentsWidth = 0
  private _extentsHeight = 0
  private _columnType = 0

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

  /** Soft-pointer to the {@link AcDbScale} object (DXF 340). */
  get scaleId() {
    return this._scaleId
  }
  set scaleId(value: AcDbObjectId) {
    this._scaleId = value
  }

  get attachmentPoint() {
    return this._attachmentPoint
  }
  set attachmentPoint(value: number) {
    this._attachmentPoint = value
  }

  get direction() {
    return this._direction
  }
  set direction(value: AcGeVector3d) {
    this._direction.copy(value)
  }

  get insertionPoint() {
    return this._insertionPoint
  }
  set insertionPoint(value: AcGePoint3d) {
    this._insertionPoint.copy(value)
  }

  get definedWidth() {
    return this._definedWidth
  }
  set definedWidth(value: number) {
    this._definedWidth = value
  }

  get definedHeight() {
    return this._definedHeight
  }
  set definedHeight(value: number) {
    this._definedHeight = value
  }

  get extentsWidth() {
    return this._extentsWidth
  }
  set extentsWidth(value: number) {
    this._extentsWidth = value
  }

  get extentsHeight() {
    return this._extentsHeight
  }
  set extentsHeight(value: number) {
    this._extentsHeight = value
  }

  get columnType() {
    return this._columnType
  }
  set columnType(value: number) {
    this._columnType = value
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbObjectContextData')
    filer.writeInt16(70, this._classVersion)
    filer.writeBoolean(290, this._isDefault)
    filer.writeSubclassMarker('AcDbAnnotScaleObjectContextData')
    filer.writeObjectId(340, this._scaleId)
    filer.writeInt16(70, this._attachmentPoint)
    filer.writeVector3d(10, this._direction)
    filer.writePoint3d(11, this._insertionPoint)
    filer.writeDouble(40, this._definedWidth)
    filer.writeDouble(41, this._definedHeight)
    filer.writeDouble(42, this._extentsWidth)
    filer.writeDouble(43, this._extentsHeight)
    filer.writeInt16(71, this._columnType)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)

    // Walk subclass markers in order; field codes repeat across subclasses.
    let section: 'object' | 'annot' | 'mtext' = 'object'
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
        if (marker === 'AcDbMTextObjectContextData') {
          section = 'mtext'
          continue
        }
        filer.pushBackItem(item)
        break
      }

      if (section === 'object') {
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
        continue
      }

      // Annot-scale + MTEXT context fields share the same group codes after
      // AcDbAnnotScaleObjectContextData (AutoCAD often omits the MTEXT marker).
      switch (code) {
        case 340:
          this._scaleId = String(item.value)
          break
        case 70:
          this._attachmentPoint = Number(item.value)
          break
        case 10:
          this._direction.x = Number(item.value)
          break
        case 20:
          this._direction.y = Number(item.value)
          break
        case 30:
          this._direction.z = Number(item.value)
          break
        case 11:
          this._insertionPoint.x = Number(item.value)
          break
        case 21:
          this._insertionPoint.y = Number(item.value)
          break
        case 31:
          this._insertionPoint.z = Number(item.value)
          break
        case 40:
          this._definedWidth = Number(item.value)
          break
        case 41:
          this._definedHeight = Number(item.value)
          break
        case 42:
          this._extentsWidth = Number(item.value)
          break
        case 43:
          this._extentsHeight = Number(item.value)
          break
        case 71:
          this._columnType = Number(item.value)
          break
        default:
          break
      }
    }
    return this
  }
}
