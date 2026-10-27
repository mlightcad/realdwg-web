import { AcDbDxfFiler } from '../base/AcDbDxfFiler.js'
import type { AcDbObjectId } from '../base/AcDbObject.js'

import { AcDbObjectContextData } from './AcDbObjectContextData.js'

/**
 * Annotation-scale context data base
 * (`AcDbAnnotScaleObjectContextData` in AutoCAD ObjectARX).
 *
 * Links a per-scale representation to an {@link AcDbScale} via {@link scaleId}.
 */
export class AcDbAnnotScaleObjectContextData extends AcDbObjectContextData {
  private _scaleId: AcDbObjectId = ''

  /** Soft-pointer to the {@link AcDbScale} object (DXF 340). */
  get scaleId() {
    return this._scaleId
  }
  set scaleId(value: AcDbObjectId) {
    this._scaleId = value
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbAnnotScaleObjectContextData')
    filer.writeObjectId(340, this._scaleId)
    return this
  }
}
