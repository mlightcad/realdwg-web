import {
  AcGeMatrix3d,
  AcGePoint3d,
  type AcGePoint3dLike,
  type AcGeVector3dLike
} from '@mlightcad/geometry-engine'

import { AcDbDxfFiler } from '../../base/AcDbDxfFiler.js'
import type { AcDbObjectId } from '../../base/AcDbObject.js'
import type { AcDbDatabase } from '../../database/AcDbDatabase.js'
import { AcDbBlockReference } from '../../entity/AcDbBlockReference.js'
import type { AcDbCurve } from '../../entity/AcDbCurve.js'
import { AcDbEntity } from '../../entity/AcDbEntity.js'
import { AcDbDictionary } from '../AcDbDictionary.js'
import { AcDbDictionaryVar } from '../AcDbDictionaryVar.js'
import { acdbCreateAnonymousUserBlock } from './acdbAllocateAnonymousUserBlockName.js'
import { AcDbAssocAction } from './AcDbAssocAction.js'
import { AcDbAssocActionBody } from './AcDbAssocActionBody.js'
import { AcDbAssocArrayCommonParameters } from './AcDbAssocArrayCommonParameters.js'
import { AcDbAssocArrayItemLocator } from './AcDbAssocArrayItemLocator.js'
import { AcDbAssocArrayParameters } from './AcDbAssocArrayParameters.js'
import {
  type AcDbAssocArrayPathEdgeRef,
  AcDbAssocArrayPathParameters
} from './AcDbAssocArrayPathParameters.js'
import { AcDbAssocArrayPolarParameters } from './AcDbAssocArrayPolarParameters.js'
import { AcDbAssocArrayRectangularParameters } from './AcDbAssocArrayRectangularParameters.js'
import { ACDB_ASSOC_ARRAY_ACTION_BODY } from './AcDbAssocConstants.js'
import { AcDbAssocDependency } from './AcDbAssocDependency.js'
import { AcDbAssocManager } from './AcDbAssocManager.js'
import { AcDbAssocStatus } from './AcDbAssocStatus.js'

export interface AcDbAssocArrayCreateResult {
  arrayEntityId: AcDbObjectId
  actionBodyId: AcDbObjectId
  actionId: AcDbObjectId
}

/**
 * Associative action body that evaluates an array of items from parameters
 * (ObjectARX `AcDbAssocArrayActionBody`).
 */
export class AcDbAssocArrayActionBody extends AcDbAssocActionBody {
  private _parameters: AcDbAssocArrayParameters | undefined
  private _arrayEntityId: AcDbObjectId = ''
  private _sourceBlockName = ''
  private _arrayBlockName = ''
  private _basePoint = new AcGePoint3d(0, 0, 0)
  /** Soft pointers of source entities cloned into the source BTR. */
  private _sourceEntityIds: AcDbObjectId[] = []

  get parameters(): AcDbAssocArrayParameters | undefined {
    return this._parameters
  }

  get sourceEntityIds(): readonly AcDbObjectId[] {
    return this._sourceEntityIds
  }

  setParameters(parameters: AcDbAssocArrayParameters): void {
    this._parameters = parameters
    parameters.ownerActionBodyId = this.objectId
  }

  get arrayEntityId(): AcDbObjectId {
    return this._arrayEntityId
  }
  set arrayEntityId(value: AcDbObjectId) {
    this._arrayEntityId = value ?? ''
  }

  get sourceBlockName(): string {
    return this._sourceBlockName
  }

  get arrayBlockName(): string {
    return this._arrayBlockName
  }

  get basePoint(): AcGePoint3d {
    return this._basePoint
  }
  set basePoint(value: AcGePoint3dLike) {
    this._basePoint.copy(value)
  }

  /**
   * Returns whether `entity` is the visible INSERT of an associative array.
   */
  static isAssociativeArray(
    entity: AcDbEntity,
    db?: AcDbDatabase
  ): boolean {
    return AcDbAssocArrayActionBody.getAssociativeArray(entity, db) != null
  }

  /**
   * Returns the action body that evaluates `entity`, if it is an associative
   * array INSERT.
   */
  static getAssociativeArray(
    entity: AcDbEntity,
    db?: AcDbDatabase
  ): AcDbAssocArrayActionBody | undefined {
    const database = db ?? entity.database
    if (!database) return undefined
    const extId = entity.extensionDictionary
    if (!extId) return undefined
    const ext = database.getObjectById(extId)
    if (!(ext instanceof AcDbDictionary)) return undefined
    const entry = ext.getAt(ACDB_ASSOC_ARRAY_ACTION_BODY)
    if (entry instanceof AcDbAssocArrayActionBody) return entry
    if (entry instanceof AcDbDictionaryVar) {
      const body = database.getObjectById(entry.value)
      if (body instanceof AcDbAssocArrayActionBody) return body
    }
    return undefined
  }

  /**
   * Creates an associative array from source entities
   * (`AcDbAssocArrayActionBody::createInstance`).
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

    if (parameters instanceof AcDbAssocArrayPathParameters) {
      const pathId = parameters.path?.entityId
      if (!pathId || !db.getObjectById(pathId)) {
        throw new Error(
          'AcDbAssocArrayActionBody.createInstance: path parameters require a path curve entity'
        )
      }
    }

    const sourceBtr = acdbCreateAnonymousUserBlock(db)
    const arrayBtr = acdbCreateAnonymousUserBlock(db)

    // Move / clone sources into the source BTR, translated so base → origin.
    const toOrigin = AcGeMatrix3d.makeTranslation(-base.x, -base.y, -base.z)
    const sourceIds: AcDbObjectId[] = []
    for (const id of sourceEntityIds) {
      const entity = db.getObjectById(id)
      if (!(entity instanceof AcDbEntity)) continue
      const copy = entity.getTransformedCopy(toOrigin)
      sourceBtr.appendEntity(copy)
      sourceIds.push(copy.objectId)
      entity.erase()
    }

    if (sourceIds.length === 0) {
      db.tables.blockTable.remove(sourceBtr.name)
      db.tables.blockTable.remove(arrayBtr.name)
      throw new Error(
        'AcDbAssocArrayActionBody.createInstance: no valid source entities'
      )
    }

    const arrayInsert = new AcDbBlockReference(arrayBtr.name)
    arrayInsert.position = base
    db.tables.blockTable.modelSpace.appendEntity(arrayInsert)

    const body = new AcDbAssocArrayActionBody()
    body._arrayEntityId = arrayInsert.objectId
    body._sourceBlockName = sourceBtr.name
    body._arrayBlockName = arrayBtr.name
    body._basePoint.copy(base)
    body._sourceEntityIds = [...sourceIds]
    body.setParameters(parameters)

    if (parameters instanceof AcDbAssocArrayPathParameters) {
      const pathId = parameters.path!.entityId
      const pathEntity = db.getObjectById(pathId)
      if (pathEntity) parameters.setPathCurve(pathEntity as AcDbCurve)
      parameters.basePoint = base
    }
    if (parameters instanceof AcDbAssocArrayPolarParameters) {
      // Hosts must set `parameters.center` (polar orbit center) before calling
      // createInstance. `base` is the source/array base point (first item).
      parameters.basePoint = base
    }

    const action = new AcDbAssocAction()
    const bodyKey = `*AB${db.objects.assocActionBody.numEntries + 1}`
    const actionKey = `*AA${db.objects.assocAction.numEntries + 1}`
    db.objects.assocActionBody.setAt(bodyKey, body)
    db.objects.assocAction.setAt(actionKey, action)
    action.actionBodyId = body.objectId
    body.parentActionId = action.objectId

    const network = AcDbAssocManager.getTopLevelNetwork(db, true)!
    network.addAction(action.objectId)
    action.owningNetworkId = network.objectId

    // Dependencies: write on array INSERT; read on path when present.
    const writeDep = new AcDbAssocDependency()
    writeDep.dependentOnObjectId = arrayInsert.objectId
    writeDep.isReadDependency = false
    writeDep.isWriteDependency = true
    writeDep.owningActionId = action.objectId
    db.objects.assocDependency.setAt(
      `*AD${db.objects.assocDependency.numEntries + 1}`,
      writeDep
    )
    action.addDependencyId(writeDep.objectId)

    if (parameters instanceof AcDbAssocArrayPathParameters) {
      const pathRef: AcDbAssocArrayPathEdgeRef | undefined = parameters.path
      if (pathRef?.entityId) {
        const readDep = new AcDbAssocDependency()
        readDep.dependentOnObjectId = pathRef.entityId
        readDep.isReadDependency = true
        readDep.isWriteDependency = false
        readDep.owningActionId = action.objectId
        db.objects.assocDependency.setAt(
          `*AD${db.objects.assocDependency.numEntries + 1}`,
          readDep
        )
        action.addDependencyId(readDep.objectId)
      }
    }

    // Link INSERT → action body via extension dictionary soft pointer.
    const extId = arrayInsert.createExtensionDictionary()
    if (extId) {
      const ext = db.getObjectById(extId)
      if (ext instanceof AcDbDictionary) {
        const marker = new AcDbDictionaryVar()
        marker.value = body.objectId
        ext.setAt(ACDB_ASSOC_ARRAY_ACTION_BODY, marker)
      }
    }

    action.setDirty()
    body.evaluateOverride()
    action.setUpToDate()

    return {
      arrayEntityId: arrayInsert.objectId,
      actionBodyId: body.objectId,
      actionId: action.objectId
    }
  }

  /**
   * Returns the transform for one array item.
   */
  getTransform(locator: AcDbAssocArrayItemLocator): AcGeMatrix3d {
    if (!this._parameters) return new AcGeMatrix3d()
    this.bindPathCurve()
    return this._parameters.getItemTransform(locator)
  }

  private bindPathCurve(): void {
    if (!(this._parameters instanceof AcDbAssocArrayPathParameters)) return
    const db = this.database
    const pathId = this._parameters.path?.entityId
    if (!db || !pathId) return
    const entity = db.getObjectById(pathId)
    if (entity) this._parameters.setPathCurve(entity as AcDbCurve)
  }

  /**
   * Rebuilds every item INSERT inside the array anonymous block.
   */
  override evaluateOverride(): void {
    const db = this.database
    if (!db || !this._parameters) {
      return
    }
    this.bindPathCurve()

    const arrayBtr = db.tables.blockTable.getAt(this._arrayBlockName)
    const sourceBtr = db.tables.blockTable.getAt(this._sourceBlockName)
    if (!arrayBtr || !sourceBtr) {
      const action = db.getObjectById(this.parentActionId)
      if (action instanceof AcDbAssocAction) {
        action.status = AcDbAssocStatus.FailedToEvaluateAssocStatus
      }
      return
    }

    // Clear previous items.
    const existingIds: AcDbObjectId[] = []
    for (const ent of arrayBtr.newIterator()) {
      existingIds.push(ent.objectId)
    }
    if (existingIds.length > 0) arrayBtr.removeEntity(existingIds)

    for (const locator of this._parameters.getItemLocators()) {
      const matrix = this._parameters.getItemTransform(locator)
      const item = new AcDbBlockReference(this._sourceBlockName)
      // Decompose translation + Z rotation from the matrix when possible.
      const e = matrix.elements
      // Column-major: translation in e[12], e[13], e[14]
      item.position = new AcGePoint3d(e[12], e[13], e[14])
      const rot = Math.atan2(e[1], e[0])
      if (Number.isFinite(rot) && Math.abs(rot) > 1e-12) {
        item.rotation = rot
      }
      // Skip identity item still needed (column 0,row 0,level 0).
      arrayBtr.appendEntity(item)
    }
  }

  /**
   * Updates common count/spacing and marks the owning action dirty.
   */
  setRowColumnLevel(
    rows?: number,
    columns?: number,
    levels?: number
  ): void {
    if (!(this._parameters instanceof AcDbAssocArrayCommonParameters)) return
    if (rows != null) this._parameters.rowCount = rows
    if (columns != null) this._parameters.columnCount = columns
    if (levels != null) this._parameters.levelCount = levels
    this.markDirty()
  }

  markDirty(): void {
    const db = this.database
    if (!db) return
    const action = db.getObjectById(this.parentActionId)
    if (action instanceof AcDbAssocAction) action.setDirty()
  }

  /**
   * Grip indices for associative-array INSERTs (beyond the insertion point):
   * - `0` — insertion / base point
   * - `1` — primary-axis count grip (columns / items)
   * - `2` — secondary-axis count grip (rows), rectangular only
   */
  static readonly GRIP_BASE = 0
  static readonly GRIP_PRIMARY = 1
  static readonly GRIP_SECONDARY = 2

  /**
   * Returns WCS grip points for the associative-array INSERT `ref`.
   */
  getGripPoints(ref: AcDbBlockReference): AcGePoint3d[] {
    const base = ref.position.clone()
    const grips = [base]
    if (!this._parameters) return grips

    if (this._parameters instanceof AcDbAssocArrayRectangularParameters) {
      const cols = Math.max(1, this._parameters.columnCount)
      const rows = Math.max(1, this._parameters.rowCount)
      const lastCol = this._parameters.getItemTransform(
        new AcDbAssocArrayItemLocator(cols - 1, 0, 0)
      )
      const lastRow = this._parameters.getItemTransform(
        new AcDbAssocArrayItemLocator(0, rows - 1, 0)
      )
      grips.push(
        new AcGePoint3d(
          base.x + lastCol.elements[12],
          base.y + lastCol.elements[13],
          base.z + lastCol.elements[14]
        ),
        new AcGePoint3d(
          base.x + lastRow.elements[12],
          base.y + lastRow.elements[13],
          base.z + lastRow.elements[14]
        )
      )
      return grips
    }

    if (this._parameters instanceof AcDbAssocArrayPolarParameters) {
      const items = Math.max(1, this._parameters.itemCount)
      const last = this._parameters.getItemTransform(
        new AcDbAssocArrayItemLocator(items - 1, 0, 0)
      )
      grips.push(
        new AcGePoint3d(
          base.x + last.elements[12],
          base.y + last.elements[13],
          base.z + last.elements[14]
        )
      )
      return grips
    }

    if (this._parameters instanceof AcDbAssocArrayPathParameters) {
      this.bindPathCurve()
      const items = Math.max(1, this._parameters.itemCount)
      const last = this._parameters.getItemTransform(
        new AcDbAssocArrayItemLocator(items - 1, 0, 0)
      )
      grips.push(
        new AcGePoint3d(
          base.x + last.elements[12],
          base.y + last.elements[13],
          base.z + last.elements[14]
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
    const dx = offset.x ?? 0
    const dy = offset.y ?? 0
    const dz = offset.z ?? 0

    for (const index of indices) {
      if (index === AcDbAssocArrayActionBody.GRIP_BASE) {
        ref.position = new AcGePoint3d(
          ref.position.x + dx,
          ref.position.y + dy,
          ref.position.z + dz
        )
        this._basePoint.copy(ref.position)
        if (this._parameters instanceof AcDbAssocArrayPolarParameters) {
          // Translate center with the base so the orbit radius is preserved.
          const c = this._parameters.center
          this._parameters.center = new AcGePoint3d(c.x + dx, c.y + dy, c.z + dz)
          this._parameters.basePoint = this._basePoint
        }
        if (this._parameters instanceof AcDbAssocArrayPathParameters) {
          this._parameters.basePoint = this._basePoint
        }
        continue
      }

      if (
        this._parameters instanceof AcDbAssocArrayRectangularParameters &&
        index === AcDbAssocArrayActionBody.GRIP_PRIMARY
      ) {
        const spacing = Math.max(1e-9, Math.abs(this._parameters.columnSpacing))
        const projected = this._parameters.columnSpacing >= 0 ? dx : -dx
        const delta = Math.round(projected / spacing)
        this._parameters.columnCount = Math.max(
          1,
          this._parameters.columnCount + delta
        )
        this.markDirty()
      } else if (
        this._parameters instanceof AcDbAssocArrayRectangularParameters &&
        index === AcDbAssocArrayActionBody.GRIP_SECONDARY
      ) {
        const spacing = Math.max(1e-9, Math.abs(this._parameters.rowSpacing))
        const projected = this._parameters.rowSpacing >= 0 ? dy : -dy
        const delta = Math.round(projected / spacing)
        this._parameters.rowCount = Math.max(
          1,
          this._parameters.rowCount + delta
        )
        this.markDirty()
      } else if (
        this._parameters instanceof AcDbAssocArrayPolarParameters &&
        index === AcDbAssocArrayActionBody.GRIP_PRIMARY
      ) {
        const angleStep = Math.max(1e-9, Math.abs(this._parameters.angleBetweenItems))
        const c = this._parameters.center
        const b = this._parameters.basePoint
        const r = Math.hypot(b.x - c.x, b.y - c.y)
        const arcStep = Math.max(1e-9, r * angleStep)
        const delta = Math.round(Math.hypot(dx, dy) / arcStep)
        const sign = dx + dy >= 0 ? 1 : -1
        this._parameters.itemCount = Math.max(
          1,
          this._parameters.itemCount + sign * Math.max(0, delta)
        )
        this.markDirty()
      } else if (
        this._parameters instanceof AcDbAssocArrayPathParameters &&
        index === AcDbAssocArrayActionBody.GRIP_PRIMARY
      ) {
        const spacing = Math.max(1e-9, Math.abs(this._parameters.itemSpacing))
        const delta = Math.round(Math.hypot(dx, dy) / spacing)
        const sign = dx + dy >= 0 ? 1 : -1
        this._parameters.itemCount = Math.max(
          1,
          this._parameters.itemCount + sign * Math.max(0, delta)
        )
        this.markDirty()
      }
    }

    this.evaluateOverride()
    const db = this.database
    if (db) {
      const action = db.getObjectById(this.parentActionId)
      if (action instanceof AcDbAssocAction) action.setUpToDate()
    }
  }

  /**
   * Explodes this associative array into independent entity copies and removes
   * the associative action graph (AutoCAD EXPLODE on an associative array).
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
    const db = this.database
    if (!db || !this._parameters) return undefined
    this.bindPathCurve()

    const sourceBtr = db.tables.blockTable.getAt(this._sourceBlockName)
    if (!sourceBtr) return undefined

    const created: AcDbEntity[] = []
    for (const locator of this._parameters.getItemLocators()) {
      const itemMatrix = this._parameters.getItemTransform(locator)
      const world = insertTransform.clone().multiply(itemMatrix)
      for (const source of sourceBtr.newIterator()) {
        created.push(source.getTransformedCopy(world))
      }
    }

    this.disassociate()
    return created
  }

  /**
   * Removes this action body, its action, and dependencies from the database
   * associative network, and clears the INSERT extension-dictionary marker.
   */
  disassociate(): void {
    const db = this.database
    if (!db) return

    const arrayEntity = db.getObjectById(this._arrayEntityId)
    if (arrayEntity instanceof AcDbEntity) {
      const extId = arrayEntity.extensionDictionary
      if (extId) {
        const ext = db.getObjectById(extId)
        if (ext instanceof AcDbDictionary) {
          ext.remove(ACDB_ASSOC_ARRAY_ACTION_BODY)
        }
      }
    }

    const action = db.getObjectById(this.parentActionId)
    if (action instanceof AcDbAssocAction) {
      for (const depId of [...action.dependencyIds]) {
        for (const [key, dep] of db.objects.assocDependency.entries()) {
          if (dep.objectId === depId) {
            db.objects.assocDependency.remove(key)
            break
          }
        }
      }
      const network = AcDbAssocManager.getTopLevelNetwork(db, false)
      if (network) network.removeAction(action.objectId)
      for (const [key, act] of db.objects.assocAction.entries()) {
        if (act.objectId === action.objectId) {
          db.objects.assocAction.remove(key)
          break
        }
      }
    }

    for (const [key, body] of db.objects.assocActionBody.entries()) {
      if (body.objectId === this.objectId) {
        db.objects.assocActionBody.remove(key)
        break
      }
    }
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeString(100, 'AcDbAssocArrayActionBody')
    filer.writeObjectId(330, this._arrayEntityId)
    filer.writeString(1, this._sourceBlockName)
    filer.writeString(2, this._arrayBlockName)
    filer.writePoint3d(10, this._basePoint)
    const json = this._parameters ? JSON.stringify(this._parameters.toJSON()) : ''
    filer.writeString(300, json)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    filer.atSubclassData('AcDbAssocArrayActionBody')

    while (!filer.atEndOfObject && !filer.atEof && !filer.atExtendedData) {
      const item = filer.readItem()
      if (!item) break
      const code = Number(item.code)
      if (code === 100) {
        filer.pushBackItem(item)
        break
      }
      switch (code) {
        case 330:
          this._arrayEntityId = String(item.value ?? '')
          break
        case 1:
          this._sourceBlockName = String(item.value ?? '')
          break
        case 2:
          this._arrayBlockName = String(item.value ?? '')
          break
        case 10: {
          const p = item.value as AcGePoint3dLike
          this._basePoint.copy(p)
          break
        }
        case 300: {
          const raw = String(item.value ?? '')
          if (raw) {
            try {
              const data = JSON.parse(raw) as Record<string, unknown>
              this._parameters = acdbAssocArrayParametersFromJSON(data)
              if (this._parameters) {
                this._parameters.ownerActionBodyId = this.objectId
              }
            } catch {
              this._parameters = undefined
            }
          }
          break
        }
        default:
          break
      }
    }
    return this
  }
}

/**
 * Reconstructs a parameters object from {@link AcDbAssocArrayParameters.toJSON}.
 */
export function acdbAssocArrayParametersFromJSON(
  data: Record<string, unknown>
): AcDbAssocArrayParameters | undefined {
  const type = data.type
  let params: AcDbAssocArrayParameters
  if (type === 'polar') {
    params = new AcDbAssocArrayPolarParameters()
  } else if (type === 'path') {
    params = new AcDbAssocArrayPathParameters()
  } else if (type === 'rectangular') {
    params = new AcDbAssocArrayRectangularParameters()
  } else {
    return undefined
  }
  params.fromJSON(data)
  return params
}
