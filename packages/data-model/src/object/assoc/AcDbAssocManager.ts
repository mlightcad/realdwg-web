import type { AcDbObjectId } from '../../base/AcDbObject.js'
import type { AcDbDatabase } from '../../database/AcDbDatabase.js'
import { AcDbAssocAction } from './AcDbAssocAction.js'
import { AcDbAssocDependency } from './AcDbAssocDependency.js'
import { AcDbAssocNetwork } from './AcDbAssocNetwork.js'
import { AcDbAssocStatus } from './AcDbAssocStatus.js'

/**
 * Entry points for the associative framework (ObjectARX `AcDbAssocManager`).
 */
export class AcDbAssocManager {
  private constructor() {}

  /**
   * Returns the top-level {@link AcDbAssocNetwork} for `db` (NOD →
   * `ACAD_ASSOCNETWORK`), creating it when missing.
   */
  static getTopLevelNetwork(
    db: AcDbDatabase,
    createIfMissing = true
  ): AcDbAssocNetwork | undefined {
    return AcDbAssocNetwork.getInstanceFromDatabase(db, createIfMissing)
  }

  /**
   * Returns every network reachable from the top-level network and from the
   * block table records' extension dictionaries.
   */
  static getAllNetworks(db: AcDbDatabase): AcDbAssocNetwork[] {
    const result: AcDbAssocNetwork[] = []
    const seen = new Set<AcDbAssocNetwork>()
    const walk = (network: AcDbAssocNetwork | undefined) => {
      if (!network || seen.has(network)) return
      seen.add(network)
      result.push(network)
      for (const action of network.actions(db)) {
        if (action instanceof AcDbAssocNetwork) walk(action)
      }
    }
    walk(AcDbAssocNetwork.getInstanceFromDatabase(db, false))
    for (const btr of db.tables.blockTable.newIterator()) {
      walk(AcDbAssocNetwork.getInstanceFromObject(btr, false, false))
    }
    return result
  }

  /**
   * Evaluates all dirty actions in the associative networks of `db`.
   */
  static evaluateTopLevelNetwork(db: AcDbDatabase): boolean {
    const networks = AcDbAssocManager.getAllNetworks(db)
    if (networks.length === 0) return true
    let ok = true
    const top = AcDbAssocNetwork.getInstanceFromDatabase(db, false)
    const roots = top ? [top] : []
    // Space networks not referenced by the top-level network.
    for (const network of networks) {
      if (network !== top && !network.owningNetworkId) roots.push(network)
    }
    for (const network of roots) {
      network.evaluate()
      if (network.status === AcDbAssocStatus.FailedToEvaluateAssocStatus) {
        ok = false
      }
    }
    return ok
  }

  /**
   * Notifies the dependencies attached to `objectId` that the object changed
   * (they are its persistent reactors). Callers should later invoke
   * {@link evaluateTopLevelNetwork}.
   */
  static notifyObjectChanged(
    db: AcDbDatabase,
    objectId: AcDbObjectId,
    transitive = false
  ): void {
    if (!objectId) return
    const object = db.getObjectById(objectId)
    if (!object) return
    for (const reactorId of object.getPersistentReactors()) {
      const dep = db.getObjectById(reactorId)
      if (!(dep instanceof AcDbAssocDependency)) continue
      if (dep.dependentOnObjectId !== objectId) continue
      dep.setDirty(transitive)
      const action = db.getObjectById(dep.owningActionId)
      if (action instanceof AcDbAssocAction) action.setDirty(transitive)
    }
  }

  /**
   * Links associative objects after a file was loaded: makes sure every
   * attached dependency is a persistent reactor of its object. DXF carries
   * the reactors; the DWG converter does not.
   */
  static linkLoadedObjects(db: AcDbDatabase): void {
    for (const network of AcDbAssocManager.getAllNetworks(db)) {
      for (const action of network.actions(db)) {
        for (const dep of action.dependencies(db)) dep.relinkReactor()
      }
    }
  }
}
