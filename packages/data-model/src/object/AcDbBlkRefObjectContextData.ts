import { AcGePoint3d } from '@mlightcad/geometry-engine'

import { AcDbDxfFiler } from '../base/AcDbDxfFiler.js'
import { AcDbAnnotScaleObjectContextData } from './AcDbAnnotScaleObjectContextData.js'

/**
 * Per-annotation-scale representation for annotative block references
 * (`AcDbBlkRefObjectContextData`).
 */
export class AcDbBlkRefObjectContextData extends AcDbAnnotScaleObjectContextData {
  private _position = new AcGePoint3d()
  private _rotation = 0
  private _scaleX = 1
  private _scaleY = 1
  private _scaleZ = 1

  get position() {
    return this._position
  }
  set position(value: AcGePoint3d) {
    this._position.copy(value)
  }

  get rotation() {
    return this._rotation
  }
  set rotation(value: number) {
    this._rotation = value
  }

  get scaleX() {
    return this._scaleX
  }
  set scaleX(value: number) {
    this._scaleX = value
  }

  get scaleY() {
    return this._scaleY
  }
  set scaleY(value: number) {
    this._scaleY = value
  }

  get scaleZ() {
    return this._scaleZ
  }
  set scaleZ(value: number) {
    this._scaleZ = value
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbBlkRefObjectContextData')
    filer.writePoint3d(10, this._position)
    filer.writeDouble(50, this._rotation)
    filer.writeDouble(41, this._scaleX)
    filer.writeDouble(42, this._scaleY)
    filer.writeDouble(43, this._scaleZ)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)

    let section: 'object' | 'annot' | 'blk' = 'object'
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
        if (marker === 'AcDbBlkRefObjectContextData') {
          section = 'blk'
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

      if (section !== 'blk') continue

      switch (code) {
        case 10:
          this._position.x = Number(item.value)
          break
        case 20:
          this._position.y = Number(item.value)
          break
        case 30:
          this._position.z = Number(item.value)
          break
        case 50:
          this._rotation = Number(item.value)
          break
        case 41:
          this._scaleX = Number(item.value)
          break
        case 42:
          this._scaleY = Number(item.value)
          break
        case 43:
          this._scaleZ = Number(item.value)
          break
        default:
          break
      }
    }
    return this
  }
}
