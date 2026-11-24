import { AcDbDxfFiler } from '../../base/AcDbDxfFiler.js'
import { AcDbObject, type AcDbObjectId } from '../../base/AcDbObject.js'

/**
 * Abstract body that implements the algorithm of an {@link AcDbAssocAction}
 * (ObjectARX `AcDbAssocActionBody`).
 *
 * Custom behaviors override {@link evaluateOverride}. The parent action owns
 * this body; when the action is erased the body is erased with it.
 */
export abstract class AcDbAssocActionBody extends AcDbObject {
  /** Soft pointer back to the owning {@link AcDbAssocAction}. */
  private _parentActionId: AcDbObjectId = ''

  get parentActionId(): AcDbObjectId {
    return this._parentActionId
  }
  set parentActionId(value: AcDbObjectId) {
    this._parentActionId = value ?? ''
  }

  /**
   * Performs the associative evaluation algorithm.
   *
   * Must be overridden by concrete action bodies.
   */
  abstract evaluateOverride(): void

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeString(100, 'AcDbAssocActionBody')
    filer.writeObjectId(330, this._parentActionId)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    filer.atSubclassData('AcDbAssocActionBody')

    while (!filer.atEndOfObject && !filer.atEof && !filer.atExtendedData) {
      const item = filer.readItem()
      if (!item) break
      const code = Number(item.code)
      if (code === 100) {
        filer.pushBackItem(item)
        break
      }
      if (code === 330) {
        this._parentActionId = String(item.value ?? '')
      }
    }
    return this
  }
}
