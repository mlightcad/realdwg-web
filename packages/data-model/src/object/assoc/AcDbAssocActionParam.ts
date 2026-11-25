import { AcDbDxfFiler } from '../../base/AcDbDxfFiler.js'
import { AcDbObject, type AcDbObjectId } from '../../base/AcDbObject.js'
import type { AcDbTypedValue } from '../../base/AcDbTypedValue.js'
import type { AcDbDatabase } from '../../database/AcDbDatabase.js'
import { AcDbAssocDependency } from './AcDbAssocDependency.js'
import { AcDbAssocDxfCursor, acdbAssocWriteId } from './acdbAssocDxf.js'

/**
 * Base class of named parameters owned by an {@link AcDbAssocAction}
 * (ObjectARX `AcDbAssocActionParam`).
 *
 * DXF layout (`AcDbAssocActionParam` subclass): `90 classVersion (1),
 * 90 0, 1 name`.
 */
export class AcDbAssocActionParam extends AcDbObject {
  /** DXF/DWG record name. */
  static readonly DXF_NAME: string = 'ACDBASSOCACTIONPARAM'

  private _paramClassVersion = 1
  private _paramFlags = 0
  private _name = ''

  constructor(name = '') {
    super()
    this._name = name
  }

  /** Parameter name (e.g. `Origin`, `BaseNormal`, `RowProfile`). */
  get name(): string {
    return this._name
  }
  set name(value: string) {
    this._name = value ?? ''
  }

  /** Owning action id (the DXF owner handle). */
  get owningActionId(): AcDbObjectId {
    return this.ownerId
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbAssocActionParam')
    filer.writeInt32(90, this._paramClassVersion)
    filer.writeInt32(90, this._paramFlags)
    filer.writeString(1, this._name)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    const c = AcDbAssocDxfCursor.read(filer, 'AcDbAssocActionParam')
    this._paramClassVersion = c.int(90, 1)
    this._paramFlags = c.int()
    this._name = c.string(1)
    return this
  }

  /** @internal Restores base fields decoded from DWG. */
  setParamFromDwg(data: { classVersion: number; flags: number; name: string }) {
    this._paramClassVersion = data.classVersion
    this._paramFlags = data.flags
    this._name = data.name
  }
}

/**
 * Action parameter that keeps one {@link AcDbAssocDependency}
 * (ObjectARX `AcDbAssocSingleDependencyActionParam`).
 *
 * DXF layout: `100 AcDbAssocSingleDependencyActionParam, 90 0,
 * 330 dependency`.
 */
export class AcDbAssocSingleDependencyActionParam extends AcDbAssocActionParam {
  static override readonly DXF_NAME: string =
    'ACDBASSOCSINGLEDEPENDENCYACTIONPARAM'

  private _singleDepClassVersion = 0
  private _dependencyId: AcDbObjectId = ''

  /** Id of the dependency this parameter uses (may be empty). */
  get dependencyId(): AcDbObjectId {
    return this._dependencyId
  }
  set dependencyId(value: AcDbObjectId) {
    this._dependencyId = value ?? ''
  }

  /** The dependency object, if resident. */
  dependency(db?: AcDbDatabase): AcDbAssocDependency | undefined {
    const database = db ?? this.database
    if (!database || !this._dependencyId) return undefined
    const obj = database.getObjectById(this._dependencyId)
    return obj instanceof AcDbAssocDependency ? obj : undefined
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbAssocSingleDependencyActionParam')
    filer.writeInt32(90, this._singleDepClassVersion)
    acdbAssocWriteId(filer, 330, this._dependencyId)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    const c = AcDbAssocDxfCursor.read(
      filer,
      'AcDbAssocSingleDependencyActionParam'
    )
    this._singleDepClassVersion = c.int()
    this._dependencyId = c.id([330, 360])
    return this
  }

  /** @internal Restores single-dependency fields decoded from DWG. */
  setSingleDependencyFromDwg(data: {
    classVersion: number
    dependencyId: AcDbObjectId
  }) {
    this._singleDepClassVersion = data.classVersion
    this._dependencyId = data.dependencyId
  }
}

/**
 * Writes raw pairs captured by {@link AcDbAssocDxfCursor.rest}.
 *
 * @internal
 */
export function acdbAssocWriteRawItems(
  filer: AcDbDxfFiler,
  items: readonly AcDbTypedValue[]
): void {
  for (const item of items) {
    filer.writeGroup(Number(item.code), item.value)
  }
}
