import { AcDbDxfFiler } from '../../base/AcDbDxfFiler.js'
import type { AcDbObjectId } from '../../base/AcDbObject.js'
import type { AcDbDatabase } from '../../database/AcDbDatabase.js'
import { AcDbAssocAction } from './AcDbAssocAction.js'
import { AcDbAssocStatus } from './AcDbAssocStatus.js'

/**
 * Network of associative actions (ObjectARX `AcDbAssocNetwork`).
 *
 * Itself an {@link AcDbAssocAction}, so hierarchical networks are representable.
 * The top-level network for a database lives under the NOD key
 * `ACAD_ASSOCNETWORK`.
 */
export class AcDbAssocNetwork extends AcDbAssocAction {
  private _actionIds: AcDbObjectId[] = []

  get actionIds(): readonly AcDbObjectId[] {
    return this._actionIds
  }

  addAction(actionId: AcDbObjectId): void {
    if (!actionId || this._actionIds.includes(actionId)) return
    this._actionIds.push(actionId)
  }

  removeAction(actionId: AcDbObjectId): void {
    this._actionIds = this._actionIds.filter(id => id !== actionId)
  }

  actions(db?: AcDbDatabase): AcDbAssocAction[] {
    const database = db ?? this.database
    if (!database) return []
    const result: AcDbAssocAction[] = []
    for (const id of this._actionIds) {
      const obj = database.getObjectById(id)
      if (obj instanceof AcDbAssocAction && !(obj instanceof AcDbAssocNetwork)) {
        result.push(obj)
      } else if (obj instanceof AcDbAssocNetwork) {
        result.push(obj)
      }
    }
    return result
  }

  /**
   * Marks this network dirty when any owned action is dirty, then evaluates
   * owned actions that need evaluation (depth-first for nested networks).
   */
  override evaluate(): void {
    const database = this.database
    if (!database) {
      this.status = AcDbAssocStatus.FailedToEvaluateAssocStatus
      return
    }

    let failed = false
    for (const action of this.actions(database)) {
      if (action instanceof AcDbAssocNetwork) {
        action.evaluate()
        if (action.status === AcDbAssocStatus.FailedToEvaluateAssocStatus) {
          failed = true
        }
        continue
      }
      // Propagate dirty deps onto the action.
      for (const dep of action.dependencies(database)) {
        if (dep.needsEvaluation) {
          action.setDirty(
            dep.status === AcDbAssocStatus.ChangedTransitivelyAssocStatus
          )
          break
        }
      }
      if (action.needsEvaluation) {
        action.evaluate()
      }
      if (action.status === AcDbAssocStatus.FailedToEvaluateAssocStatus) {
        failed = true
      }
    }
    if (failed) {
      this.status = AcDbAssocStatus.FailedToEvaluateAssocStatus
    } else {
      this.setUpToDate()
    }
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeString(100, 'AcDbAssocNetwork')
    filer.writeInt32(90, this._actionIds.length)
    for (const id of this._actionIds) {
      filer.writeObjectId(360, id)
    }
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    filer.atSubclassData('AcDbAssocNetwork')
    this._actionIds = []
    let count: number | undefined

    while (!filer.atEndOfObject && !filer.atEof && !filer.atExtendedData) {
      const item = filer.readItem()
      if (!item) break
      const code = Number(item.code)
      if (code === 100) {
        filer.pushBackItem(item)
        break
      }
      if (code === 90) {
        count = Number(item.value)
      } else if (code === 360) {
        this._actionIds.push(String(item.value ?? ''))
        if (count !== undefined && this._actionIds.length >= count) {
          // keep reading nothing else typically
        }
      }
    }
    return this
  }
}
