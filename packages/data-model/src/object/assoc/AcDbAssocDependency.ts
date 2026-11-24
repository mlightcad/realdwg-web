import { AcDbDxfFiler } from '../../base/AcDbDxfFiler.js'
import { AcDbObject, type AcDbObjectId } from '../../base/AcDbObject.js'
import {
  AcDbAssocStatus,
  acdbAssocStatusNeedsEvaluation
} from './AcDbAssocStatus.js'

/**
 * Records that an {@link AcDbAssocAction} reads and/or writes an `AcDbObject`
 * (ObjectARX `AcDbAssocDependency`).
 */
export class AcDbAssocDependency extends AcDbObject {
  private _dependentOnObjectId: AcDbObjectId = ''
  private _isReadDependency = true
  private _isWriteDependency = false
  private _status: AcDbAssocStatus = AcDbAssocStatus.IsUpToDateAssocStatus
  /** Owning action id (soft pointer). */
  private _owningActionId: AcDbObjectId = ''

  get dependentOnObjectId(): AcDbObjectId {
    return this._dependentOnObjectId
  }
  set dependentOnObjectId(value: AcDbObjectId) {
    this._dependentOnObjectId = value ?? ''
  }

  get isReadDependency(): boolean {
    return this._isReadDependency
  }
  set isReadDependency(value: boolean) {
    this._isReadDependency = !!value
  }

  get isWriteDependency(): boolean {
    return this._isWriteDependency
  }
  set isWriteDependency(value: boolean) {
    this._isWriteDependency = !!value
  }

  get status(): AcDbAssocStatus {
    return this._status
  }
  set status(value: AcDbAssocStatus) {
    this._status = value
  }

  get owningActionId(): AcDbObjectId {
    return this._owningActionId
  }
  set owningActionId(value: AcDbObjectId) {
    this._owningActionId = value ?? ''
  }

  get needsEvaluation(): boolean {
    return acdbAssocStatusNeedsEvaluation(this._status)
  }

  /**
   * Marks this dependency (and optionally its owning action) dirty.
   */
  setDirty(transitive = false): void {
    this._status = transitive
      ? AcDbAssocStatus.ChangedTransitivelyAssocStatus
      : AcDbAssocStatus.ChangedDirectlyAssocStatus
  }

  setUpToDate(): void {
    this._status = AcDbAssocStatus.IsUpToDateAssocStatus
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeString(100, 'AcDbAssocDependency')
    filer.writeObjectId(330, this._owningActionId)
    filer.writeObjectId(340, this._dependentOnObjectId)
    filer.writeInt32(90, this._status)
    filer.writeInt8(290, this._isReadDependency ? 1 : 0)
    filer.writeInt8(291, this._isWriteDependency ? 1 : 0)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    filer.atSubclassData('AcDbAssocDependency')

    while (!filer.atEndOfObject && !filer.atEof && !filer.atExtendedData) {
      const item = filer.readItem()
      if (!item) break
      const code = Number(item.code)
      if (code === 100) {
        filer.pushBackItem(item)
        break
      }
      switch (code) {
        case 330:
          this._owningActionId = String(item.value ?? '')
          break
        case 340:
          this._dependentOnObjectId = String(item.value ?? '')
          break
        case 90:
          this._status = Number(item.value) as AcDbAssocStatus
          break
        case 290:
          this._isReadDependency = Number(item.value) !== 0
          break
        case 291:
          this._isWriteDependency = Number(item.value) !== 0
          break
        default:
          break
      }
    }
    return this
  }
}
