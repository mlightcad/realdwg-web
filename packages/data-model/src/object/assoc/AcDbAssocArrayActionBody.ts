import { AcCmColor, AcCmColorMethod, AcCmTransparency } from '@mlightcad/common'
import {
  AcGeMatrix3d,
  AcGePoint3d,
  type AcGePoint3dLike,
  AcGeVector3d,
  type AcGeVector3dLike
} from '@mlightcad/geometry-engine'
import { AcGiLineWeight } from '@mlightcad/graphic-interface'

import { AcDbDxfFiler } from '../../base/AcDbDxfFiler.js'
import type { AcDbObject, AcDbObjectId } from '../../base/AcDbObject.js'
import { AcDbBlockTableRecord } from '../../database/AcDbBlockTableRecord.js'
import type { AcDbDatabase } from '../../database/AcDbDatabase.js'
import { AcDbBlockReference } from '../../entity/AcDbBlockReference.js'
import { AcDbCurve } from '../../entity/AcDbCurve.js'
import { AcDbEntity } from '../../entity/AcDbEntity.js'
import { AcDbLine } from '../../entity/AcDbLine.js'
import { AcDbPolyline } from '../../entity/AcDbPolyline.js'
import { ByBlock } from '../../misc/AcDbConstants.js'
import { acdbCreateAnonymousUserBlock } from './acdbAllocateAnonymousUserBlockName.js'
import { AcDbAssocAction } from './AcDbAssocAction.js'
import { AcDbAssocActionBody } from './AcDbAssocActionBody.js'
import { AcDbAssocArrayCommonParameters } from './AcDbAssocArrayCommonParameters.js'
import { AcDbAssocArrayItem } from './AcDbAssocArrayItem.js'
import { AcDbAssocArrayItemLocator } from './AcDbAssocArrayItemLocator.js'
import { AcDbAssocArrayParameters } from './AcDbAssocArrayParameters.js'
import {
  type AcDbAssocArrayPathEdgeRef,
  AcDbAssocArrayPathParameters
} from './AcDbAssocArrayPathParameters.js'
import { AcDbAssocArrayPolarParameters } from './AcDbAssocArrayPolarParameters.js'
import { AcDbAssocArrayRectangularParameters } from './AcDbAssocArrayRectangularParameters.js'
import { AcDbAssocDependency } from './AcDbAssocDependency.js'
import {
  AcDbAssocDxfCursor,
  acdbAssocWriteId,
  acdbAssocWriteMatrix
} from './acdbAssocDxf.js'
import { AcDbAssocNetwork } from './AcDbAssocNetwork.js'
import { AcDbAssocStatus } from './AcDbAssocStatus.js'
import {
  AcDbAssocEdgeActionParam,
  type AcDbAssocEdgeLineSegment,
  AcDbAssocVertexActionParam
} from './AcDbAssocVertexActionParam.js'

export interface AcDbAssocArrayCreateResult {
  arrayEntityId: AcDbObjectId
  actionBodyId: AcDbObjectId
  actionId: AcDbObjectId
}

/** Order AutoCAD gives the dependency on the array INSERT. */
const ARRAY_ENTITY_DEPENDENCY_ORDER = -2147483648

/** Item record class name AutoCAD writes into the body. */
const ITEM_CLASS_NAME = 'AcDbAssocArrayItem'

/**
 * Fields of an {@link AcDbAssocArrayActionBody} decoded from a DWG record.
 */
export interface AcDbAssocArrayActionBodyData {
  actionBodyClassVersion?: number
  classVersion: number
  parametersClassName: string
  parametersVersion: number
  items: {
    classVersion: number
    itemIndex: number
    rowIndex: number
    levelIndex: number
    flags: number
    /** Row-major 4×4 matrix (16 values). */
    matrix: number[]
    entityId: AcDbObjectId
  }[]
  /** Row-major 4×4 array transform (16 values). */
  arrayTransform: number[]
}

/** Builds a matrix from 16 row-major values. */
function matrixFromRowMajor(values: readonly number[]): AcGeMatrix3d {
  const m = new AcGeMatrix3d()
  if (values.length >= 16) {
    m.set(
      values[0],
      values[1],
      values[2],
      values[3],
      values[4],
      values[5],
      values[6],
      values[7],
      values[8],
      values[9],
      values[10],
      values[11],
      values[12],
      values[13],
      values[14],
      values[15]
    )
  }
  return m
}

/**
 * Returns the WCS transform of an array INSERT (block space → world).
 */
export function acdbAssocArrayInsertTransform(
  ref: AcDbBlockReference
): AcGeMatrix3d {
  const s = ref.scaleFactors
  const p = ref.position
  return new AcGeMatrix3d()
    .setFromExtrusionDirection(ref.normal)
    .multiply(AcGeMatrix3d.makeTranslation(p.x, p.y, p.z))
    .multiply(new AcGeMatrix3d().makeRotationZ(ref.rotation))
    .multiply(new AcGeMatrix3d().makeScale(s.x, s.y, s.z))
}

/**
 * Associative action body that evaluates an array of items from parameters
 * (ObjectARX `AcDbAssocArrayActionBody`).
 *
 * The array is an INSERT of an anonymous *array block* whose entities are
 * item INSERTs of an anonymous *source block*. The body's action depends on:
 * - the array block (write),
 * - the source block (read),
 * - the array INSERT (read + write, order `-2147483648`),
 * - the path curve, for path arrays (read).
 *
 * Parameter values live on the owning action (value parameters and
 * `Origin` / `BaseNormal` / `basePoint` / `RowProfile` action parameters).
 *
 * DXF layout (`AcDbAssocArrayActionBody` subclass): `90 1,
 * 1 <parameters class name>, 90 0, 90 itemCount, 1 AcDbAssocArrayItem,
 * item×itemCount, 40×16 array transform (row-major)`.
 */
export class AcDbAssocArrayActionBody extends AcDbAssocActionBody {
  static readonly DXF_NAME = 'ACDBASSOCARRAYACTIONBODY'

  private _classVersion = 1
  private _parametersClassName = ''
  private _parametersVersion = 0
  private _items: AcDbAssocArrayItem[] = []
  /** Array INSERT transform at the last evaluation (column-major). */
  private _arrayTransform = new AcGeMatrix3d()
  /** Lazily built from the owning action; see {@link parameters}. */
  private _parameters: AcDbAssocArrayParameters | undefined

  // ---------------------------------------------------------------------------
  // Graph navigation
  // ---------------------------------------------------------------------------

  /** Owning action, if resident. */
  get action(): AcDbAssocAction | undefined {
    const db = this.database
    const action = db?.getObjectById(this.parentActionId)
    return action instanceof AcDbAssocAction ? action : undefined
  }

  private findDependency(
    predicate: (dep: AcDbAssocDependency, target: unknown) => boolean
  ): AcDbAssocDependency | undefined {
    const action = this.action
    const db = this.database
    if (!action || !db) return undefined
    for (const dep of action.dependencies(db)) {
      if (predicate(dep, dep.dependentOnObject(db))) return dep
    }
    return undefined
  }

  /** Dependency on the array INSERT (read + write). */
  get arrayEntityDependency(): AcDbAssocDependency | undefined {
    return this.findDependency(
      (dep, target) =>
        target instanceof AcDbBlockReference &&
        dep.isWriteDependency &&
        dep.isReadDependency
    )
  }

  /** True when the array INSERT no longer exists (erased). */
  override isOrphaned(): boolean {
    return !this.getArrayEntity()
  }

  /** Object id of the array INSERT (ObjectARX `getArrayEntity`). */
  get arrayEntityId(): AcDbObjectId {
    return this.arrayEntityDependency?.dependentOnObjectId ?? ''
  }

  /** The array INSERT, if resident. */
  getArrayEntity(): AcDbBlockReference | undefined {
    const db = this.database
    const entity = db?.getObjectById(this.arrayEntityId)
    return entity instanceof AcDbBlockReference ? entity : undefined
  }

  /** The source block (read-only block dependency). */
  get sourceBlock(): AcDbBlockTableRecord | undefined {
    const db = this.database
    return this.findDependency(
      (dep, target) =>
        target instanceof AcDbBlockTableRecord &&
        dep.isReadDependency &&
        !dep.isWriteDependency
    )?.dependentOnObject(db) as AcDbBlockTableRecord | undefined
  }

  /** The array block (write-only block dependency). */
  get arrayBlock(): AcDbBlockTableRecord | undefined {
    const db = this.database
    const fromDep = this.findDependency(
      (dep, target) =>
        target instanceof AcDbBlockTableRecord &&
        dep.isWriteDependency &&
        !dep.isReadDependency
    )?.dependentOnObject(db) as AcDbBlockTableRecord | undefined
    return fromDep ?? this.getArrayEntity()?.blockTableRecord
  }

  get sourceBlockName(): string {
    return this.sourceBlock?.name ?? ''
  }

  get arrayBlockName(): string {
    return this.arrayBlock?.name ?? ''
  }

  /** Entities of the source block (ObjectARX `getSourceEntities`). */
  get sourceEntityIds(): AcDbObjectId[] {
    const btr = this.sourceBlock
    if (!btr) return []
    const ids: AcDbObjectId[] = []
    for (const entity of btr.newIterator()) ids.push(entity.objectId)
    return ids
  }

  /** Path curve of a path array, if resident. */
  getPathCurve(): AcDbCurve | undefined {
    const action = this.action
    const db = this.database
    if (!action || !db) return undefined
    const profile = action.paramAtName('RowProfile', db)
    if (profile instanceof AcDbAssocEdgeActionParam) {
      const target = profile.dependency(db)?.dependentOnObject(db)
      if (target instanceof AcDbCurve) return target
    }
    const dep = this.findDependency(
      (d, target) =>
        target instanceof AcDbCurve &&
        d.isReadDependency &&
        !d.isWriteDependency
    )
    const target = dep?.dependentOnObject(db)
    return target instanceof AcDbCurve ? target : undefined
  }

  /** Items of the last evaluation. */
  get items(): readonly AcDbAssocArrayItem[] {
    return this._items
  }

  /** Item at `locator` (ObjectARX `getItemAt`). */
  getItemAt(
    locator: AcDbAssocArrayItemLocator
  ): AcDbAssocArrayItem | undefined {
    return this._items.find(item => item.locator.equals(locator))
  }

  /** C++ class name of the parameters stored in DXF/DWG. */
  get parametersClassName(): string {
    return this._parametersClassName || this._parameters?.className || ''
  }

  /** Array INSERT transform recorded at the last evaluation. */
  get arrayTransform(): AcGeMatrix3d {
    return this._arrayTransform
  }

  // ---------------------------------------------------------------------------
  // Parameters
  // ---------------------------------------------------------------------------

  /**
   * Array parameters (ObjectARX `parameters`). Built from the owning action's
   * value and point parameters on first access.
   */
  get parameters(): AcDbAssocArrayParameters | undefined {
    if (!this._parameters) this.loadParametersFromAction()
    return this._parameters
  }

  /**
   * Replaces the parameters and writes them to the owning action
   * (ObjectARX `setParameters`).
   */
  setParameters(parameters: AcDbAssocArrayParameters): void {
    this._parameters = parameters
    this._parametersClassName = parameters.className
    parameters.ownerActionBodyId = this.objectId
    this.syncParametersToAction()
  }

  private loadParametersFromAction(): void {
    const action = this.action
    if (!action) return
    let params: AcDbAssocArrayParameters | undefined
    switch (this._parametersClassName) {
      case 'AcDbAssocArrayRectangularParameters':
        params = new AcDbAssocArrayRectangularParameters()
        break
      case 'AcDbAssocArrayPolarParameters':
        params = new AcDbAssocArrayPolarParameters()
        break
      case 'AcDbAssocArrayPathParameters':
        params = new AcDbAssocArrayPathParameters()
        break
      default:
        return
    }
    params.fromValueParams(name => {
      const value = action.getValueParam(name)
      return typeof value === 'number' ? value : undefined
    })
    if (params instanceof AcDbAssocArrayCommonParameters) {
      const db = this.database
      const point = (name: string) => {
        const p = action.paramAtName(name, db)
        return p instanceof AcDbAssocVertexActionParam ? p.point : undefined
      }
      const origin = point('Origin')
      if (origin) params.origin = origin.clone()
      const normal = point('BaseNormal')
      if (normal)
        params.baseNormal = new AcGeVector3d(normal.x, normal.y, normal.z)
      const base = point('basePoint')
      if (base) params.basePoint = base.clone()
    }
    if (params instanceof AcDbAssocArrayPathParameters) {
      const curve = this.getPathCurve()
      if (curve) params.setPath({ entityId: curve.objectId })
    }
    params.ownerActionBodyId = this.objectId
    this._parameters = params
  }

  /**
   * Writes the parameters into the owning action's value and point
   * parameters (AutoCAD's persistent form).
   */
  syncParametersToAction(): void {
    const action = this.action
    const params = this._parameters
    if (!action || !params) return
    for (const spec of params.toValueParams()) {
      action.setValueParam(spec.name, spec.value, spec.unitType, spec.code)
    }
    if (params instanceof AcDbAssocArrayCommonParameters) {
      const db = this.database
      const setPoint = (name: string, p: AcGePoint3dLike) => {
        let param = action.paramAtName(name, db)
        if (!(param instanceof AcDbAssocVertexActionParam)) {
          param = new AcDbAssocVertexActionParam(name)
          action.addParam(param)
        }
        ;(param as AcDbAssocVertexActionParam).point = p
      }
      const n = params.baseNormal
      setPoint('BaseNormal', { x: n.x, y: n.y, z: n.z })
      setPoint('Origin', params.origin)
      setPoint('basePoint', params.basePoint)
    }
  }

  // ---------------------------------------------------------------------------
  // Lookup
  // ---------------------------------------------------------------------------

  /**
   * Returns whether `entity` is the INSERT of an associative array
   * (ObjectARX `isAssociativeArray`).
   */
  static isAssociativeArray(entity: AcDbEntity, db?: AcDbDatabase): boolean {
    return AcDbAssocArrayActionBody.getAssociativeArray(entity, db) != null
  }

  /**
   * Returns the action body controlling the associative-array INSERT
   * `entity`, found through the entity's persistent reactors (its
   * dependencies), like AutoCAD.
   */
  static getAssociativeArray(
    entity: AcDbEntity,
    db?: AcDbDatabase
  ): AcDbAssocArrayActionBody | undefined {
    const database = db ?? entity.database
    if (!database) return undefined
    for (const reactorId of entity.getPersistentReactors()) {
      const dep = database.getObjectById(reactorId)
      if (!(dep instanceof AcDbAssocDependency)) continue
      if (dep.dependentOnObjectId !== entity.objectId) continue
      const action = database.getObjectById(dep.owningActionId)
      if (!(action instanceof AcDbAssocAction)) continue
      const body = action.actionBody(database)
      if (
        body instanceof AcDbAssocArrayActionBody &&
        body.arrayEntityId === entity.objectId
      ) {
        return body
      }
    }
    return undefined
  }

  /** Alias of {@link getAssociativeArray} (ObjectARX naming). */
  static getControllingActionBody(
    entity: AcDbEntity,
    db?: AcDbDatabase
  ): AcDbAssocArrayActionBody | undefined {
    return AcDbAssocArrayActionBody.getAssociativeArray(entity, db)
  }

  // ---------------------------------------------------------------------------
  // Creation
  // ---------------------------------------------------------------------------

  /**
   * Creates an associative array from source entities
   * (`AcDbAssocArrayActionBody::createInstance`), in AutoCAD's layout.
   *
   * - Rectangular: the array INSERT sits at `basePoint`.
   * - Polar: the INSERT is at the origin; set `parameters.center` (WCS)
   *   first. Radius and start angle are derived from `basePoint`.
   * - Path: the INSERT is at the origin; call `parameters.setPath` first.
   *   Item 0 lands on the path start; with aligned items the source block is
   *   authored in the tangent frame there.
   *
   * @returns Object ids of the array INSERT and the new action body / action.
   */
  static createInstance(
    sourceEntityIds: readonly AcDbObjectId[],
    basePoint: AcGePoint3dLike,
    parameters: AcDbAssocArrayParameters,
    db: AcDbDatabase
  ): AcDbAssocArrayCreateResult {
    if (sourceEntityIds.length === 0) {
      throw new Error('AcDbAssocArrayActionBody.createInstance: no sources')
    }

    const base = new AcGePoint3d(basePoint.x, basePoint.y, basePoint.z ?? 0)

    let pathCurve: AcDbCurve | undefined
    if (parameters instanceof AcDbAssocArrayPathParameters) {
      const pathId = parameters.path?.entityId
      const path = pathId ? db.getObjectById(pathId) : undefined
      if (!(path instanceof AcDbCurve)) {
        throw new Error(
          'AcDbAssocArrayActionBody.createInstance: path parameters require a path curve entity'
        )
      }
      pathCurve = path
    }

    const sources: AcDbEntity[] = []
    for (const id of sourceEntityIds) {
      const entity = db.getObjectById(id)
      if (entity instanceof AcDbEntity) sources.push(entity)
    }
    if (sources.length === 0) {
      throw new Error(
        'AcDbAssocArrayActionBody.createInstance: no valid source entities'
      )
    }

    // Frames: insert position (array block → world) and source authoring
    // transform (world → source block).
    let insertPosition = new AcGePoint3d(0, 0, 0)
    let toSource = AcGeMatrix3d.makeTranslation(-base.x, -base.y, -base.z)
    if (parameters instanceof AcDbAssocArrayRectangularParameters) {
      insertPosition = base.clone()
      parameters.origin = new AcGePoint3d(0, 0, 0)
    } else if (parameters instanceof AcDbAssocArrayPolarParameters) {
      parameters.setFirstItemPosition(base)
    } else if (parameters instanceof AcDbAssocArrayPathParameters) {
      parameters.setPathCurve(pathCurve)
      if (parameters.alignItems) {
        const frame = parameters.getFirstItemFrame()
        const e = frame.elements
        const angle = Math.atan2(e[1], e[0])
        toSource = new AcGeMatrix3d().makeRotationZ(-angle).multiply(toSource)
      }
    }
    if (parameters instanceof AcDbAssocArrayCommonParameters) {
      parameters.basePoint = new AcGePoint3d(0, 0, 0)
    }

    const sourceBtr = acdbCreateAnonymousUserBlock(db)
    const arrayBtr = acdbCreateAnonymousUserBlock(db)
    for (const entity of sources) {
      sourceBtr.appendEntity(entity.getTransformedCopy(toSource))
      entity.erase()
    }

    // The INSERT gets its handle and reactor before it is appended, so the
    // transaction's append record (used by redo) already carries the reactor.
    const arrayInsert = new AcDbBlockReference(arrayBtr.name)
    arrayInsert.position = insertPosition
    arrayInsert.objectId = db.generateHandle()

    // Action graph in the model-space network.
    const network = AcDbAssocNetwork.getInstanceFromObject(
      db.tables.blockTable.modelSpace,
      true
    )!
    const action = new AcDbAssocAction()
    network.addAction(action, true)
    const body = new AcDbAssocArrayActionBody()
    action.setActionBody(body)
    body._parametersClassName = parameters.className

    const addDependency = (
      target: AcDbObject,
      read: boolean,
      write: boolean,
      order = 0
    ) => {
      const dep = new AcDbAssocDependency()
      dep.isReadDependency = read
      dep.isWriteDependency = write
      dep.order = order
      action.addDependency(dep)
      dep.attachToObject(target.objectId, target)
      return dep
    }
    const pathDep = pathCurve
      ? addDependency(pathCurve, true, false)
      : undefined
    addDependency(arrayBtr, false, true)
    addDependency(sourceBtr, true, false)
    addDependency(arrayInsert, true, true, ARRAY_ENTITY_DEPENDENCY_ORDER)
    db.tables.blockTable.modelSpace.appendEntity(arrayInsert)

    // Action parameters in AutoCAD's order.
    action.addParam(
      new AcDbAssocVertexActionParam('BaseNormal', { x: 0, y: 0, z: 1 })
    )
    action.addParam(new AcDbAssocVertexActionParam('Origin'))
    if (pathDep && pathCurve) {
      const profile = new AcDbAssocEdgeActionParam('RowProfile')
      profile.dependencyId = pathDep.objectId
      profile.setCachedLineSegments(acdbAssocLineSegmentsOf(pathCurve))
      action.addParam(profile)
    }
    action.addParam(new AcDbAssocVertexActionParam('basePoint'))

    body.setParameters(parameters)

    action.setDirty()
    body.evaluateOverride()
    if (action.status !== AcDbAssocStatus.FailedToEvaluateAssocStatus) {
      action.setUpToDate()
      for (const dep of action.dependencies()) dep.setUpToDate()
    }

    return {
      arrayEntityId: arrayInsert.objectId,
      actionBodyId: body.objectId,
      actionId: action.objectId
    }
  }

  // ---------------------------------------------------------------------------
  // Evaluation
  // ---------------------------------------------------------------------------

  /** WCS → array block transform of the array INSERT. */
  private worldToArray(): AcGeMatrix3d | undefined {
    const ref = this.getArrayEntity()
    if (!ref) return undefined
    return acdbAssocArrayInsertTransform(ref).invert()
  }

  private bindPathCurve(): void {
    const params = this.parameters
    if (!(params instanceof AcDbAssocArrayPathParameters)) return
    const curve = this.getPathCurve()
    if (curve) {
      params.setPath({ entityId: curve.objectId })
      params.setPathCurve(curve, this.worldToArray())
    }
  }

  /**
   * Returns the transform for one array item (source block → array block).
   */
  getTransform(locator: AcDbAssocArrayItemLocator): AcGeMatrix3d {
    const params = this.parameters
    if (!params) return new AcGeMatrix3d()
    this.bindPathCurve()
    return params.getItemTransform(locator)
  }

  /**
   * Rebuilds every item INSERT inside the array block and the item list.
   */
  override evaluateOverride(): void {
    const db = this.database
    const params = this.parameters
    if (!db || !params) return
    this.bindPathCurve()

    const arrayBtr = this.arrayBlock
    const sourceBtr = this.sourceBlock
    if (!arrayBtr || !sourceBtr) {
      const action = this.action
      if (action) action.status = AcDbAssocStatus.FailedToEvaluateAssocStatus
      return
    }

    // Clear previous items.
    const existingIds: AcDbObjectId[] = []
    for (const ent of arrayBtr.newIterator()) existingIds.push(ent.objectId)
    if (existingIds.length > 0) arrayBtr.removeEntity(existingIds)

    const items: AcDbAssocArrayItem[] = []
    for (const locator of params.getItemLocators()) {
      const matrix = params.getItemTransform(locator)
      const item = new AcDbBlockReference(sourceBtr.name)
      const e = matrix.elements
      item.position = new AcGePoint3d(e[12], e[13], e[14])
      const rot = Math.atan2(e[1], e[0])
      if (Number.isFinite(rot) && Math.abs(rot) > 1e-12) item.rotation = rot
      // AutoCAD items inherit everything from the array INSERT.
      item.layer = '0'
      item.color = new AcCmColor(AcCmColorMethod.ByBlock)
      item.lineType = ByBlock
      item.lineWeight = AcGiLineWeight.ByBlock
      item.transparency = AcCmTransparency.fromString('ByBlock')
      arrayBtr.appendEntity(item)
      items.push(new AcDbAssocArrayItem(locator, matrix, item.objectId))
    }
    this._items = items

    const ref = this.getArrayEntity()
    if (ref) this._arrayTransform = acdbAssocArrayInsertTransform(ref)

    // Keep persisted value parameters (e.g. a path FillPath count) current.
    this.syncParametersToAction()
  }

  /**
   * Updates common count/spacing and marks the owning action dirty.
   */
  setRowColumnLevel(rows?: number, columns?: number, levels?: number): void {
    const params = this.parameters
    if (!(params instanceof AcDbAssocArrayCommonParameters)) return
    if (rows != null) params.rowCount = rows
    if (columns != null) params.itemCount = columns
    if (levels != null) params.levelCount = levels
    this.syncParametersToAction()
    this.markDirty()
  }

  markDirty(): void {
    this.action?.setDirty()
  }

  // ---------------------------------------------------------------------------
  // Grips
  // ---------------------------------------------------------------------------

  /**
   * Grip indices for associative-array INSERTs:
   * - `0` — base point (first item)
   * - `1` — primary-axis count grip (columns / items)
   * - `2` — secondary-axis count grip (rows), rectangular only
   */
  static readonly GRIP_BASE = 0
  static readonly GRIP_PRIMARY = 1
  static readonly GRIP_SECONDARY = 2

  private itemWorldPoint(
    ref: AcDbBlockReference,
    locator: AcDbAssocArrayItemLocator
  ): AcGePoint3d {
    const m = acdbAssocArrayInsertTransform(ref).multiply(
      this.getTransform(locator)
    )
    const e = m.elements
    return new AcGePoint3d(e[12], e[13], e[14])
  }

  /**
   * Returns WCS grip points for the associative-array INSERT `ref`.
   */
  getGripPoints(ref: AcDbBlockReference): AcGePoint3d[] {
    const params = this.parameters
    if (!params) return [ref.position.clone()]
    const grips = [this.itemWorldPoint(ref, new AcDbAssocArrayItemLocator())]

    if (params instanceof AcDbAssocArrayRectangularParameters) {
      grips.push(
        this.itemWorldPoint(
          ref,
          new AcDbAssocArrayItemLocator(
            Math.max(1, params.columnCount) - 1,
            0,
            0
          )
        ),
        this.itemWorldPoint(
          ref,
          new AcDbAssocArrayItemLocator(0, Math.max(1, params.rowCount) - 1, 0)
        )
      )
      return grips
    }

    if (params instanceof AcDbAssocArrayPolarParameters) {
      grips.push(
        this.itemWorldPoint(
          ref,
          new AcDbAssocArrayItemLocator(Math.max(1, params.itemCount) - 1, 0, 0)
        )
      )
      return grips
    }

    if (params instanceof AcDbAssocArrayPathParameters) {
      this.bindPathCurve()
      grips.push(
        this.itemWorldPoint(
          ref,
          new AcDbAssocArrayItemLocator(params.effectiveItemCount() - 1, 0, 0)
        )
      )
    }
    return grips
  }

  /**
   * Applies a grip drag to array parameters or the INSERT position, then
   * re-evaluates the array block.
   */
  moveGripPointsAt(
    ref: AcDbBlockReference,
    indices: number[],
    offset: AcGeVector3dLike
  ): void {
    if (indices.length === 0) return
    const params = this.parameters
    // Grip offsets are in WCS; count grips work in array-block space.
    const local = new AcGeVector3d(offset.x ?? 0, offset.y ?? 0, offset.z ?? 0)
    const toArray = this.worldToArray()
    if (toArray) {
      const e = toArray.elements
      const { x, y, z } = local
      local.set(
        e[0] * x + e[4] * y + e[8] * z,
        e[1] * x + e[5] * y + e[9] * z,
        e[2] * x + e[6] * y + e[10] * z
      )
    }
    const dx = local.x
    const dy = local.y

    for (const index of indices) {
      if (index === AcDbAssocArrayActionBody.GRIP_BASE) {
        ref.position = new AcGePoint3d(
          ref.position.x + (offset.x ?? 0),
          ref.position.y + (offset.y ?? 0),
          ref.position.z + (offset.z ?? 0)
        )
        continue
      }

      if (
        params instanceof AcDbAssocArrayRectangularParameters &&
        index === AcDbAssocArrayActionBody.GRIP_PRIMARY
      ) {
        const spacing = Math.max(1e-9, Math.abs(params.columnSpacing))
        const projected = params.columnSpacing >= 0 ? dx : -dx
        params.columnCount = Math.max(
          1,
          params.columnCount + Math.round(projected / spacing)
        )
      } else if (
        params instanceof AcDbAssocArrayRectangularParameters &&
        index === AcDbAssocArrayActionBody.GRIP_SECONDARY
      ) {
        const spacing = Math.max(1e-9, Math.abs(params.rowSpacing))
        const projected = params.rowSpacing >= 0 ? dy : -dy
        params.rowCount = Math.max(
          1,
          params.rowCount + Math.round(projected / spacing)
        )
      } else if (
        params instanceof AcDbAssocArrayPolarParameters &&
        index === AcDbAssocArrayActionBody.GRIP_PRIMARY
      ) {
        const angleStep = Math.max(1e-9, Math.abs(params.angleBetweenItems))
        const arcStep = Math.max(1e-9, params.radius * angleStep)
        const delta = Math.round(Math.hypot(dx, dy) / arcStep)
        const sign = dx + dy >= 0 ? 1 : -1
        params.itemCount = Math.max(1, params.itemCount + sign * delta)
      } else if (
        params instanceof AcDbAssocArrayPathParameters &&
        index === AcDbAssocArrayActionBody.GRIP_PRIMARY
      ) {
        const spacing = Math.max(1e-9, Math.abs(params.itemSpacing))
        const delta = Math.round(Math.hypot(dx, dy) / spacing)
        const sign = dx + dy >= 0 ? 1 : -1
        params.fillPath = false
        params.itemCount = Math.max(
          1,
          params.effectiveItemCount() + sign * delta
        )
      } else {
        continue
      }
      this.markDirty()
    }

    this.syncParametersToAction()
    this.evaluateOverride()
    this.action?.setUpToDate()
  }

  // ---------------------------------------------------------------------------
  // Explode / disassociate
  // ---------------------------------------------------------------------------

  /**
   * Explodes this associative array into independent entity copies (AutoCAD
   * EXPLODE on an associative array). Erasing the INSERT afterwards orphans
   * the action, which is then dropped from evaluation and DXF export.
   *
   * @param _ref - The array INSERT being exploded (reserved for future use).
   * @param insertTransform - WCS transform of the array INSERT
   *   (`AcDbBlockReference.getExplodeTransform`).
   * @returns Leaf entities in WCS, or `undefined` on failure.
   */
  explodeToEntities(
    _ref: AcDbBlockReference,
    insertTransform: AcGeMatrix3d
  ): AcDbEntity[] | undefined {
    const sourceBtr = this.sourceBlock
    if (!sourceBtr) return undefined

    // Use the items the array shows (the last evaluation, or AutoCAD's stored
    // items); recompute only when no items are stored or the action is dirty.
    let itemMatrices: AcGeMatrix3d[]
    if (this._items.length > 0 && !this.action?.needsEvaluation) {
      itemMatrices = this._items.map(item => item.transform)
    } else {
      const params = this.parameters
      if (!params) return undefined
      this.bindPathCurve()
      itemMatrices = params
        .getItemLocators()
        .map(locator => params.getItemTransform(locator))
    }

    const created: AcDbEntity[] = []
    for (const itemMatrix of itemMatrices) {
      const world = insertTransform.clone().multiply(itemMatrix)
      for (const source of sourceBtr.newIterator()) {
        created.push(source.getTransformedCopy(world))
      }
    }

    // The action graph is kept: the caller erases the array INSERT, which
    // orphans the action (skipped on export) and keeps EXPLODE undoable.
    return created
  }

  /**
   * Erases this action body with its action, dependencies and parameters,
   * detaching the dependencies from the array INSERT, blocks and path.
   */
  disassociate(): void {
    const action = this.action
    if (action) {
      action.eraseAction()
    } else {
      this.database?.releaseObjectHandle(this)
    }
  }

  // ---------------------------------------------------------------------------
  // DXF
  // ---------------------------------------------------------------------------

  override getHardOwnedObjectIds(): AcDbObjectId[] {
    return []
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbAssocArrayActionBody')
    filer.writeInt32(90, this._classVersion)
    filer.writeString(1, this.parametersClassName)
    filer.writeInt32(90, this._parametersVersion)
    filer.writeInt32(90, this._items.length)
    filer.writeString(1, ITEM_CLASS_NAME)
    for (const item of this._items) {
      filer.writeSubclassMarker(ITEM_CLASS_NAME)
      filer.writeInt32(90, item.classVersion)
      filer.writeInt32(90, item.locator.itemIndex)
      filer.writeInt32(90, item.locator.rowIndex)
      filer.writeInt32(90, item.locator.levelIndex)
      const flags = item.persistedFlags
      filer.writeInt32(90, flags)
      const e = item.transform.elements
      if (item.isTranslationOnly) {
        filer.writePoint3d(11, { x: e[12], y: e[13], z: e[14] })
      } else {
        acdbAssocWriteMatrix(filer, e)
      }
      acdbAssocWriteId(filer, 330, item.entityId)
    }
    acdbAssocWriteMatrix(filer, this._arrayTransform.elements)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    const head = AcDbAssocDxfCursor.read(filer, 'AcDbAssocArrayActionBody')
    this._classVersion = head.int(90, 1)
    this._parametersClassName = head.string(1)
    this._parametersVersion = head.int()
    const count = head.int()
    head.string(1) // item class name
    this._items = []
    let tail = head
    for (let i = 0; i < count; i++) {
      if (!filer.atSubclassData(ITEM_CLASS_NAME)) break
      const c = AcDbAssocDxfCursor.read(filer)
      const item = new AcDbAssocArrayItem()
      item.classVersion = c.int()
      item.locator = new AcDbAssocArrayItemLocator(c.int(), c.int(), c.int())
      item.flags = c.int()
      if (c.peekCode() === 40) {
        item.transform = matrixFromRowMajor(c.doubles(16))
      } else if (c.peekCode() === 11) {
        const p = c.point(11)
        item.transform = AcGeMatrix3d.makeTranslation(p.x, p.y, p.z)
      }
      item.entityId = c.id([330, 360, 340])
      this._items.push(item)
      tail = c
    }
    if (tail.peekCode() === 40) {
      this._arrayTransform = matrixFromRowMajor(tail.doubles(16))
    }
    this._parameters = undefined
    return this
  }

  /**
   * Restores fields decoded from a DWG record.
   *
   * @internal
   */
  setFromDwg(data: AcDbAssocArrayActionBodyData): void {
    this._classVersion = data.classVersion
    this._parametersClassName = data.parametersClassName
    this._parametersVersion = data.parametersVersion
    this._items = data.items.map(raw => {
      const item = new AcDbAssocArrayItem(
        new AcDbAssocArrayItemLocator(
          raw.itemIndex,
          raw.rowIndex,
          raw.levelIndex
        ),
        matrixFromRowMajor(raw.matrix),
        raw.entityId
      )
      item.classVersion = raw.classVersion
      item.flags = raw.flags
      return item
    })
    this._arrayTransform = matrixFromRowMajor(data.arrayTransform)
    this._parameters = undefined
  }
}

/**
 * Returns the line segments of `curve` (WCS) when it is made only of straight
 * segments, for the `RowProfile` cached curve; otherwise `undefined`.
 */
export function acdbAssocLineSegmentsOf(
  curve: AcDbCurve
): AcDbAssocEdgeLineSegment[] | undefined {
  if (curve instanceof AcDbLine) {
    return [{ start: curve.startPoint.clone(), end: curve.endPoint.clone() }]
  }
  if (curve instanceof AcDbPolyline) {
    const n = curve.numberOfVertices
    const segCount = curve.closed ? n : n - 1
    const segments: AcDbAssocEdgeLineSegment[] = []
    for (let i = 0; i < segCount; i++) {
      if (Math.abs(curve.getBulgeAt(i)) > 1e-12) return undefined
      segments.push({
        start: curve.getPoint3dAt(i),
        end: curve.getPoint3dAt((i + 1) % n)
      })
    }
    return segments.length > 0 ? segments : undefined
  }
  return undefined
}

export type { AcDbAssocArrayPathEdgeRef }
