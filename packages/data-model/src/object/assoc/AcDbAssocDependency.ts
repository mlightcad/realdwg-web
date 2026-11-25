import { AcDbDxfFiler } from '../../base/AcDbDxfFiler.js'
import { AcDbObject, type AcDbObjectId } from '../../base/AcDbObject.js'
import type { AcDbDatabase } from '../../database/AcDbDatabase.js'
import { AcDbAssocDxfCursor, acdbAssocWriteId } from './acdbAssocDxf.js'
import {
  AcDbAssocStatus,
  acdbAssocStatusNeedsEvaluation
} from './AcDbAssocStatus.js'

/**
 * Fields of an {@link AcDbAssocDependency} decoded from a DWG record.
 */
export interface AcDbAssocDependencyData {
  classVersion: number
  status: number
  isReadDependency: boolean
  isWriteDependency: boolean
  isAttachedToObject: boolean
  isDelegatingToOwningAction: boolean
  order: number
  name: string
  dependentOnObjectId: AcDbObjectId
  prevDependencyOnObjectId?: AcDbObjectId
  nextDependencyOnObjectId?: AcDbObjectId
  dependencyBodyId: AcDbObjectId
  dependencyIndex: number
}

/**
 * Records that an {@link AcDbAssocAction} reads and/or writes an `AcDbObject`
 * (ObjectARX `AcDbAssocDependency`).
 *
 * The dependency is owned by its action (DXF owner handle). When attached to
 * its object it is a persistent reactor of that object, which is how AutoCAD
 * finds the actions that depend on an entity (`102 {ACAD_REACTORS`).
 *
 * DXF layout (`AcDbAssocDependency` subclass, class version 2):
 * `90 ver, 90 status, 290 isRead, 290 isWrite, 290 isAttached,
 * 290 isDelegating, 90 order, 330 dependentOn, 290 hasName, [1 name],
 * 330 prevDependencyOnObject, 330 nextDependencyOnObject, 360 dependencyBody,
 * 90 dependencyIndex`.
 */
export class AcDbAssocDependency extends AcDbObject {
  /** DXF/DWG record name. */
  static readonly DXF_NAME = 'ACDBASSOCDEPENDENCY'

  private _classVersion = 2
  private _status: AcDbAssocStatus = AcDbAssocStatus.IsUpToDateAssocStatus
  private _isReadDependency = true
  private _isWriteDependency = false
  private _isAttachedToObject = false
  private _isDelegatingToOwningAction = false
  private _order = 0
  private _dependentOnObjectId: AcDbObjectId = ''
  private _name = ''
  private _prevDependencyOnObjectId: AcDbObjectId = ''
  private _nextDependencyOnObjectId: AcDbObjectId = ''
  private _dependencyBodyId: AcDbObjectId = ''
  private _dependencyIndex = 0

  /** Object id of the object this dependency depends on. */
  get dependentOnObjectId(): AcDbObjectId {
    return this._dependentOnObjectId
  }
  set dependentOnObjectId(value: AcDbObjectId) {
    this._dependentOnObjectId = value ?? ''
  }

  get isReadDependency(): boolean {
    return this._isReadDependency
  }
  set isReadDependency(value: boolean) {
    this._isReadDependency = !!value
  }

  get isWriteDependency(): boolean {
    return this._isWriteDependency
  }
  set isWriteDependency(value: boolean) {
    this._isWriteDependency = !!value
  }

  /** True when this dependency is a persistent reactor of its object. */
  get isAttachedToObject(): boolean {
    return this._isAttachedToObject
  }

  get isDelegatingToOwningAction(): boolean {
    return this._isDelegatingToOwningAction
  }
  set isDelegatingToOwningAction(value: boolean) {
    this._isDelegatingToOwningAction = !!value
  }

  /**
   * Evaluation order among dependencies on the same object. AutoCAD uses
   * `-2147483648` for the array INSERT dependency of an associative array.
   */
  get order(): number {
    return this._order
  }
  set order(value: number) {
    this._order = Math.trunc(value) | 0
  }

  get name(): string {
    return this._name
  }
  set name(value: string) {
    this._name = value ?? ''
  }

  get status(): AcDbAssocStatus {
    return this._status
  }
  set status(value: AcDbAssocStatus) {
    this._status = value
  }

  /** Index assigned by the owning action ({@link AcDbAssocAction.addDependency}). */
  get dependencyIndex(): number {
    return this._dependencyIndex
  }
  set dependencyIndex(value: number) {
    this._dependencyIndex = Math.trunc(value)
  }

  get dependencyBodyId(): AcDbObjectId {
    return this._dependencyBodyId
  }
  set dependencyBodyId(value: AcDbObjectId) {
    this._dependencyBodyId = value ?? ''
  }

  get prevDependencyOnObjectId(): AcDbObjectId {
    return this._prevDependencyOnObjectId
  }

  get nextDependencyOnObjectId(): AcDbObjectId {
    return this._nextDependencyOnObjectId
  }

  /** Owning action id (the DXF owner handle). */
  get owningActionId(): AcDbObjectId {
    return this.ownerId
  }
  set owningActionId(value: AcDbObjectId) {
    this.ownerId = value ?? ''
  }

  get needsEvaluation(): boolean {
    return acdbAssocStatusNeedsEvaluation(this._status)
  }

  /**
   * Returns the object this dependency depends on, if resident.
   */
  dependentOnObject(db?: AcDbDatabase): AcDbObject | undefined {
    const database = db ?? this.database
    if (!database || !this._dependentOnObjectId) return undefined
    return database.getObjectById(this._dependentOnObjectId)
  }

  /**
   * Makes this dependency depend on `objectId` and attaches it to the object
   * as a persistent reactor (ObjectARX `attachToObject`).
   */
  attachToObject(objectId: AcDbObjectId, object?: AcDbObject): void {
    this.detachFromObject()
    this._dependentOnObjectId = objectId ?? ''
    // `object` lets callers attach to an object that is not resident yet
    // (e.g. an INSERT appended right after its reactors are set).
    const target = object ?? this.dependentOnObject()
    if (target) {
      // Maintain AutoCAD's prev/next chain of dependencies on one object.
      const db = this.database
      for (const reactorId of target.getPersistentReactors()) {
        const other = db?.getObjectById(reactorId)
        if (
          other instanceof AcDbAssocDependency &&
          other !== this &&
          !other._nextDependencyOnObjectId
        ) {
          other._nextDependencyOnObjectId = this.objectId
          this._prevDependencyOnObjectId = other.objectId
        }
      }
      target.addPersistentReactor(this.objectId)
    }
    this._isAttachedToObject = !!this._dependentOnObjectId
  }

  /** Removes this dependency from its object's persistent reactors. */
  detachFromObject(): void {
    const target = this.dependentOnObject()
    if (target) target.removePersistentReactor(this.objectId)
    const db = this.database
    const prev = this._prevDependencyOnObjectId
      ? db?.getObjectById(this._prevDependencyOnObjectId)
      : undefined
    const next = this._nextDependencyOnObjectId
      ? db?.getObjectById(this._nextDependencyOnObjectId)
      : undefined
    if (prev instanceof AcDbAssocDependency) {
      prev._nextDependencyOnObjectId = this._nextDependencyOnObjectId
    }
    if (next instanceof AcDbAssocDependency) {
      next._prevDependencyOnObjectId = this._prevDependencyOnObjectId
    }
    this._prevDependencyOnObjectId = ''
    this._nextDependencyOnObjectId = ''
    this._isAttachedToObject = false
  }

  /**
   * Re-adds the persistent reactor on the dependent-on object after loading
   * (the DWG converter does not carry reactors; DXF does).
   */
  relinkReactor(): void {
    if (!this._isAttachedToObject) return
    this.dependentOnObject()?.addPersistentReactor(this.objectId)
  }

  /**
   * Marks this dependency dirty.
   */
  setDirty(transitive = false): void {
    this._status = transitive
      ? AcDbAssocStatus.ChangedTransitivelyAssocStatus
      : AcDbAssocStatus.ChangedDirectlyAssocStatus
  }

  setUpToDate(): void {
    this._status = AcDbAssocStatus.IsUpToDateAssocStatus
  }

  override getHardOwnedObjectIds(): AcDbObjectId[] {
    return this._dependencyBodyId ? [this._dependencyBodyId] : []
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbAssocDependency')
    filer.writeInt32(90, this._classVersion)
    filer.writeInt32(90, this._status)
    filer.writeBoolean(290, this._isReadDependency)
    filer.writeBoolean(290, this._isWriteDependency)
    filer.writeBoolean(290, this._isAttachedToObject)
    filer.writeBoolean(290, this._isDelegatingToOwningAction)
    filer.writeInt32(90, this._order)
    acdbAssocWriteId(filer, 330, this._dependentOnObjectId)
    filer.writeBoolean(290, this._name !== '')
    if (this._name) filer.writeString(1, this._name)
    acdbAssocWriteId(filer, 330, this._prevDependencyOnObjectId)
    acdbAssocWriteId(filer, 330, this._nextDependencyOnObjectId)
    acdbAssocWriteId(filer, 360, this._dependencyBodyId)
    filer.writeInt32(90, this._dependencyIndex)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    const c = AcDbAssocDxfCursor.read(filer, 'AcDbAssocDependency')
    this._classVersion = c.int(90, 2)
    this._status = c.int() as AcDbAssocStatus
    this._isReadDependency = c.bool()
    this._isWriteDependency = c.bool()
    this._isAttachedToObject = c.bool()
    this._isDelegatingToOwningAction = c.bool()
    this._order = c.int()
    this._dependentOnObjectId = c.id([330])
    const hasName = c.bool()
    this._name = hasName ? c.string(1) : ''
    this._prevDependencyOnObjectId = c.id([330])
    this._nextDependencyOnObjectId = c.id([330])
    this._dependencyBodyId = c.id([360, 330])
    this._dependencyIndex = c.int()
    return this
  }

  /**
   * Restores fields decoded from a DWG record.
   *
   * @internal
   */
  setFromDwg(data: AcDbAssocDependencyData): void {
    this._classVersion = data.classVersion
    this._status = data.status as AcDbAssocStatus
    this._isReadDependency = data.isReadDependency
    this._isWriteDependency = data.isWriteDependency
    this._isAttachedToObject = data.isAttachedToObject
    this._isDelegatingToOwningAction = data.isDelegatingToOwningAction
    this._order = data.order
    this._name = data.name
    this._dependentOnObjectId = data.dependentOnObjectId
    this._prevDependencyOnObjectId = data.prevDependencyOnObjectId ?? ''
    this._nextDependencyOnObjectId = data.nextDependencyOnObjectId ?? ''
    this._dependencyBodyId = data.dependencyBodyId
    this._dependencyIndex = data.dependencyIndex
  }
}
