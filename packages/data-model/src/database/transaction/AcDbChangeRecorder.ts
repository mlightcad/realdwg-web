import { AcDbObject } from '../../base/index.js'
import { AcDbDatabase } from '../AcDbDatabase.js'
import { AcDbSysVarManager } from '../AcDbSysVarManager.js'
import {
  AcDbChangeContainer,
  AcDbDatabaseChange
} from './AcDbDatabaseChange.js'

type AcDbStructuralChange = Extract<
  AcDbDatabaseChange,
  { kind: 'append' | 'remove' }
>

/**
 * Builds a lookup key that is equal for two structural changes exactly when
 * their kind, container (see `acdbAreChangeContainersEqual`) and object ID
 * all match.
 */
function structuralKey(
  kind: AcDbStructuralChange['kind'],
  container: AcDbChangeContainer,
  objectId: string
): string {
  let location: string
  switch (container.type) {
    case 'blockTableRecord':
      location = container.ownerId
      break
    case 'symbolTable':
      location = container.tableName
      break
    case 'dictionary':
      location = `${container.dictionaryId}\u0000${container.key}`
      break
  }
  return `${kind}\u0000${container.type}\u0000${location}\u0000${objectId}`
}

/**
 * Accumulates structured database changes during an active transaction.
 *
 * Append/remove pairs that cancel within the same transaction are coalesced,
 * and duplicate modify/sysvar entries for the same target are ignored.
 *
 * Lookups go through indexes rather than scanning {@link getChanges}, so
 * recording stays linear for transactions with hundreds of thousands of
 * changes (for example a large file import).
 */
export class AcDbChangeRecorder {
  private readonly changes: AcDbDatabaseChange[] = []
  /** First modify entry per object ID. */
  private readonly modifyById = new Map<string, AcDbDatabaseChange>()
  /** First sysvar entry per normalized variable name. */
  private readonly sysvarByName = new Map<string, AcDbDatabaseChange>()
  /** Live structural entries per {@link structuralKey}, oldest first. */
  private readonly structuralByKey = new Map<string, AcDbStructuralChange[]>()
  /**
   * Entries cancelled since the last compaction. Removing them from
   * {@link changes} one `splice` at a time would be quadratic, so they are
   * dropped in one pass by {@link getChanges}.
   */
  private readonly cancelled = new Set<AcDbDatabaseChange>()

  /**
   * Returns the changes recorded so far in this transaction.
   *
   * The returned array is the internal store; callers should treat it as read-only.
   */
  getChanges(): AcDbDatabaseChange[] {
    this.compact()
    return this.changes
  }

  /**
   * Discards all recorded changes without applying them.
   */
  clear(): void {
    this.changes.length = 0
    this.modifyById.clear()
    this.sysvarByName.clear()
    this.structuralByKey.clear()
    this.cancelled.clear()
  }

  /**
   * Merges changes from a nested transaction into this recorder.
   *
   * Used when an inner transaction commits into its parent without touching
   * the undo stack.
   *
   * @param other - Recorder from a child transaction being committed
   */
  mergeFrom(other: AcDbChangeRecorder): void {
    for (const change of other.getChanges()) {
      this.mergeChange(change)
    }
  }

  /**
   * Records the pre-modification snapshot of an opened-for-write object.
   *
   * Only the first modify entry per {@link AcDbObject.objectId} is kept.
   *
   * @param object - Object whose state should be restorable on abort/undo
   */
  recordModify(object: AcDbObject): void {
    const objectId = object.objectId
    if (this.modifyById.has(objectId)) {
      return
    }
    this.addModify({
      kind: 'modify',
      objectId,
      before: object.clonePreservingIdentity()
    })
  }

  /**
   * Returns true when a modify entry exists for the given object ID.
   *
   * Used by {@link AcDbDatabaseTransactionManager.isOpenedForWriteInTransaction}
   * to determine whether a symbol table record was opened for write within the
   * active transaction stack.
   *
   * @param objectId - Object identifier to look up
   */
  hasModify(objectId: string): boolean {
    return this.modifyById.has(objectId)
  }

  /**
   * Records insertion of an object into a database container.
   *
   * If a matching remove was recorded earlier in the same transaction,
   * the pair cancels and neither change is retained.
   *
   * @param container - Container that received the object
   * @param object - Object that was appended; stored as an identity-preserving clone
   */
  recordAppend(container: AcDbChangeContainer, object: AcDbObject): void {
    this.recordStructuralChange({
      kind: 'append',
      container,
      object: object.clonePreservingIdentity()
    })
  }

  /**
   * Records removal of an object from a database container.
   *
   * If a matching append was recorded earlier in the same transaction,
   * the pair cancels and neither change is retained.
   *
   * @param container - Container that owned the removed object
   * @param object - Object that was removed; stored as an identity-preserving clone
   */
  recordRemove(container: AcDbChangeContainer, object: AcDbObject): void {
    this.recordStructuralChange({
      kind: 'remove',
      container,
      object: object.clonePreservingIdentity()
    })
  }

  /**
   * Records the value of a system variable before mutation.
   *
   * Only the first sysvar entry per normalized name is kept.
   *
   * @param name - System variable name (case-insensitive)
   * @param before - Value observed before the mutation
   */
  recordSysvar(name: string, before: unknown): void {
    const normalizedName = name.toLowerCase()
    if (this.sysvarByName.has(normalizedName)) {
      return
    }
    this.addSysvar({
      kind: 'sysvar',
      name: normalizedName,
      before
    })
  }

  /**
   * Captures the post-change state for modify and sysvar entries at commit time.
   *
   * Append/remove entries are complete when recorded and do not require
   * finalization.
   *
   * @param database - Database used to read live post-commit values
   */
  finalize(database: AcDbDatabase): void {
    for (const change of this.getChanges()) {
      if (change.kind === 'modify') {
        const object = database.getObjectById(change.objectId)
        if (object) {
          change.after = object.clonePreservingIdentity()
        }
      } else if (change.kind === 'sysvar') {
        change.after = this.getSysvarValue(database, change.name)
      }
    }
  }

  /**
   * Records or coalesces one append/remove change.
   *
   * When an opposite structural change for the same container and object ID
   * already exists in this transaction, both entries cancel and neither is kept.
   * The oldest matching entry is the one cancelled.
   *
   * @param change - Append or remove entry to merge into the recorder
   */
  private recordStructuralChange(change: AcDbStructuralChange): void {
    const objectId = change.object.objectId
    const oppositeKind = change.kind === 'append' ? 'remove' : 'append'
    const oppositeKey = structuralKey(oppositeKind, change.container, objectId)
    const opposites = this.structuralByKey.get(oppositeKey)
    if (opposites && opposites.length > 0) {
      const cancelled = opposites.shift()!
      if (opposites.length === 0) {
        this.structuralByKey.delete(oppositeKey)
      }
      this.cancelled.add(cancelled)
      return
    }

    const key = structuralKey(change.kind, change.container, objectId)
    const entries = this.structuralByKey.get(key)
    if (entries) {
      entries.push(change)
    } else {
      this.structuralByKey.set(key, [change])
    }
    this.changes.push(change)
  }

  /**
   * Merges one change from a nested transaction into this recorder.
   *
   * Modify and sysvar entries deduplicate by object ID or variable name;
   * structural entries use the same cancel/coalesce rules as {@link recordAppend}.
   *
   * @param change - Change copied from a child transaction recorder
   */
  private mergeChange(change: AcDbDatabaseChange): void {
    if (change.kind === 'modify') {
      if (!this.modifyById.has(change.objectId)) {
        this.addModify(change)
      }
      return
    }

    if (change.kind === 'sysvar') {
      if (!this.sysvarByName.has(change.name)) {
        this.addSysvar(change)
      }
      return
    }

    this.recordStructuralChange(change)
  }

  private addModify(change: AcDbDatabaseChange & { kind: 'modify' }) {
    this.modifyById.set(change.objectId, change)
    this.changes.push(change)
  }

  private addSysvar(change: AcDbDatabaseChange & { kind: 'sysvar' }) {
    this.sysvarByName.set(change.name, change)
    this.changes.push(change)
  }

  /** Drops cancelled entries from {@link changes}, keeping order. */
  private compact(): void {
    if (this.cancelled.size === 0) {
      return
    }
    let write = 0
    for (const change of this.changes) {
      if (!this.cancelled.has(change)) {
        this.changes[write++] = change
      }
    }
    this.changes.length = write
    this.cancelled.clear()
  }

  /**
   * Reads the current value of a system variable from the database.
   *
   * @param database - Database passed to {@link AcDbSysVarManager.getVar}
   * @param name - Normalized system variable name
   * @returns Live variable value used to populate `after` during {@link finalize}
   */
  private getSysvarValue(database: AcDbDatabase, name: string): unknown {
    return AcDbSysVarManager.instance().getVar(name, database)
  }
}
