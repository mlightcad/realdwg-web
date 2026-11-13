import type { AcGeMatrix3d } from '@mlightcad/geometry-engine'

import { AcDbDuplicateRecordCloning } from '../base/AcDbDuplicateRecordCloning.js'
import {
  AcDbCloneDependencies,
  AcDbCloneRecordKind,
  AcDbDeepCloneType,
  AcDbIdMapping
} from '../base/AcDbIdMapping.js'
import type { AcDbObject, AcDbObjectId } from '../base/AcDbObject.js'
import { AcDbEntity } from '../entity/AcDbEntity.js'
import type { AcDbDictionary } from '../object/AcDbDictionary.js'
import { AcDbBlockTableRecord } from './AcDbBlockTableRecord.js'
import type { AcDbDatabase } from './AcDbDatabase.js'
import type { AcDbSymbolTable } from './AcDbSymbolTable.js'
import type { AcDbSymbolTableRecord } from './AcDbSymbolTableRecord.js'

/** Record kinds stored in symbol tables. */
type TableKind = 'linetype' | 'textStyle' | 'layer' | 'block' | 'dimStyle'
/** Record kinds stored in named-object dictionaries. */
type DictKind = 'mlineStyle' | 'mleaderStyle' | 'imageDefinition'
type RefKind = TableKind | DictKind

const TABLE_KINDS: TableKind[] = [
  'linetype',
  'textStyle',
  'layer',
  'block',
  'dimStyle'
]
const DICT_KINDS: DictKind[] = ['mlineStyle', 'mleaderStyle', 'imageDefinition']

/**
 * Order in which dependencies are cloned. Records referenced by other records
 * come first, although name translation does not strictly need it because
 * every destination name is decided while dependencies are collected, before
 * anything is cloned.
 */
const CLONE_ORDER: RefKind[] = [
  'linetype',
  'textStyle',
  'layer',
  'block',
  'dimStyle',
  'mlineStyle',
  'mleaderStyle',
  'imageDefinition'
]

/** Source record or dictionary object that a cloned object depends on. */
interface DependencyRef {
  kind: RefKind
  /** Record name, or dictionary key for dictionary objects. */
  name: string
  source: AcDbObject
  /** Destination name chosen by {@link AcDbDatabaseCloner.planRecord}. */
  destName?: string
  /** Existing destination object that is reused instead of cloned. */
  reuse?: AcDbObject
  /** Existing destination object whose contents are replaced. */
  replace?: AcDbObject
  /** Destination clone, once created. */
  clone?: AcDbObject
}

function tableOf(db: AcDbDatabase, kind: TableKind) {
  const tables = db.tables
  switch (kind) {
    case 'linetype':
      return tables.linetypeTable as unknown as AcDbSymbolTable
    case 'textStyle':
      return tables.textStyleTable as unknown as AcDbSymbolTable
    case 'layer':
      return tables.layerTable as unknown as AcDbSymbolTable
    case 'block':
      return tables.blockTable as unknown as AcDbSymbolTable
    case 'dimStyle':
      return tables.dimStyleTable as unknown as AcDbSymbolTable
  }
}

function dictionaryOf(db: AcDbDatabase, kind: DictKind) {
  const objects = db.objects
  switch (kind) {
    case 'mlineStyle':
      return objects.mlineStyle as unknown as AcDbDictionary
    case 'mleaderStyle':
      return objects.mleaderStyle as unknown as AcDbDictionary
    case 'imageDefinition':
      return objects.imageDefinition as unknown as AcDbDictionary
  }
}

function isTableKind(kind: RefKind): kind is TableKind {
  return (TABLE_KINDS as string[]).includes(kind)
}

function isLayoutBlockName(name: string) {
  return (
    AcDbBlockTableRecord.isModelSapceName(name) ||
    AcDbBlockTableRecord.isPaperSapceName(name)
  )
}

/** Anonymous blocks (`*U12`, `*D3`, `*X1`, ...), excluding layout blocks. */
function anonymousBlockPrefix(name: string) {
  if (isLayoutBlockName(name)) return undefined
  const match = /^\*([A-Za-z]+)\d*$/.exec(name)
  return match ? `*${match[1].toUpperCase()}` : undefined
}

/**
 * Deep-clone engine behind {@link AcDbDatabase.deepCloneObjects},
 * {@link AcDbDatabase.wblockCloneObjects}, {@link AcDbDatabase.wblock} and
 * {@link AcDbDatabase.insert}.
 *
 * It follows the ObjectARX deep-clone phases:
 * 1. collect every record and object the primary objects depend on,
 *    transitively (layer → linetype, INSERT → block → nested blocks, ...);
 * 2. decide the destination name of each dependency as it is found, applying
 *    the duplicate record cloning rule (anonymous blocks always get a fresh
 *    name). Records that resolve to an existing destination record are not
 *    cloned, so their own dependencies are not collected either;
 * 3. clone the dependencies, block contents and primary objects, giving each
 *    entity clone its final handle;
 * 4. translate references held by the clones through the id mapping, then
 *    append them, which records undo.
 *
 * @internal
 */
export class AcDbDatabaseCloner {
  private readonly source: AcDbDatabase
  private readonly dest: AcDbDatabase
  private readonly idMap: AcDbIdMapping
  private readonly refs = new Map<string, DependencyRef>()
  private readonly reservedNames = new Map<RefKind, Set<string>>()
  /** Block table record that receives the primary clones. */
  private owner?: AcDbBlockTableRecord

  /**
   * @param source - Database that owns the objects to clone.
   * @param dest - Database that receives the clones.
   * @param idMap - Id mapping that records the translation.
   */
  constructor(source: AcDbDatabase, dest: AcDbDatabase, idMap: AcDbIdMapping) {
    this.source = source
    this.dest = dest
    this.idMap = idMap
    idMap.sourceDb ??= source
    idMap.destDb ??= dest
  }

  private get sameDatabase() {
    return this.source === this.dest
  }

  private get isWblock() {
    return (
      this.idMap.deepCloneContext === AcDbDeepCloneType.kDcWblock ||
      this.idMap.deepCloneContext === AcDbDeepCloneType.kDcWblkObjects
    )
  }

  /**
   * Clones `entities` and their dependencies, appends the clones to `owner`
   * and returns them in the same order.
   *
   * @param entities - Entities of the source database.
   * @param owner - Block table record of the destination database.
   * @param transform - Optional transform applied to the primary clones.
   */
  cloneEntities(
    entities: AcDbEntity[],
    owner: AcDbBlockTableRecord,
    transform?: AcGeMatrix3d
  ): AcDbEntity[] {
    this.owner = owner
    this.collectDependencies(entities)
    this.cloneRecords()

    const blockContents = this.cloneBlockContents()
    const clones = entities.map(entity => this.cloneEntity(entity, owner, true))

    for (const content of blockContents) {
      content.clones.forEach(clone =>
        clone.translateClonedReferences(this.idMap)
      )
    }
    clones.forEach(clone => clone.translateClonedReferences(this.idMap))
    if (transform) {
      clones.forEach(clone => clone.transformBy(transform))
    }

    for (const content of blockContents) {
      if (content.clones.length > 0) {
        content.owner.appendEntity(content.clones)
      }
    }
    if (clones.length > 0) {
      owner.appendEntity(clones)
    }
    return clones
  }

  // ---------------------------------------------------------------------------
  // Phase 1: dependency closure
  // ---------------------------------------------------------------------------

  private collectDependencies(entities: AcDbEntity[]) {
    let deps = new AcDbCloneDependencies()
    entities.forEach(entity => entity.collectCloneDependencies(deps))

    while (true) {
      const added = this.addDependencyRefs(deps).filter(ref => !ref.reuse)
      if (added.length === 0) break
      deps = new AcDbCloneDependencies()
      added.forEach(ref => ref.source.collectCloneDependencies(deps))
    }
  }

  /** Resolves collected names and ids into refs; returns the new ones. */
  private addDependencyRefs(deps: AcDbCloneDependencies): DependencyRef[] {
    const added: DependencyRef[] = []
    const add = (kind: RefKind, name: string, source: AcDbObject) => {
      const key = `${kind}:${name.toUpperCase()}`
      if (this.refs.has(key)) return
      const ref: DependencyRef = { kind, name, source }
      this.refs.set(key, ref)
      this.planRecord(ref)
      added.push(ref)
    }

    for (const kind of TABLE_KINDS) {
      for (const name of deps.names(kind)) {
        if (kind === 'block' && isLayoutBlockName(name)) continue
        const record = tableOf(this.source, kind).getAt(name)
        if (record) add(kind, record.name, record)
      }
    }
    for (const kind of ['mlineStyle', 'mleaderStyle'] as const) {
      for (const name of deps.names(kind)) {
        const object = dictionaryOf(this.source, kind).getAt(name)
        if (object) add(kind, name, object)
      }
    }
    for (const id of deps.ids()) {
      const resolved = this.resolveId(id)
      if (resolved) add(resolved.kind, resolved.name, resolved.source)
    }
    return added
  }

  /** Finds the table or dictionary that owns a referenced object id. */
  private resolveId(id: AcDbObjectId) {
    const object = this.source.getObjectById(id)
    if (!object) return undefined
    const ownerId = object.getAttrWithoutException('ownerId')

    for (const kind of TABLE_KINDS) {
      const table = tableOf(this.source, kind)
      if (ownerId === table.objectId) {
        const name = (object as AcDbSymbolTableRecord).name
        if (kind === 'block' && isLayoutBlockName(name)) return undefined
        return { kind: kind as RefKind, name, source: object }
      }
    }
    for (const kind of DICT_KINDS) {
      const dict = dictionaryOf(this.source, kind)
      if (ownerId !== dict.objectId) continue
      for (const [key, value] of dict.entries()) {
        if (value === object) {
          return { kind: kind as RefKind, name: key, source: object }
        }
      }
    }
    return undefined
  }

  // ---------------------------------------------------------------------------
  // Phase 2: destination names
  // ---------------------------------------------------------------------------

  private planRecord(ref: DependencyRef) {
    const anonymousPrefix =
      ref.kind === 'block' ? anonymousBlockPrefix(ref.name) : undefined

    if (anonymousPrefix) {
      // Anonymous blocks (dimension blocks, dynamic block representations)
      // belong to the entity that references them, so every copy gets its
      // own definition, as in AutoCAD.
      ref.destName = this.nextAnonymousName(anonymousPrefix)
    } else if (this.sameDatabase) {
      if (ref.source === this.owner) {
        throw new Error(`Block '${ref.name}' cannot reference itself.`)
      }
      ref.destName = ref.name
      ref.reuse = ref.source
    } else {
      const existing = this.lookupDest(ref.kind, ref.name)
      if (!existing) {
        ref.destName = ref.name
      } else if (existing === this.owner) {
        // Reusing the receiving block would make it reference itself.
        ref.destName = this.mangledName(ref.kind, ref.name)
      } else {
        this.planDuplicate(ref, existing)
      }
    }

    this.reserve(ref.kind, ref.destName!)
    this.assignRefName(ref)
  }

  private planDuplicate(ref: DependencyRef, existing: AcDbObject) {
    switch (this.idMap.duplicateRecordCloning) {
      case AcDbDuplicateRecordCloning.MangleName:
      case AcDbDuplicateRecordCloning.XrefMangleName:
        ref.destName = this.mangledName(ref.kind, ref.name)
        return
      case AcDbDuplicateRecordCloning.Replace:
        ref.destName = ref.name
        // Redefining a block would also have to replace its entities; keep
        // the destination definition, like Ignore.
        if (ref.kind === 'block') {
          ref.reuse = existing
        } else {
          ref.replace = existing
        }
        return
      default:
        // Ignore / NotApplicable: the destination definition wins.
        ref.destName = ref.name
        ref.reuse = existing
    }
  }

  private assignRefName(ref: DependencyRef) {
    if (ref.kind !== 'imageDefinition') {
      this.idMap.assignName(
        ref.kind as AcDbCloneRecordKind,
        ref.name,
        ref.destName!
      )
    }
    const target = ref.reuse ?? ref.replace
    if (target) {
      this.idMap.assign({
        key: ref.source.objectId,
        value: target.objectId,
        isCloned: false,
        isPrimary: false,
        isOwnerXlated: true
      })
    }
  }

  private orderedRefs() {
    const refs = Array.from(this.refs.values())
    return refs.sort(
      (a, b) => CLONE_ORDER.indexOf(a.kind) - CLONE_ORDER.indexOf(b.kind)
    )
  }

  private lookupDest(kind: RefKind, name: string): AcDbObject | undefined {
    if (isTableKind(kind)) {
      return tableOf(this.dest, kind).getAt(name)
    }
    return dictionaryOf(this.dest, kind).getAt(name)
  }

  private isNameTaken(kind: RefKind, name: string) {
    return (
      !!this.lookupDest(kind, name) ||
      !!this.reservedNames.get(kind)?.has(name.toUpperCase())
    )
  }

  private reserve(kind: RefKind, name: string) {
    let names = this.reservedNames.get(kind)
    if (!names) {
      names = new Set()
      this.reservedNames.set(kind, names)
    }
    names.add(name.toUpperCase())
  }

  /** `$0$name`, `$1$name`, ... as AutoCAD's MangleName does. */
  private mangledName(kind: RefKind, name: string) {
    for (let i = 0; ; i++) {
      const candidate = `$${i}$${name}`
      if (!this.isNameTaken(kind, candidate)) return candidate
    }
  }

  private nextAnonymousName(prefix: string) {
    let max = 0
    const pattern = new RegExp(`^\\${prefix}(\\d+)$`, 'i')
    const consider = (name: string) => {
      const match = pattern.exec(name)
      if (match) max = Math.max(max, Number(match[1]))
    }
    for (const record of this.dest.tables.blockTable.newIterator()) {
      consider(record.name)
    }
    this.reservedNames.get('block')?.forEach(consider)
    return `${prefix}${max + 1}`
  }

  // ---------------------------------------------------------------------------
  // Phase 3: clone dependencies
  // ---------------------------------------------------------------------------

  private cloneRecords() {
    for (const ref of this.orderedRefs()) {
      if (ref.reuse) continue

      const clone =
        ref.source instanceof AcDbBlockTableRecord
          ? ref.source.cloneEmptyRecord()
          : ref.source.clone()
      clone.extensionDictionary = undefined
      clone.database = this.dest
      if (isTableKind(ref.kind)) {
        const record = clone as AcDbSymbolTableRecord
        record.name = ref.destName!
        if (record instanceof AcDbBlockTableRecord) {
          record.layoutId = ''
        }
      }
      clone.translateClonedReferences(this.idMap)

      if (ref.replace) {
        this.replaceRecord(ref.replace, clone)
        continue
      }

      if (isTableKind(ref.kind)) {
        tableOf(this.dest, ref.kind).add(clone as AcDbSymbolTableRecord)
      } else {
        dictionaryOf(this.dest, ref.kind).setAt(ref.destName!, clone)
      }
      ref.clone = clone
      this.idMap.assign({
        key: ref.source.objectId,
        value: clone.objectId,
        isCloned: true,
        isPrimary: false,
        isOwnerXlated: true
      })
    }
  }

  /** Copies the contents of `clone` onto `existing`, keeping its identity. */
  private replaceRecord(existing: AcDbObject, clone: AcDbObject) {
    const target =
      this.dest.openObjectForWrite<AcDbObject>(existing.objectId) ?? existing
    clone.setAttr('ownerId', existing.ownerId)
    const name = existing.getAttrWithoutException('name' as never)
    if (name !== undefined) {
      clone.attrs.set('name' as never, name as never, { silent: true })
    }
    target.restoreFrom(clone as typeof target)
  }

  /** Clones the entities of every block definition that was cloned. */
  private cloneBlockContents() {
    const contents: { owner: AcDbBlockTableRecord; clones: AcDbEntity[] }[] = []
    for (const ref of this.refs.values()) {
      if (
        ref.kind !== 'block' ||
        !(ref.clone instanceof AcDbBlockTableRecord) ||
        !(ref.source instanceof AcDbBlockTableRecord)
      ) {
        continue
      }
      const owner = ref.clone
      const clones = Array.from(ref.source.newIterator()).map(entity =>
        this.cloneEntity(entity, owner, false)
      )
      contents.push({ owner, clones })
    }
    return contents
  }

  // ---------------------------------------------------------------------------
  // Phase 4: clone and translate entities
  // ---------------------------------------------------------------------------

  private cloneEntity(
    entity: AcDbEntity,
    owner: AcDbBlockTableRecord,
    isPrimary: boolean
  ): AcDbEntity {
    const clone = (
      this.isWblock
        ? entity.wblockClone(owner, this.idMap, isPrimary)
        : entity.deepClone(owner, this.idMap, isPrimary)
    ) as AcDbEntity
    // Bind right away so that getters on the clone never fall back to the
    // host's working database while it is detached.
    clone.database = this.dest
    // Commit the final handle before any reference is translated, so that
    // references between clones (a leader and its annotation, ...) resolve
    // in the same pass. Appending keeps a committed handle.
    this.dest.commitObjectHandle(clone)
    const pair = this.idMap.lookup(entity.objectId)
    if (pair) {
      this.idMap.assign({ ...pair, value: clone.objectId })
    }
    return clone
  }
}
