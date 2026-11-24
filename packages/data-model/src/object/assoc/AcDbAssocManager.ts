import type { AcDbObjectId } from '../../base/AcDbObject.js'
import type { AcDbDatabase } from '../../database/AcDbDatabase.js'
import { AcDbAssocDependency } from './AcDbAssocDependency.js'
import { AcDbAssocNetwork } from './AcDbAssocNetwork.js'
import { AcDbAssocStatus } from './AcDbAssocStatus.js'

const ROOT_NETWORK_KEY = 'ACAD_ASSOCNETWORK'

/**
 * Entry points for the associative framework (ObjectARX `AcDbAssocManager`).
 */
export class AcDbAssocManager {
  private constructor() {}

  /**
   * Returns the top-level {@link AcDbAssocNetwork} for `db`, creating and
   * registering it under `objects.assocNetwork` (NOD key `ACAD_ASSOCNETWORK`)
   * when missing.
   */
  static getTopLevelNetwork(
    db: AcDbDatabase,
    createIfMissing = true
  ): AcDbAssocNetwork | undefined {
    const existing = db.objects.assocNetwork.getAt(ROOT_NETWORK_KEY)
    if (existing instanceof AcDbAssocNetwork) {
      return existing
    }

    if (!createIfMissing) return undefined

    const network = new AcDbAssocNetwork()
    db.objects.assocNetwork.setAt(ROOT_NETWORK_KEY, network)
    return network
  }

  /**
   * Evaluates all dirty actions in the top-level associative network.
   */
  static evaluateTopLevelNetwork(db: AcDbDatabase): boolean {
    const network = AcDbAssocManager.getTopLevelNetwork(db, false)
    if (!network) return true
    network.evaluate()
    return network.status !== AcDbAssocStatus.FailedToEvaluateAssocStatus
  }

  /**
   * Notifies dependencies that depend on `objectId` that the object changed.
   * Callers should later invoke {@link evaluateTopLevelNetwork}.
   */
  static notifyObjectChanged(
    db: AcDbDatabase,
    objectId: AcDbObjectId,
    transitive = false
  ): void {
    if (!objectId) return
    for (const [, dep] of db.objects.assocDependency.entries()) {
      if (!(dep instanceof AcDbAssocDependency)) continue
      if (dep.dependentOnObjectId !== objectId) continue
      dep.setDirty(transitive)
      const action = db.getObjectById(dep.owningActionId)
      if (action && 'setDirty' in action) {
        ;(action as { setDirty(t?: boolean): void }).setDirty(transitive)
      }
    }
  }
}
