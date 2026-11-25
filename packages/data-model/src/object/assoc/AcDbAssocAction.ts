import { AcDbDxfFiler } from '../../base/AcDbDxfFiler.js'
import { AcDbObject, type AcDbObjectId } from '../../base/AcDbObject.js'
import type { AcDbTypedValue } from '../../base/AcDbTypedValue.js'
import type { AcDbDatabase } from '../../database/AcDbDatabase.js'
import { AcDbAssocActionBody } from './AcDbAssocActionBody.js'
import { AcDbAssocActionParam } from './AcDbAssocActionParam.js'
import { AcDbAssocDependency } from './AcDbAssocDependency.js'
import {
  AcDbAssocDxfCursor,
  acdbAssocNormalizeId,
  acdbAssocWriteId
} from './acdbAssocDxf.js'
import {
  AcDbAssocStatus,
  acdbAssocStatusNeedsEvaluation
} from './AcDbAssocStatus.js'
import {
  acdbAssocAddOwnedObject,
  acdbAssocEraseObject
} from './acdbAssocUtil.js'

/**
 * Unit type of an action value parameter (ObjectARX `AcValue::UnitType`).
 */
export enum AcDbAssocValueUnitType {
  Unitless = 0,
  Distance = 1,
  Angle = 2,
  Area = 4,
  Volume = 8
}

/**
 * One value of an action value parameter. `code` is the DXF group code of
 * the value (AutoCAD stores `AcDbEvalVariant` values with their resbuf type:
 * 40 = real, 90 = int32, 1 = string, …); `code` 0 means a null value.
 */
export interface AcDbAssocValueParamValue {
  code: number
  value: number | string
  /** Optional `AcDbAssocVariable` id driving this value (expression). */
  variableId: AcDbObjectId
}

/**
 * Named value parameter of an {@link AcDbAssocAction} (ObjectARX
 * `AcDbAssocAction::getValueParam` / `setValueParam`).
 */
export interface AcDbAssocValueParam {
  classVersion: number
  name: string
  unitType: AcDbAssocValueUnitType
  values: AcDbAssocValueParamValue[]
  /** Dependency on the object controlling the value, if any. */
  controlledObjectDependencyId: AcDbObjectId
}

/** Reference from an action to one of its dependencies. */
interface AcDbAssocDependencyRef {
  id: AcDbObjectId
  /** True when the action owns the dependency (DXF 360) vs soft (330). */
  isOwned: boolean
}

/**
 * Fields of an {@link AcDbAssocAction} decoded from a DWG record.
 */
export interface AcDbAssocActionData {
  classVersion: number
  status: number
  owningNetworkId: AcDbObjectId
  actionBodyId: AcDbObjectId
  actionIndex: number
  maxDependencyIndex: number
  dependencies: { id: AcDbObjectId; isOwned: boolean }[]
  ownedParamIds: AcDbObjectId[]
  valueParams: AcDbAssocValueParam[]
}

/**
 * Associative action that owns an {@link AcDbAssocActionBody}, a set of
 * {@link AcDbAssocDependency} objects, action parameters and named value
 * parameters (ObjectARX `AcDbAssocAction`).
 *
 * External code should not subclass this class; put custom logic in an
 * {@link AcDbAssocActionBody} subclass.
 *
 * DXF layout (`AcDbAssocAction` subclass, class version 2):
 * `90 ver, 90 status, 330 owningNetwork, 360 actionBody, 90 actionIndex,
 * 90 maxDependencyIndex, 90 n, (360 owned | 330 soft dependency)×n, 90 0,
 * 90 m, 360 ownedParam×m, 90 0, 90 k, valueParam×k` where a value param is
 * `90 ver, 1 name, 90 unitType, 90 v, (value, 330 variable)×v,
 * 330 controlledObjectDependency`.
 */
export class AcDbAssocAction extends AcDbObject {
  /** DXF/DWG record name. */
  static readonly DXF_NAME: string = 'ACDBASSOCACTION'

  private _classVersion = 2
  private _status: AcDbAssocStatus = AcDbAssocStatus.IsUpToDateAssocStatus
  private _owningNetworkId: AcDbObjectId = ''
  private _actionBodyId: AcDbObjectId = ''
  private _actionIndex = 0
  private _maxDependencyIndex = 0
  private _dependencies: AcDbAssocDependencyRef[] = []
  private _ownedParamIds: AcDbObjectId[] = []
  private _valueParams: AcDbAssocValueParam[] = []
  /**
   * Verbatim `AcDbAssocAction` pairs of a record that did not match the
   * layout this reader knows (e.g. an action of another AutoCAD feature with
   * value types not modeled here). Written back unchanged until the action is
   * modified, so foreign actions survive a round trip.
   */
  private _rawActionItems: AcDbTypedValue[] | undefined

  get actionBodyId(): AcDbObjectId {
    return this._actionBodyId
  }
  set actionBodyId(value: AcDbObjectId) {
    this._actionBodyId = value ?? ''
  }

  get dependencyIds(): readonly AcDbObjectId[] {
    return this._dependencies.map(dep => dep.id)
  }

  get status(): AcDbAssocStatus {
    return this._status
  }
  set status(value: AcDbAssocStatus) {
    this._status = value
  }

  /** Drops the verbatim record once the action is edited. */
  private markModified(): void {
    this._rawActionItems = undefined
  }

  /** Sets the status (ObjectARX `setStatus`). */
  setStatus(value: AcDbAssocStatus): void {
    this._status = value
  }

  /** Network this action belongs to (soft pointer). */
  get owningNetworkId(): AcDbObjectId {
    return this._owningNetworkId
  }
  set owningNetworkId(value: AcDbObjectId) {
    this.markModified()
    this._owningNetworkId = value ?? ''
  }

  /** Index of this action in its owning network. */
  get actionIndex(): number {
    return this._actionIndex
  }
  set actionIndex(value: number) {
    this.markModified()
    this._actionIndex = Math.trunc(value)
  }

  get maxDependencyIndex(): number {
    return this._maxDependencyIndex
  }

  get ownedParamIds(): readonly AcDbObjectId[] {
    return this._ownedParamIds
  }

  get needsEvaluation(): boolean {
    return acdbAssocStatusNeedsEvaluation(this._status)
  }

  /** True when the action body reports its driven objects are gone. */
  get isOrphaned(): boolean {
    return this.actionBody()?.isOrphaned() ?? false
  }

  setDirty(transitive = false): void {
    this._status = transitive
      ? AcDbAssocStatus.ChangedTransitivelyAssocStatus
      : AcDbAssocStatus.ChangedDirectlyAssocStatus
  }

  setUpToDate(): void {
    this._status = AcDbAssocStatus.IsUpToDateAssocStatus
  }

  /**
   * Returns the owned action body, if present in the database.
   */
  actionBody(db?: AcDbDatabase): AcDbAssocActionBody | undefined {
    const database = db ?? this.database
    if (!database || !this._actionBodyId) return undefined
    const obj = database.getObjectById(this._actionBodyId)
    return obj instanceof AcDbAssocActionBody ? obj : undefined
  }

  /**
   * Makes `body` the action body owned by this action
   * (ObjectARX `setActionBody`). This action must be database-resident.
   */
  setActionBody(body: AcDbAssocActionBody): void {
    const db = this.database
    if (!db) throw new Error('AcDbAssocAction.setActionBody: not in a database')
    acdbAssocAddOwnedObject(db, this, body)
    this.markModified()
    this._actionBodyId = body.objectId
  }

  // ---------------------------------------------------------------------------
  // Dependencies
  // ---------------------------------------------------------------------------

  /**
   * Adds a dependency (ObjectARX `addDependency`). A new dependency object is
   * made database-resident and owned by this action; it receives the next
   * dependency index.
   *
   * @param dependency - Dependency object, or the id of an existing one.
   * @param setThisActionAsOwningAction - Own the dependency (DXF 360).
   */
  addDependency(
    dependency: AcDbAssocDependency | AcDbObjectId,
    setThisActionAsOwningAction = true
  ): AcDbObjectId {
    const db = this.database
    let dep: AcDbAssocDependency | undefined
    if (typeof dependency === 'string') {
      const obj = db?.getObjectById(dependency)
      dep = obj instanceof AcDbAssocDependency ? obj : undefined
      if (!dep) {
        this.addDependencyId(dependency, setThisActionAsOwningAction)
        return dependency
      }
    } else {
      dep = dependency
    }
    if (setThisActionAsOwningAction && db) {
      acdbAssocAddOwnedObject(db, this, dep)
    }
    this._maxDependencyIndex += 1
    dep.dependencyIndex = this._maxDependencyIndex
    this.addDependencyId(dep.objectId, setThisActionAsOwningAction)
    return dep.objectId
  }

  /** Low-level: records a dependency id without touching the object. */
  addDependencyId(id: AcDbObjectId, isOwned = true): void {
    if (!id || this._dependencies.some(dep => dep.id === id)) return
    this.markModified()
    this._dependencies.push({ id, isOwned })
  }

  /** True when the action owns the dependency `id`. */
  isOwnedDependency(id: AcDbObjectId): boolean {
    return this._dependencies.some(dep => dep.id === id && dep.isOwned)
  }

  /**
   * Removes a dependency (ObjectARX `removeDependency`).
   *
   * @param alsoEraseIt - Also detach and erase the dependency object.
   */
  removeDependency(id: AcDbObjectId, alsoEraseIt = true): void {
    this.markModified()
    this._dependencies = this._dependencies.filter(dep => dep.id !== id)
    if (!alsoEraseIt) return
    const db = this.database
    const dep = db?.getObjectById(id)
    if (dep instanceof AcDbAssocDependency) {
      dep.detachFromObject()
      if (db) acdbAssocEraseObject(db, dep)
    }
  }

  /** Low-level alias kept for callers that only track ids. */
  removeDependencyId(id: AcDbObjectId): void {
    this.removeDependency(id, false)
  }

  /**
   * Returns dependencies present in the database
   * (ObjectARX `getDependencies`).
   *
   * @param readDependenciesWanted - Include read dependencies.
   * @param writeDependenciesWanted - Include write dependencies.
   */
  getDependencies(
    readDependenciesWanted = true,
    writeDependenciesWanted = true,
    db?: AcDbDatabase
  ): AcDbAssocDependency[] {
    return this.dependencies(db).filter(
      dep =>
        (readDependenciesWanted && dep.isReadDependency) ||
        (writeDependenciesWanted && dep.isWriteDependency)
    )
  }

  /**
   * Returns all dependencies present in the database.
   */
  dependencies(db?: AcDbDatabase): AcDbAssocDependency[] {
    const database = db ?? this.database
    if (!database) return []
    const result: AcDbAssocDependency[] = []
    for (const { id } of this._dependencies) {
      const obj = database.getObjectById(id)
      if (obj instanceof AcDbAssocDependency) result.push(obj)
    }
    return result
  }

  // ---------------------------------------------------------------------------
  // Action parameters (owned AcDbAssocActionParam objects)
  // ---------------------------------------------------------------------------

  /**
   * Adds an owned action parameter (ObjectARX `addParam`).
   */
  addParam(param: AcDbAssocActionParam): AcDbObjectId {
    const db = this.database
    if (!db) throw new Error('AcDbAssocAction.addParam: not in a database')
    acdbAssocAddOwnedObject(db, this, param)
    this.markModified()
    if (!this._ownedParamIds.includes(param.objectId)) {
      this._ownedParamIds.push(param.objectId)
    }
    return param.objectId
  }

  /** Removes and erases an owned action parameter. */
  removeParam(id: AcDbObjectId): void {
    this.markModified()
    this._ownedParamIds = this._ownedParamIds.filter(x => x !== id)
    const db = this.database
    if (db) acdbAssocEraseObject(db, db.getObjectById(id))
  }

  /** Owned action parameters present in the database. */
  ownedParams(db?: AcDbDatabase): AcDbAssocActionParam[] {
    const database = db ?? this.database
    if (!database) return []
    const result: AcDbAssocActionParam[] = []
    for (const id of this._ownedParamIds) {
      const obj = database.getObjectById(id)
      if (obj instanceof AcDbAssocActionParam) result.push(obj)
    }
    return result
  }

  /** Returns the owned action parameter named `name` (ObjectARX `paramAtName`). */
  paramAtName(
    name: string,
    db?: AcDbDatabase
  ): AcDbAssocActionParam | undefined {
    return this.ownedParams(db).find(param => param.name === name)
  }

  // ---------------------------------------------------------------------------
  // Value parameters
  // ---------------------------------------------------------------------------

  /** Names of all value parameters (ObjectARX `valueParamNames`). */
  valueParamNames(): string[] {
    return this._valueParams.map(param => param.name)
  }

  /** Full value-parameter record, if present. */
  valueParam(name: string): AcDbAssocValueParam | undefined {
    return this._valueParams.find(param => param.name === name)
  }

  /** All value parameters, in file order. */
  get valueParams(): readonly AcDbAssocValueParam[] {
    return this._valueParams
  }

  /**
   * Returns the (first) value of a value parameter
   * (ObjectARX `getValueParam`).
   */
  getValueParam(name: string, valueIndex = 0): number | string | undefined {
    return this.valueParam(name)?.values[valueIndex]?.value
  }

  /**
   * Sets a value parameter (ObjectARX `setValueParam`). Creates the parameter
   * when missing. Integers are stored as group 90, other numbers as group 40,
   * strings as group 1, unless `code` is given.
   */
  setValueParam(
    name: string,
    value: number | string | boolean,
    unitType?: AcDbAssocValueUnitType,
    code?: number
  ): void {
    this.markModified()
    const v = typeof value === 'boolean' ? (value ? 1 : 0) : value
    let param = this.valueParam(name)
    if (!param) {
      param = {
        classVersion: 0,
        name,
        unitType: unitType ?? AcDbAssocValueUnitType.Unitless,
        values: [],
        controlledObjectDependencyId: ''
      }
      this._valueParams.push(param)
    } else if (unitType !== undefined) {
      param.unitType = unitType
    }
    const existingCode = param.values[0]?.code
    let resolvedCode: number
    if (code !== undefined) resolvedCode = code
    else if (typeof v === 'string') resolvedCode = 1
    else if (existingCode === 90 && Number.isInteger(v)) resolvedCode = 90
    else if (
      existingCode !== undefined &&
      existingCode !== 90 &&
      existingCode !== 0
    )
      resolvedCode = existingCode
    else if (typeof value === 'boolean') resolvedCode = 90
    else resolvedCode = 40
    const entry: AcDbAssocValueParamValue = {
      code: resolvedCode,
      value: resolvedCode === 90 && typeof v === 'number' ? Math.trunc(v) : v,
      variableId: param.values[0]?.variableId ?? ''
    }
    param.values = [entry]
  }

  /** Unit type of a value parameter (ObjectARX `valueParamUnitType`). */
  valueParamUnitType(name: string): AcDbAssocValueUnitType | undefined {
    return this.valueParam(name)?.unitType
  }

  /** Removes a value parameter (ObjectARX `removeValueParam`). */
  removeValueParam(name: string): void {
    this.markModified()
    this._valueParams = this._valueParams.filter(param => param.name !== name)
  }

  // ---------------------------------------------------------------------------
  // Evaluation
  // ---------------------------------------------------------------------------

  /**
   * Evaluates this action by calling {@link AcDbAssocActionBody.evaluateOverride}.
   */
  evaluate(): void {
    const body = this.actionBody()
    if (!body) {
      this._status = AcDbAssocStatus.FailedToEvaluateAssocStatus
      return
    }
    try {
      body.evaluateOverride()
      // evaluateOverride may set FailedToEvaluateAssocStatus (e.g. missing
      // array/source block); do not clear that with setUpToDate().
      if (this._status === AcDbAssocStatus.FailedToEvaluateAssocStatus) {
        return
      }
      for (const dep of this.dependencies()) {
        dep.setUpToDate()
      }
      this.setUpToDate()
    } catch {
      this._status = AcDbAssocStatus.FailedToEvaluateAssocStatus
    }
  }

  /**
   * Erases this action together with its body, owned dependencies and owned
   * parameters, and removes it from its owning network.
   */
  eraseAction(): void {
    const db = this.database
    if (!db) return
    for (const ref of [...this._dependencies]) {
      if (ref.isOwned) this.removeDependency(ref.id, true)
    }
    for (const id of [...this._ownedParamIds]) this.removeParam(id)
    acdbAssocEraseObject(db, this.actionBody())
    const network = db.getObjectById(this._owningNetworkId) as
      | { removeAction?: (id: AcDbObjectId, alsoEraseIt?: boolean) => void }
      | undefined
    network?.removeAction?.(this.objectId, false)
    acdbAssocEraseObject(db, this)
  }

  override getHardOwnedObjectIds(): AcDbObjectId[] {
    const ids: AcDbObjectId[] = []
    if (this._actionBodyId) ids.push(this._actionBodyId)
    for (const dep of this._dependencies) if (dep.isOwned) ids.push(dep.id)
    ids.push(...this._ownedParamIds)
    return ids
  }

  // ---------------------------------------------------------------------------
  // DXF
  // ---------------------------------------------------------------------------

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbAssocAction')
    if (this._rawActionItems) {
      // Status (second pair) is kept current; the rest is verbatim.
      this._rawActionItems.forEach((item, index) =>
        filer.writeGroup(
          Number(item.code),
          index === 1 && Number(item.code) === 90 ? this._status : item.value
        )
      )
      return this
    }
    filer.writeInt32(90, this._classVersion)
    filer.writeInt32(90, this._status)
    acdbAssocWriteId(filer, 330, this._owningNetworkId)
    acdbAssocWriteId(filer, 360, this._actionBodyId)
    filer.writeInt32(90, this._actionIndex)
    filer.writeInt32(90, this._maxDependencyIndex)
    const deps = this._dependencies.filter(dep =>
      filer.isObjectIdWritten(dep.id)
    )
    filer.writeInt32(90, deps.length)
    for (const dep of deps) {
      filer.writeObjectId(dep.isOwned ? 360 : 330, dep.id)
    }
    filer.writeInt32(90, 0)
    const params = this._ownedParamIds.filter(id => filer.isObjectIdWritten(id))
    filer.writeInt32(90, params.length)
    for (const id of params) filer.writeObjectId(360, id)
    filer.writeInt32(90, 0)
    filer.writeInt32(90, this._valueParams.length)
    for (const param of this._valueParams) {
      filer.writeInt32(90, param.classVersion)
      filer.writeString(1, param.name)
      filer.writeInt32(90, param.unitType)
      filer.writeInt32(90, param.values.length)
      for (const value of param.values) {
        if (value.code !== 0) {
          filer.writeGroup(value.code, value.value)
        }
        acdbAssocWriteId(filer, 330, value.variableId)
      }
      acdbAssocWriteId(filer, 330, param.controlledObjectDependencyId)
    }
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    const c = AcDbAssocDxfCursor.read(filer, 'AcDbAssocAction')
    this.readActionFields(c)
    this._rawActionItems = c.isClean ? undefined : [...c.items]
    return this
  }

  /** Reads the positional `AcDbAssocAction` subclass data. */
  protected readActionFields(c: AcDbAssocDxfCursor): void {
    this._classVersion = c.int(90, 2)
    this._status = c.int() as AcDbAssocStatus
    this._owningNetworkId = c.id([330])
    this._actionBodyId = c.id([360, 330])
    this._actionIndex = c.int()
    this._maxDependencyIndex = c.int()
    const depCount = c.int()
    this._dependencies = []
    for (let i = 0; i < depCount; i++) {
      const ref = c.idWithCode()
      if (!ref) break
      if (ref.id)
        this._dependencies.push({ id: ref.id, isOwned: ref.code === 360 })
    }
    if (this._classVersion > 1) {
      c.int()
      const paramCount = c.int()
      this._ownedParamIds = []
      for (let i = 0; i < paramCount; i++) {
        const ref = c.idWithCode()
        if (!ref) break
        if (ref.id) this._ownedParamIds.push(ref.id)
      }
      c.int()
      const valueCount = c.int()
      this._valueParams = []
      for (let i = 0; i < valueCount && !c.atEnd; i++) {
        const classVersion = c.int()
        const name = c.string(1)
        const unitType = c.int() as AcDbAssocValueUnitType
        const n = c.int()
        const values: AcDbAssocValueParamValue[] = []
        for (let j = 0; j < n && !c.atEnd; j++) {
          let code = 0
          let value: number | string = 0
          if (c.peekCode() !== 330) {
            const item = c.next()!
            code = Number(item.code)
            const raw = item.value
            value =
              typeof raw === 'number'
                ? raw
                : typeof raw === 'boolean'
                  ? raw
                    ? 1
                    : 0
                  : String(raw ?? '')
          }
          const variableId = c.id([330])
          values.push({ code, value, variableId })
        }
        const controlledObjectDependencyId = c.id([330])
        this._valueParams.push({
          classVersion,
          name,
          unitType,
          values,
          controlledObjectDependencyId
        })
      }
    }
  }

  /**
   * Restores fields decoded from a DWG record.
   *
   * @internal
   */
  setActionFromDwg(data: AcDbAssocActionData): void {
    this.markModified()
    this._classVersion = data.classVersion
    this._status = data.status as AcDbAssocStatus
    this._owningNetworkId = acdbAssocNormalizeId(data.owningNetworkId)
    this._actionBodyId = acdbAssocNormalizeId(data.actionBodyId)
    this._actionIndex = data.actionIndex
    this._maxDependencyIndex = data.maxDependencyIndex
    this._dependencies = data.dependencies
      .map(dep => ({ id: acdbAssocNormalizeId(dep.id), isOwned: dep.isOwned }))
      .filter(dep => dep.id)
    this._ownedParamIds = data.ownedParamIds
      .map(acdbAssocNormalizeId)
      .filter(id => id)
    this._valueParams = data.valueParams.map(param => ({
      ...param,
      values: param.values.map(value => ({ ...value })),
      controlledObjectDependencyId: acdbAssocNormalizeId(
        param.controlledObjectDependencyId
      )
    }))
  }
}
