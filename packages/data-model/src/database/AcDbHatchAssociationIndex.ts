import {
  type AcDbObjectId,
  TEMP_OBJECT_ID_PREFIX
} from '../base/AcDbObject.js'
import type { AcDbEntity } from '../entity/AcDbEntity.js'
import { AcDbHatch } from '../entity/AcDbHatch.js'
import type { AcDbDatabase } from './AcDbDatabase.js'

function isTemporaryObjectId(id: AcDbObjectId | undefined): boolean {
  return !!id && id.startsWith(TEMP_OBJECT_ID_PREFIX)
}

/**
 * Reverse index from boundary entity id → associative hatch ids, plus
 * post-commit listeners that rebuild hatch loops when a source boundary
 * is modified and disassociate when a source is erased.
 *
 * Soft-pointers live on {@link AcDbHatch} (DXF 97/330). This index only
 * accelerates lookup and drives live association updates.
 */
export class AcDbHatchAssociationIndex {
  private readonly _db: AcDbDatabase
  /** boundaryId → hatchIds that reference it */
  private readonly _boundaryToHatches = new Map<AcDbObjectId, Set<AcDbObjectId>>()
  /** hatchId → boundaryIds currently registered for that hatch */
  private readonly _hatchToBoundaries = new Map<AcDbObjectId, Set<AcDbObjectId>>()
  private _listenersAttached = false
  /** Avoid re-entrant rebuild while a hatch is being rewritten from a boundary edit. */
  private readonly _rebuilding = new Set<AcDbObjectId>()

  constructor(db: AcDbDatabase) {
    this._db = db
  }

  /**
   * Ensures database entity events are wired. Safe to call repeatedly.
   */
  attachListeners() {
    if (this._listenersAttached) return
    this._listenersAttached = true
    this._db.events.entityAppended.addEventListener(args => {
      const entities = Array.isArray(args.entity) ? args.entity : [args.entity]
      for (const entity of entities) {
        if (entity instanceof AcDbHatch) {
          this.refresh(entity)
        }
      }
    })
    this._db.events.entityModified.addEventListener(args => {
      const entities = Array.isArray(args.entity) ? args.entity : [args.entity]
      for (const entity of entities) {
        this.onEntityModified(entity)
      }
    })
    this._db.events.entityErased.addEventListener(args => {
      const entities = Array.isArray(args.entity) ? args.entity : [args.entity]
      for (const entity of entities) {
        this.onEntityErased(entity)
      }
    })
  }

  /**
   * Rebuilds the reverse map for every hatch currently in model/paper space.
   * Call after a full database load.
   */
  rebuildIndex() {
    this._boundaryToHatches.clear()
    this._hatchToBoundaries.clear()
    this.attachListeners()
    const blockTable = this._db.tables.blockTable
    for (const btr of blockTable.newIterator()) {
      for (const entity of btr.newIterator()) {
        if (entity instanceof AcDbHatch) {
          this.refresh(entity)
        }
      }
    }
  }

  /**
   * Registers (or re-registers) an associative hatch's source boundary ids.
   * Skips write-transaction clones (temporary object ids).
   */
  refresh(hatch: AcDbHatch) {
    this.attachListeners()
    const hatchId = hatch.objectId
    if (!hatchId || isTemporaryObjectId(hatchId)) return

    this.unregister(hatchId)

    if (!hatch.associative) return

    const boundaryIds = new Set<AcDbObjectId>()
    for (const sources of hatch.allPathSourceIds) {
      for (const id of sources) {
        if (!id || isTemporaryObjectId(id)) continue
        boundaryIds.add(id)
        let set = this._boundaryToHatches.get(id)
        if (!set) {
          set = new Set()
          this._boundaryToHatches.set(id, set)
        }
        set.add(hatchId)
      }
    }

    if (boundaryIds.size > 0) {
      this._hatchToBoundaries.set(hatchId, boundaryIds)
    }
  }

  /**
   * Removes a hatch from the reverse index.
   */
  unregister(hatchId: AcDbObjectId) {
    const previous = this._hatchToBoundaries.get(hatchId)
    if (previous) {
      for (const boundaryId of previous) {
        const set = this._boundaryToHatches.get(boundaryId)
        if (!set) continue
        set.delete(hatchId)
        if (set.size === 0) {
          this._boundaryToHatches.delete(boundaryId)
        }
      }
      this._hatchToBoundaries.delete(hatchId)
    }
  }

  /**
   * Returns hatch object ids that list `boundaryId` among their path sources.
   */
  hatchesForBoundary(boundaryId: AcDbObjectId): ReadonlyArray<AcDbObjectId> {
    const set = this._boundaryToHatches.get(boundaryId)
    return set ? Array.from(set) : []
  }

  /**
   * Returns every boundary id currently linked to `hatchId`.
   */
  boundariesForHatch(hatchId: AcDbObjectId): ReadonlyArray<AcDbObjectId> {
    const set = this._hatchToBoundaries.get(hatchId)
    return set ? Array.from(set) : []
  }

  private onEntityModified(entity: AcDbEntity) {
    if (entity instanceof AcDbHatch) {
      if (this._rebuilding.has(entity.objectId)) return
      this.refresh(entity)
      return
    }

    const hatchIds = this.hatchesForBoundary(entity.objectId)
    if (hatchIds.length === 0) return

    for (const hatchId of hatchIds) {
      this.rebuildHatch(hatchId)
    }
  }

  private onEntityErased(entity: AcDbEntity) {
    if (entity instanceof AcDbHatch) {
      this.unregister(entity.objectId)
      return
    }

    const hatchIds = this.hatchesForBoundary(entity.objectId)
    if (hatchIds.length === 0) return

    const erasedId = entity.objectId
    for (const hatchId of hatchIds) {
      this.disassociateBoundary(hatchId, erasedId)
    }
  }

  private rebuildHatch(hatchId: AcDbObjectId) {
    if (!hatchId || isTemporaryObjectId(hatchId)) return
    if (this._rebuilding.has(hatchId)) return
    // Defer past the boundary's commit dispatch so we do not nest
    // openEntityForWrite inside an in-flight transaction commit.
    queueMicrotask(() => this.runRebuildHatch(hatchId))
  }

  private runRebuildHatch(hatchId: AcDbObjectId) {
    if (this._rebuilding.has(hatchId)) return
    if (!this._db.getObjectById(hatchId)) {
      this.unregister(hatchId)
      return
    }
    this._rebuilding.add(hatchId)
    try {
      this._db.runDatabaseEdit('hatch-assoc-rebuild', () => {
        const hatch = this._db.openEntityForWrite(hatchId)
        if (!(hatch instanceof AcDbHatch)) return
        hatch.rebuildLoopsFromSources()
      })
    } finally {
      this._rebuilding.delete(hatchId)
    }
  }

  private disassociateBoundary(hatchId: AcDbObjectId, boundaryId: AcDbObjectId) {
    if (!hatchId || isTemporaryObjectId(hatchId)) return
    if (this._rebuilding.has(hatchId)) return
    queueMicrotask(() => this.runDisassociateBoundary(hatchId, boundaryId))
  }

  private runDisassociateBoundary(
    hatchId: AcDbObjectId,
    boundaryId: AcDbObjectId
  ) {
    if (this._rebuilding.has(hatchId)) return
    if (!this._db.getObjectById(hatchId)) {
      this.unregister(hatchId)
      return
    }
    this._rebuilding.add(hatchId)
    try {
      this._db.runDatabaseEdit('hatch-assoc-erase-boundary', () => {
        const hatch = this._db.openEntityForWrite(hatchId)
        if (!(hatch instanceof AcDbHatch)) return
        hatch.removePathSourceId(boundaryId)
        // Keep last geometry; rebuild only when other sources remain.
        if (hatch.associative && hatch.hasAnyPathSourceIds()) {
          hatch.rebuildLoopsFromSources()
        }
      })
    } finally {
      this._rebuilding.delete(hatchId)
      const hatch = this._db.getObjectById(hatchId)
      if (hatch instanceof AcDbHatch) {
        this.refresh(hatch)
      } else {
        this.unregister(hatchId)
      }
    }
  }
}
