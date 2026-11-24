import { AcDbDxfFiler } from '../../base/AcDbDxfFiler.js'
import { AcDbObject, type AcDbObjectId } from '../../base/AcDbObject.js'
import type { AcDbDatabase } from '../../database/AcDbDatabase.js'
import { AcDbAssocActionBody } from './AcDbAssocActionBody.js'
import { AcDbAssocDependency } from './AcDbAssocDependency.js'
import {
  AcDbAssocStatus,
  acdbAssocStatusNeedsEvaluation
} from './AcDbAssocStatus.js'

/**
 * Associative action that owns an {@link AcDbAssocActionBody} and a set of
 * {@link AcDbAssocDependency} objects (ObjectARX `AcDbAssocAction`).
 *
 * External code should not subclass this class; put custom logic in an
 * {@link AcDbAssocActionBody} subclass.
 */
export class AcDbAssocAction extends AcDbObject {
  private _actionBodyId: AcDbObjectId = ''
  private _dependencyIds: AcDbObjectId[] = []
  private _status: AcDbAssocStatus = AcDbAssocStatus.IsUpToDateAssocStatus
  /** Owning network id. */
  private _owningNetworkId: AcDbObjectId = ''

  get actionBodyId(): AcDbObjectId {
    return this._actionBodyId
  }
  set actionBodyId(value: AcDbObjectId) {
    this._actionBodyId = value ?? ''
  }

  get dependencyIds(): readonly AcDbObjectId[] {
    return this._dependencyIds
  }

  get status(): AcDbAssocStatus {
    return this._status
  }
  set status(value: AcDbAssocStatus) {
    this._status = value
  }

  get owningNetworkId(): AcDbObjectId {
    return this._owningNetworkId
  }
  set owningNetworkId(value: AcDbObjectId) {
    this._owningNetworkId = value ?? ''
  }

  get needsEvaluation(): boolean {
    return acdbAssocStatusNeedsEvaluation(this._status)
  }

  setDirty(transitive = false): void {
    this._status = transitive
      ? AcDbAssocStatus.ChangedTransitivelyAssocStatus
      : AcDbAssocStatus.ChangedDirectlyAssocStatus
  }

  setUpToDate(): void {
    this._status = AcDbAssocStatus.IsUpToDateAssocStatus
  }

  addDependencyId(id: AcDbObjectId): void {
    if (!id || this._dependencyIds.includes(id)) return
    this._dependencyIds.push(id)
  }

  removeDependencyId(id: AcDbObjectId): void {
    this._dependencyIds = this._dependencyIds.filter(x => x !== id)
  }

  /**
   * Returns the owned action body, if present in the database.
   */
  actionBody(db?: AcDbDatabase): AcDbAssocActionBody | undefined {
    const database = db ?? this.database
    if (!database || !this._actionBodyId) return undefined
    const obj = database.getObjectById(this._actionBodyId)
    return obj instanceof AcDbAssocActionBody ? obj : undefined
  }

  /**
   * Returns owned dependencies present in the database.
   */
  dependencies(db?: AcDbDatabase): AcDbAssocDependency[] {
    const database = db ?? this.database
    if (!database) return []
    const result: AcDbAssocDependency[] = []
    for (const id of this._dependencyIds) {
      const obj = database.getObjectById(id)
      if (obj instanceof AcDbAssocDependency) result.push(obj)
    }
    return result
  }

  /**
   * Evaluates this action by calling {@link AcDbAssocActionBody.evaluateOverride}.
   */
  evaluate(): void {
    const body = this.actionBody()
    if (!body) {
      this._status = AcDbAssocStatus.FailedToEvaluateAssocStatus
      return
    }
    try {
      body.evaluateOverride()
      // evaluateOverride may set FailedToEvaluateAssocStatus (e.g. missing
      // array/source block); do not clear that with setUpToDate().
      if (this._status === AcDbAssocStatus.FailedToEvaluateAssocStatus) {
        return
      }
      for (const dep of this.dependencies()) {
        dep.setUpToDate()
      }
      this.setUpToDate()
    } catch {
      this._status = AcDbAssocStatus.FailedToEvaluateAssocStatus
    }
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeString(100, 'AcDbAssocAction')
    filer.writeObjectId(330, this._owningNetworkId)
    filer.writeObjectId(360, this._actionBodyId)
    filer.writeInt32(90, this._status)
    filer.writeInt32(90, this._dependencyIds.length)
    for (const id of this._dependencyIds) {
      filer.writeObjectId(360, id)
    }
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    filer.atSubclassData('AcDbAssocAction')

    // Match dxfOutFields order: 330 network → 360 body → 90 status →
    // 90 dependency count → 360 dependency ids.
    let statusRead = false
    let expectingDepCount: number | undefined
    this._dependencyIds = []

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
          this._owningNetworkId = String(item.value ?? '')
          break
        case 360: {
          const id = String(item.value ?? '')
          if (!this._actionBodyId) {
            this._actionBodyId = id
          } else if (expectingDepCount !== undefined) {
            this._dependencyIds.push(id)
          }
          break
        }
        case 90: {
          const n = Number(item.value)
          if (!statusRead) {
            this._status = n as AcDbAssocStatus
            statusRead = true
          } else if (expectingDepCount === undefined) {
            expectingDepCount = Math.max(0, n)
          }
          break
        }
        default:
          break
      }
    }
    return this
  }
}
