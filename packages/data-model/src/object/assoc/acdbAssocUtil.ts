import type { AcDbObject, AcDbObjectId } from '../../base/AcDbObject.js'
import type { AcDbDatabase } from '../../database/AcDbDatabase.js'

/**
 * Makes `object` database-resident and hard-owned by `owner` through a
 * pointer that is not a dictionary entry (e.g. an action owned by a network,
 * a dependency owned by an action). Commits a real handle.
 */
export function acdbAssocAddOwnedObject(
  db: AcDbDatabase,
  owner: AcDbObject,
  object: AcDbObject
): AcDbObjectId {
  object.database = db
  db.commitObjectHandle(object)
  object.ownerId = owner.objectId
  return object.objectId
}

/**
 * Removes a non-dictionary-owned associative object from the handle registry
 * so it is no longer resolvable nor exported.
 */
export function acdbAssocEraseObject(
  db: AcDbDatabase,
  object: AcDbObject | undefined
): void {
  if (!object) return
  db.releaseObjectHandle(object)
}
