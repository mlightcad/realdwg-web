import {
  ACDB_ASSOC_NETWORK_DICT,
  AcDbAssocAction,
  type AcDbAssocActionData,
  AcDbAssocArrayActionBody,
  AcDbAssocDependency,
  AcDbAssocEdgeActionParam,
  AcDbAssocManager,
  AcDbAssocNetwork,
  type AcDbAssocValueParamValue,
  AcDbAssocVertexActionParam,
  AcDbDatabase,
  AcDbDictionary,
  AcDbObject
} from '@mlightcad/data-model'
import type { DwgCommonObject } from '@mlightcad/libredwg-web'

// Associative-framework objects as exposed by libredwg-web (`DwgDatabase.
// objects.ASSOC*`). Declared locally so this package still builds against
// libredwg-web releases that predate them; older releases simply provide no
// assoc objects and arrays load as plain block references.

interface LibreDwgPoint3d {
  x: number
  y: number
  z?: number
}

/** Dependency / action reference (`360` owned, `330` soft). */
export interface LibreDwgAssocHandleRef {
  handle: string
  isOwned: boolean
}

export interface LibreDwgAssocValueParam {
  classVersion: number
  name: string
  unitType: number
  values: {
    code: number
    value: number | string | null
    variableHandle: string
  }[]
  controlledObjectDependencyHandle: string
}

export interface LibreDwgAssocActionObject extends DwgCommonObject {
  classVersion: number
  status: number
  owningNetworkHandle: string
  actionBodyHandle: string
  actionIndex: number
  maxDependencyIndex: number
  dependencies: LibreDwgAssocHandleRef[]
  ownedParamHandles: string[]
  valueParams: LibreDwgAssocValueParam[]
}

export interface LibreDwgAssocNetworkObject extends LibreDwgAssocActionObject {
  networkVersion: number
  maxActionIndex: number
  actions: LibreDwgAssocHandleRef[]
  ownedActionHandles: string[]
}

export interface LibreDwgAssocDependencyObject extends DwgCommonObject {
  classVersion: number
  status: number
  isReadDependency: boolean
  isWriteDependency: boolean
  isAttachedToObject: boolean
  isDelegatingToOwningAction: boolean
  order: number
  name: string
  dependentOnHandle: string
  prevDependencyHandle: string
  nextDependencyHandle: string
  dependencyBodyHandle: string
  dependencyIndex: number
}

export interface LibreDwgAssocArrayActionBodyObject extends DwgCommonObject {
  actionBodyVersion: number
  classVersion: number
  parametersClassName: string
  parametersVersion: number
  items: {
    classVersion: number
    itemIndex: number
    rowIndex: number
    levelIndex: number
    flags: number
    /** Row-major 4x4. */
    matrix: number[]
    entityHandle: string
    /** Row-major 4x4 relative transform (flags & 2). */
    relativeMatrix?: number[]
    /** Second entity handle (flags & 0x10). */
    secondaryEntityHandle?: string
  }[]
  /** Row-major 4x4. */
  arrayTransform: number[]
}

export interface LibreDwgAssocActionParamObject extends DwgCommonObject {
  classVersion: number
  paramVersion: number
  name: string
  singleDependencyVersion: number
  dependencyHandle: string
}

export interface LibreDwgAssocVertexActionParamObject
  extends LibreDwgAssocActionParamObject {
  vertexVersion: number
  point: LibreDwgPoint3d
}

export interface LibreDwgAssocEdgeActionParamObject
  extends LibreDwgAssocActionParamObject {
  edgeVersion: number
  hasCachedCurve: boolean
  curveType: number
}

/** The assoc collections of a libredwg-web `DwgDatabase.objects`. */
export interface LibreDwgAssocObjects {
  ASSOCNETWORK?: LibreDwgAssocNetworkObject[]
  ASSOCACTION?: LibreDwgAssocActionObject[]
  ASSOCDEPENDENCY?: LibreDwgAssocDependencyObject[]
  ASSOCARRAYACTIONBODY?: LibreDwgAssocArrayActionBodyObject[]
  ASSOCVERTEXACTIONPARAM?: LibreDwgAssocVertexActionParamObject[]
  ASSOCEDGEACTIONPARAM?: LibreDwgAssocEdgeActionParamObject[]
}

/** Normalizes a handle string; `0` / empty → `''`. */
function id(handle: string | number | null | undefined): string {
  const value = String(handle ?? '')
    .trim()
    .toUpperCase()
  return value === '' || /^0+$/.test(value) ? '' : value
}

function actionData(action: LibreDwgAssocActionObject): AcDbAssocActionData {
  return {
    classVersion: action.classVersion,
    status: action.status,
    owningNetworkId: id(action.owningNetworkHandle),
    actionBodyId: id(action.actionBodyHandle),
    actionIndex: action.actionIndex,
    maxDependencyIndex: action.maxDependencyIndex,
    dependencies: action.dependencies.map(dep => ({
      id: id(dep.handle),
      isOwned: dep.isOwned
    })),
    ownedParamIds: action.ownedParamHandles.map(id),
    valueParams: action.valueParams.map(param => ({
      classVersion: param.classVersion,
      name: param.name,
      unitType: param.unitType,
      values: param.values.map(value => {
        const entry: AcDbAssocValueParamValue = {
          code: value.value == null ? 0 : value.code,
          value: value.value ?? 0,
          variableId: id(value.variableHandle)
        }
        return entry
      }),
      controlledObjectDependencyId: id(param.controlledObjectDependencyHandle)
    }))
  }
}

function withIds<T extends AcDbObject>(source: DwgCommonObject, object: T): T {
  object.objectId = id(source.handle)
  const owner = id(source.ownerHandle)
  if (owner) object.ownerId = owner
  return object
}

/**
 * Converts the associative-framework objects of a libredwg-web database
 * (associative arrays) into data-model objects and registers them under
 * their DWG handles.
 *
 * Call before dictionaries are materialized, so `ACAD_ASSOCNETWORK` entries
 * resolve, then call {@link linkLibreDwgAssocNetworkDictionary} after them and
 * `AcDbAssocManager.linkLoadedObjects` once entities exist.
 *
 * @returns Number of converted objects.
 */
export function convertLibreDwgAssocObjects(
  objects: LibreDwgAssocObjects,
  db: AcDbDatabase
): number {
  const converted: AcDbObject[] = []

  for (const src of objects.ASSOCNETWORK ?? []) {
    const network = withIds(src, new AcDbAssocNetwork())
    network.setActionFromDwg(actionData(src))
    network.setNetworkFromDwg({
      networkClassVersion: src.networkVersion,
      maxActionIndex: src.maxActionIndex,
      actions: src.actions.map(ref => ({
        id: id(ref.handle),
        isOwned: ref.isOwned
      })),
      ownedActionIds: src.ownedActionHandles.map(id)
    })
    converted.push(network)
  }
  for (const src of objects.ASSOCACTION ?? []) {
    const action = withIds(src, new AcDbAssocAction())
    action.setActionFromDwg(actionData(src))
    converted.push(action)
  }
  for (const src of objects.ASSOCDEPENDENCY ?? []) {
    const dep = withIds(src, new AcDbAssocDependency())
    dep.setFromDwg({
      classVersion: src.classVersion,
      status: src.status,
      isReadDependency: src.isReadDependency,
      isWriteDependency: src.isWriteDependency,
      isAttachedToObject: src.isAttachedToObject,
      isDelegatingToOwningAction: src.isDelegatingToOwningAction,
      order: src.order,
      name: src.name,
      dependentOnObjectId: id(src.dependentOnHandle),
      prevDependencyOnObjectId: id(src.prevDependencyHandle),
      nextDependencyOnObjectId: id(src.nextDependencyHandle),
      dependencyBodyId: id(src.dependencyBodyHandle),
      dependencyIndex: src.dependencyIndex
    })
    converted.push(dep)
  }
  for (const src of objects.ASSOCARRAYACTIONBODY ?? []) {
    const body = withIds(src, new AcDbAssocArrayActionBody())
    body.setFromDwg({
      classVersion: src.classVersion,
      parametersClassName: src.parametersClassName,
      parametersVersion: src.parametersVersion,
      items: src.items.map(item => ({
        classVersion: item.classVersion,
        itemIndex: item.itemIndex,
        rowIndex: item.rowIndex,
        levelIndex: item.levelIndex,
        flags: item.flags,
        matrix: [...item.matrix],
        entityId: id(item.entityHandle),
        ...(item.relativeMatrix
          ? { relativeMatrix: [...item.relativeMatrix] }
          : {}),
        secondaryEntityId: id(item.secondaryEntityHandle)
      })),
      arrayTransform: [...src.arrayTransform]
    })
    converted.push(body)
  }
  const paramBase = (
    src: LibreDwgAssocActionParamObject,
    param: AcDbAssocVertexActionParam | AcDbAssocEdgeActionParam
  ) => {
    withIds(src, param)
    param.setParamFromDwg({
      classVersion: src.classVersion,
      flags: src.paramVersion,
      name: src.name
    })
    param.setSingleDependencyFromDwg({
      classVersion: src.singleDependencyVersion,
      dependencyId: id(src.dependencyHandle)
    })
    return param
  }
  for (const src of objects.ASSOCVERTEXACTIONPARAM ?? []) {
    const param = paramBase(src, new AcDbAssocVertexActionParam())
    ;(param as AcDbAssocVertexActionParam).setVertexFromDwg({
      classVersion: src.vertexVersion,
      point: { x: src.point.x, y: src.point.y, z: src.point.z ?? 0 }
    })
    converted.push(param)
  }
  for (const src of objects.ASSOCEDGEACTIONPARAM ?? []) {
    // LibreDWG does not decode the cached curve; the path curve is still
    // reached through the parameter's dependency.
    const param = paramBase(src, new AcDbAssocEdgeActionParam())
    ;(param as AcDbAssocEdgeActionParam).setEdgeFromDwg({
      classVersion: src.edgeVersion
    })
    converted.push(param)
  }

  for (const object of converted) {
    if (!object.objectId) continue
    object.database = db
    db.commitObjectHandle(object)
  }
  return converted.length
}

/**
 * Puts the top-level network's container dictionary into the named object
 * dictionary under `ACAD_ASSOCNETWORK` (the generic dictionary import skips
 * root dictionaries), and attaches a dictionary owned by a block table record
 * as that record's extension dictionary when LibreDWG did not expose it (the
 * per-space network lives there).
 */
export function linkLibreDwgAssocNetworkDictionary(
  objects: LibreDwgAssocObjects,
  dictionaries: readonly { handle: string; ownerHandle?: string }[],
  db: AcDbDatabase
): void {
  const networks = objects.ASSOCNETWORK ?? []
  if (networks.length === 0) return

  // Block table records whose extension dictionary was not surfaced.
  const btrByHandle = new Map(
    [...db.tables.blockTable.newIterator()].map(btr => [id(btr.objectId), btr])
  )
  for (const dict of dictionaries) {
    const btr = btrByHandle.get(id(dict.ownerHandle))
    if (btr && !btr.extensionDictionary) {
      const object = db.getObjectById(id(dict.handle))
      if (object instanceof AcDbDictionary) {
        btr.extensionDictionary = object.objectId
      }
    }
  }

  const nod = db.objects.dictionary
  if (nod.getAt(ACDB_ASSOC_NETWORK_DICT)) return
  const ownerOf = new Map(
    dictionaries.map(dict => [id(dict.handle), id(dict.ownerHandle)])
  )
  for (const network of networks) {
    if (id(network.owningNetworkHandle)) continue
    const containerId = id(network.ownerHandle)
    const container = db.getObjectById(containerId)
    if (!(container instanceof AcDbDictionary)) continue
    // The container must hang directly off the NOD (its owner has no owner).
    const parent = ownerOf.get(container.ownerId ? id(container.ownerId) : '')
    if (parent) continue
    nod.setAt(ACDB_ASSOC_NETWORK_DICT, container)
    break
  }
}

/** Attaches dependencies to their objects as persistent reactors. */
export function linkLibreDwgAssocReactors(
  objects: LibreDwgAssocObjects,
  db: AcDbDatabase
): void {
  if (objects.ASSOCDEPENDENCY?.length) AcDbAssocManager.linkLoadedObjects(db)
}
