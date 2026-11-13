import type { AcDbDatabase } from '../database/AcDbDatabase.js'
import { AcDbDuplicateRecordCloning } from './AcDbDuplicateRecordCloning.js'
import type { AcDbObjectId } from './AcDbObject.js'

/**
 * Context of a deep-clone operation.
 *
 * @remarks
 * Mirrors `AcDb::DeepCloneType` in ObjectARX (same numeric values).
 */
export enum AcDbDeepCloneType {
  /** Not cloning */
  kDcNone = -1,
  /** COPY and similar same-database copies */
  kDcCopy = 0,
  /** EXPLODE */
  kDcExplode = 1,
  /** BLOCK (create a block definition) */
  kDcBlock = 2,
  /** XREF BIND */
  kDcXrefBind = 3,
  /** Symbol table merge */
  kDcSymTableMerge = 4,
  /** INSERT of a whole drawing */
  kDcInsert = 6,
  /** WBLOCK of a whole drawing */
  kDcWblock = 7,
  /** `deepCloneObjects()` */
  kDcObjects = 8,
  /** XREF insert */
  kDcXrefInsert = 9,
  /** INSERT copy */
  kDcInsertCopy = 10,
  /** `wblockCloneObjects()` */
  kDcWblkObjects = 11
}

/**
 * One source-to-destination object mapping recorded while cloning.
 *
 * @remarks
 * Mirrors `AcDbIdPair` in ObjectARX.
 */
export interface AcDbIdPair {
  /** Object id in the source database */
  key: AcDbObjectId
  /** Object id in the destination database */
  value: AcDbObjectId
  /** True when a new object was created; false when an existing one was reused */
  isCloned: boolean
  /** True when the object was one of the objects explicitly asked to be cloned */
  isPrimary: boolean
  /** True when the owner of the cloned object has already been translated */
  isOwnerXlated: boolean
}

/**
 * Kinds of named records that entities and records reference by name.
 *
 * Most references in this data model are stored by name (layer, linetype,
 * text style, ...) instead of by object id, so cloning has to translate names
 * as well as ids.
 */
export type AcDbCloneRecordKind =
  | 'linetype'
  | 'textStyle'
  | 'layer'
  | 'block'
  | 'dimStyle'
  | 'mlineStyle'
  | 'mleaderStyle'

/**
 * Collector of the records and objects one object depends on.
 *
 * Filled by {@link AcDbObject.collectCloneDependencies} so that a clone can
 * bring every symbol table record, block definition and style it needs into
 * the destination database.
 */
export class AcDbCloneDependencies {
  private _names = new Map<AcDbCloneRecordKind, Set<string>>()
  private _ids = new Set<AcDbObjectId>()

  /**
   * Adds a named record dependency. Empty names are ignored.
   *
   * @param kind - Table or dictionary the record lives in.
   * @param name - Record name as stored on the referencing object.
   */
  addName(kind: AcDbCloneRecordKind, name: string | null | undefined) {
    if (!name) return
    let names = this._names.get(kind)
    if (!names) {
      names = new Set()
      this._names.set(kind, names)
    }
    names.add(name)
  }

  /**
   * Adds an object id dependency (style objects, image definitions, ...).
   * Empty ids are ignored.
   *
   * @param id - Object id in the source database.
   */
  addId(id: AcDbObjectId | null | undefined) {
    if (id) this._ids.add(id)
  }

  /**
   * Returns the names collected for one record kind.
   *
   * @param kind - Table or dictionary kind.
   */
  names(kind: AcDbCloneRecordKind): string[] {
    return Array.from(this._names.get(kind) ?? [])
  }

  /** Returns every collected object id. */
  ids(): AcDbObjectId[] {
    return Array.from(this._ids)
  }

  /** Removes every collected dependency. */
  clear() {
    this._names.clear()
    this._ids.clear()
  }
}

/**
 * Records the source-to-destination translation of objects and record names
 * during a deep clone or wblock clone.
 *
 * @remarks
 * Mirrors `AcDbIdMapping` in ObjectARX. In addition to id pairs it keeps a
 * per-kind name map, because entities in this data model reference layers,
 * linetypes, styles and blocks by name.
 *
 * @example
 * ```typescript
 * const idMap = new AcDbIdMapping()
 * idMap.destDb = targetDb
 * sourceDb.wblockCloneObjects(ids, targetDb.tables.blockTable.modelSpace.objectId, idMap, AcDbDuplicateRecordCloning.Ignore)
 * for (const pair of idMap) console.log(pair.key, '->', pair.value)
 * ```
 */
export class AcDbIdMapping {
  /** Source database of the clone operation */
  sourceDb?: AcDbDatabase
  /** Destination database of the clone operation */
  destDb?: AcDbDatabase
  /** Context of the clone operation */
  deepCloneContext: AcDbDeepCloneType
  /** How records with a name already used in the destination are handled */
  duplicateRecordCloning: AcDbDuplicateRecordCloning

  private _pairs = new Map<AcDbObjectId, AcDbIdPair>()
  private _names = new Map<AcDbCloneRecordKind, Map<string, string>>()

  /**
   * Creates an id mapping.
   *
   * @param destDb - Destination database, required for cross-database clones.
   * @param deepCloneContext - Context of the clone operation.
   * @param duplicateRecordCloning - Duplicate record handling.
   */
  constructor(
    destDb?: AcDbDatabase,
    deepCloneContext: AcDbDeepCloneType = AcDbDeepCloneType.kDcNone,
    duplicateRecordCloning: AcDbDuplicateRecordCloning = AcDbDuplicateRecordCloning.NotApplicable
  ) {
    this.destDb = destDb
    this.deepCloneContext = deepCloneContext
    this.duplicateRecordCloning = duplicateRecordCloning
  }

  /** Number of id pairs in the mapping. */
  get size() {
    return this._pairs.size
  }

  /**
   * Adds or replaces the pair for `pair.key`.
   *
   * @param pair - Pair to record.
   */
  assign(pair: AcDbIdPair) {
    this._pairs.set(pair.key, { ...pair })
  }

  /**
   * Finds the pair recorded for a source object id.
   *
   * @param key - Object id in the source database.
   * @returns The pair, or `undefined` when the id was not cloned.
   */
  lookup(key: AcDbObjectId): AcDbIdPair | undefined {
    return this._pairs.get(key)
  }

  /**
   * Translates a source object id into the destination id.
   *
   * @param key - Object id in the source database.
   * @returns The destination id, or `undefined` when the id was not cloned.
   */
  translateId(key: AcDbObjectId | null | undefined) {
    return key ? this._pairs.get(key)?.value : undefined
  }

  /**
   * Translates an object id held by a clone.
   *
   * Returns the destination id when the object was cloned or mapped onto an
   * existing destination object. Otherwise the id is kept when cloning within
   * one database, and dropped when cloning into another database, where the
   * source id could name an unrelated object.
   *
   * @param key - Object id in the source database.
   * @returns The id to store on the clone, or `undefined` to drop it.
   */
  translateReferenceId(key: AcDbObjectId | null | undefined) {
    if (!key) return undefined
    const value = this._pairs.get(key)?.value
    if (value) return value
    return this.sourceDb != null && this.sourceDb === this.destDb
      ? key
      : undefined
  }

  /**
   * Removes the pair recorded for a source object id.
   *
   * @param key - Object id in the source database.
   * @returns True when a pair was removed.
   */
  del(key: AcDbObjectId) {
    return this._pairs.delete(key)
  }

  /**
   * Records the destination name of a named record.
   *
   * @param kind - Table or dictionary kind.
   * @param sourceName - Name in the source database.
   * @param destName - Name in the destination database.
   */
  assignName(kind: AcDbCloneRecordKind, sourceName: string, destName: string) {
    let names = this._names.get(kind)
    if (!names) {
      names = new Map()
      this._names.set(kind, names)
    }
    names.set(sourceName.toUpperCase(), destName)
  }

  /**
   * Returns true when a destination name was recorded for `sourceName`.
   *
   * @param kind - Table or dictionary kind.
   * @param sourceName - Name in the source database.
   */
  hasName(kind: AcDbCloneRecordKind, sourceName: string) {
    return !!this._names.get(kind)?.has(sourceName.toUpperCase())
  }

  /**
   * Translates a record name from the source to the destination database.
   *
   * Names that were not remapped (including names that were not cloned at
   * all) are returned unchanged.
   *
   * @param kind - Table or dictionary kind.
   * @param sourceName - Name in the source database.
   */
  translateName<T extends string | null | undefined>(
    kind: AcDbCloneRecordKind,
    sourceName: T
  ): T {
    if (!sourceName) return sourceName
    const mapped = this._names.get(kind)?.get(sourceName.toUpperCase())
    return (mapped ?? sourceName) as T
  }

  /** Iterates over all recorded pairs. */
  newIterator(): IterableIterator<AcDbIdPair> {
    return this._pairs.values()
  }

  [Symbol.iterator](): IterableIterator<AcDbIdPair> {
    return this._pairs.values()
  }
}
