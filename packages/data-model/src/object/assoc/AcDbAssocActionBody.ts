import { AcDbDxfFiler } from '../../base/AcDbDxfFiler.js'
import { AcDbObject, type AcDbObjectId } from '../../base/AcDbObject.js'
import { AcDbAssocDxfCursor } from './acdbAssocDxf.js'

/**
 * Abstract body that implements the algorithm of an {@link AcDbAssocAction}
 * (ObjectARX `AcDbAssocActionBody`).
 *
 * Custom behaviors override {@link evaluateOverride}. The parent action owns
 * this body (it is the body's DXF owner); when the action is erased the body
 * is erased with it.
 *
 * DXF layout (`AcDbAssocActionBody` subclass): `90 classVersion (2)`.
 */
export abstract class AcDbAssocActionBody extends AcDbObject {
  private _actionBodyClassVersion = 2

  /** Owning {@link AcDbAssocAction} id (the DXF owner handle). */
  get parentActionId(): AcDbObjectId {
    return this.ownerId
  }
  set parentActionId(value: AcDbObjectId) {
    this.ownerId = value ?? ''
  }

  /**
   * Performs the associative evaluation algorithm.
   *
   * Must be overridden by concrete action bodies.
   */
  abstract evaluateOverride(): void

  /**
   * True when the objects this body drives no longer exist (e.g. the array
   * INSERT was erased). Orphaned actions are skipped by evaluation and DXF
   * export but kept in memory, so undo/redo of the erase restores them.
   */
  isOrphaned(): boolean {
    return false
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbAssocActionBody')
    filer.writeInt32(90, this._actionBodyClassVersion)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    const c = AcDbAssocDxfCursor.read(filer, 'AcDbAssocActionBody')
    this._actionBodyClassVersion = c.int(90, 2)
    return this
  }
}
