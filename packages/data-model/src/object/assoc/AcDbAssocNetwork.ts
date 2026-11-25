import { AcDbDxfFiler } from '../../base/AcDbDxfFiler.js'
import type { AcDbObject, AcDbObjectId } from '../../base/AcDbObject.js'
import type { AcDbDatabase } from '../../database/AcDbDatabase.js'
import { AcDbDictionary } from '../AcDbDictionary.js'
import { AcDbAssocAction } from './AcDbAssocAction.js'
import { ACDB_ASSOC_NETWORK_DICT } from './AcDbAssocConstants.js'
import { AcDbAssocDxfCursor } from './acdbAssocDxf.js'
import { AcDbAssocStatus } from './AcDbAssocStatus.js'
import {
  acdbAssocAddOwnedObject,
  acdbAssocEraseObject
} from './acdbAssocUtil.js'

const ACDB_ASSOC_NETWORK_KEY = ACDB_ASSOC_NETWORK_DICT

interface AcDbAssocActionRef {
  id: AcDbObjectId
  /** True when the network owns the action (DXF 360) vs soft (330). */
  isOwned: boolean
}

/**
 * Network of associative actions (ObjectARX `AcDbAssocNetwork`).
 *
 * Itself an {@link AcDbAssocAction}, so networks nest. AutoCAD keeps:
 * - a database (top-level) network:
 *   NOD → `ACAD_ASSOCNETWORK` dictionary → `ACAD_ASSOCNETWORK` → network;
 * - one network per space block:
 *   BTR extension dictionary → `ACAD_ASSOCNETWORK` dictionary →
 *   `ACAD_ASSOCNETWORK` → network. It owns the actions of that space and is
 *   referenced (not owned) by the top-level network.
 *
 * DXF layout (`AcDbAssocNetwork` subclass): `90 0, 90 maxActionIndex, 90 n,
 * (360 owned | 330 soft action)×n, 90 m, (330 owned action)×m`.
 */
export class AcDbAssocNetwork extends AcDbAssocAction {
  static override readonly DXF_NAME: string = 'ACDBASSOCNETWORK'

  private _networkClassVersion = 0
  private _maxActionIndex = 0
  private _actions: AcDbAssocActionRef[] = []
  private _ownedActionIds: AcDbObjectId[] = []

  get actionIds(): readonly AcDbObjectId[] {
    return this._actions.map(action => action.id)
  }

  get maxActionIndex(): number {
    return this._maxActionIndex
  }

  /**
   * Returns the network stored under `dictionaryKey` in the extension
   * dictionary of `owner` (usually a space block table record), creating it
   * when requested (ObjectARX `AcDbAssocNetwork::getInstanceFromObject`).
   *
   * @param addToTopLevelNetwork - Reference a new network from the
   *   database's top-level network.
   */
  static getInstanceFromObject(
    owner: AcDbObject,
    createIfDoesNotExist = false,
    addToTopLevelNetwork = true,
    dictionaryKey = ACDB_ASSOC_NETWORK_KEY
  ): AcDbAssocNetwork | undefined {
    const db = owner.database
    if (!db) return undefined
    let extId = owner.extensionDictionary
    if (!extId && !createIfDoesNotExist) return undefined
    extId ??= owner.createExtensionDictionary()
    const ext = extId ? db.getObjectById(extId) : undefined
    if (!(ext instanceof AcDbDictionary)) return undefined

    const created = AcDbAssocNetwork.getOrCreateInDictionary(
      db,
      ext,
      dictionaryKey,
      createIfDoesNotExist
    )
    if (created?.isNew && addToTopLevelNetwork) {
      const top = AcDbAssocNetwork.getInstanceFromDatabase(db, true)
      if (top && top !== created.network) {
        top.addAction(created.network, false)
      }
    }
    return created?.network
  }

  /**
   * Returns the database's top-level network
   * (ObjectARX `AcDbAssocNetwork::getInstanceFromDatabase`).
   */
  static getInstanceFromDatabase(
    db: AcDbDatabase,
    createIfDoesNotExist = false,
    dictionaryKey = ACDB_ASSOC_NETWORK_KEY
  ): AcDbAssocNetwork | undefined {
    return AcDbAssocNetwork.getOrCreateInDictionary(
      db,
      db.objects.dictionary,
      dictionaryKey,
      createIfDoesNotExist
    )?.network
  }

  private static getOrCreateInDictionary(
    db: AcDbDatabase,
    parent: AcDbDictionary,
    key: string,
    create: boolean
  ): { network: AcDbAssocNetwork; isNew: boolean } | undefined {
    let container = parent.getAt(key)
    if (container instanceof AcDbAssocNetwork) {
      return { network: container, isNew: false }
    }
    if (!(container instanceof AcDbDictionary)) {
      if (!create) return undefined
      const dict = new AcDbDictionary(db)
      parent.setAt(key, dict)
      container = dict
    }
    const dict = container as AcDbDictionary
    const existing = dict.getAt(key)
    if (existing instanceof AcDbAssocNetwork) {
      return { network: existing, isNew: false }
    }
    if (!create) return undefined
    const network = new AcDbAssocNetwork()
    dict.setAt(key, network)
    return { network, isNew: true }
  }

  /**
   * Adds an action to this network (ObjectARX `addAction`).
   *
   * @param action - The action (or its id when already resident).
   * @param alsoSetAsDatabaseOwner - Own the action (DXF 360). Pass `false`
   *   for an action owned elsewhere, e.g. a space network referenced by the
   *   top-level network.
   */
  addAction(
    action: AcDbAssocAction | AcDbObjectId,
    alsoSetAsDatabaseOwner = true
  ): void {
    const db = this.database
    const obj = typeof action === 'string' ? db?.getObjectById(action) : action
    const id = typeof action === 'string' ? action : action.objectId
    if (obj instanceof AcDbAssocAction) {
      if (alsoSetAsDatabaseOwner && db) acdbAssocAddOwnedObject(db, this, obj)
      obj.owningNetworkId = this.objectId
      this._maxActionIndex += 1
      obj.actionIndex = this._maxActionIndex
    }
    const actionId = obj?.objectId ?? id
    if (!actionId || this._actions.some(ref => ref.id === actionId)) return
    this._actions.push({ id: actionId, isOwned: alsoSetAsDatabaseOwner })
  }

  /**
   * Removes an action (ObjectARX `removeAction`).
   *
   * @param alsoEraseIt - Also erase the action with its body and owned
   *   dependencies.
   */
  removeAction(actionId: AcDbObjectId, alsoEraseIt = false): void {
    this._actions = this._actions.filter(ref => ref.id !== actionId)
    this._ownedActionIds = this._ownedActionIds.filter(id => id !== actionId)
    if (!alsoEraseIt) return
    const db = this.database
    const action = db?.getObjectById(actionId)
    if (action instanceof AcDbAssocAction) {
      action.owningNetworkId = ''
      action.eraseAction()
    } else if (db) {
      acdbAssocEraseObject(db, action)
    }
  }

  /** Actions of this network that are resident (ObjectARX `getActions`). */
  actions(db?: AcDbDatabase): AcDbAssocAction[] {
    const database = db ?? this.database
    if (!database) return []
    const result: AcDbAssocAction[] = []
    for (const { id } of this._actions) {
      const obj = database.getObjectById(id)
      if (obj instanceof AcDbAssocAction) result.push(obj)
    }
    return result
  }

  /** Alias of {@link actions} matching ObjectARX naming. */
  getActions(db?: AcDbDatabase): AcDbAssocAction[] {
    return this.actions(db)
  }

  /**
   * Evaluates owned actions that need evaluation (depth-first for nested
   * networks).
   */
  override evaluate(): void {
    const database = this.database
    if (!database) {
      this.status = AcDbAssocStatus.FailedToEvaluateAssocStatus
      return
    }

    let failed = false
    for (const action of this.actions(database)) {
      if (action.isOrphaned) continue
      if (action instanceof AcDbAssocNetwork) {
        action.evaluate()
        if (action.status === AcDbAssocStatus.FailedToEvaluateAssocStatus) {
          failed = true
        }
        continue
      }
      // Propagate dirty dependencies onto the action.
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

  override getHardOwnedObjectIds(): AcDbObjectId[] {
    const ids = super.getHardOwnedObjectIds()
    const db = this.database
    for (const ref of this._actions) {
      if (!ref.isOwned) continue
      // Actions whose driven objects were erased are not exported.
      const action = db?.getObjectById(ref.id)
      if (action instanceof AcDbAssocAction && action.isOrphaned) continue
      ids.push(ref.id)
    }
    return ids
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbAssocNetwork')
    filer.writeInt32(90, this._networkClassVersion)
    filer.writeInt32(90, this._maxActionIndex)
    const actions = this._actions.filter(ref => filer.isObjectIdWritten(ref.id))
    filer.writeInt32(90, actions.length)
    for (const ref of actions) {
      filer.writeObjectId(ref.isOwned ? 360 : 330, ref.id)
    }
    const owned = this._ownedActionIds.filter(id => filer.isObjectIdWritten(id))
    filer.writeInt32(90, owned.length)
    for (const id of owned) filer.writeObjectId(330, id)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    const c = AcDbAssocDxfCursor.read(filer, 'AcDbAssocNetwork')
    this._networkClassVersion = c.int()
    this._maxActionIndex = c.int()
    const count = c.int()
    this._actions = []
    for (let i = 0; i < count; i++) {
      const ref = c.idWithCode()
      if (!ref) break
      if (ref.id) this._actions.push({ id: ref.id, isOwned: ref.code === 360 })
    }
    const ownedCount = c.int()
    this._ownedActionIds = []
    for (let i = 0; i < ownedCount; i++) {
      const ref = c.idWithCode()
      if (!ref) break
      if (ref.id) this._ownedActionIds.push(ref.id)
    }
    return this
  }

  /**
   * Restores network fields decoded from a DWG record.
   *
   * @internal
   */
  setNetworkFromDwg(data: {
    networkClassVersion: number
    maxActionIndex: number
    actions: { id: AcDbObjectId; isOwned: boolean }[]
    ownedActionIds: AcDbObjectId[]
  }): void {
    this._networkClassVersion = data.networkClassVersion
    this._maxActionIndex = data.maxActionIndex
    this._actions = data.actions.filter(ref => ref.id)
    this._ownedActionIds = data.ownedActionIds.filter(id => id)
  }
}
