import { AcDbDxfFiler } from '../base/AcDbDxfFiler.js'
import { AcDbObject } from '../base/AcDbObject.js'
import {
  type AcDbDxfRawTags,
  acdbWriteDxfRawTags
} from '../dxf/AcDbDxfRawTags.js'

/**
 * Base class for per-context representation data
 * (`AcDbObjectContextData` in AutoCAD ObjectARX).
 */
export class AcDbObjectContextData extends AcDbObject {
  private _classVersion = 4
  private _isDefault = false
  private _dxfRecordName?: string
  private _dxfRawTags?: AcDbDxfRawTags

  /**
   * DXF record type name this object was read as, e.g.
   * `ACDB_ALDIMOBJECTCONTEXTDATA_CLASS`. Several record types share one
   * class, so the name is kept for export.
   */
  get dxfRecordName() {
    return this._dxfRecordName
  }
  set dxfRecordName(value: string | undefined) {
    this._dxfRecordName = value
  }

  /**
   * Keeps the tags read from DXF so export reproduces them verbatim, like
   * ezdxf does for context data. Only part of each context-data subclass is
   * modeled; rewriting it natively would drop the rest.
   *
   * @internal Used by the DXF OBJECTS reader.
   */
  setDxfRawTags(tags: AcDbDxfRawTags | undefined) {
    this._dxfRawTags = tags
  }

  /** True when export replays the tags read from DXF. @internal */
  get hasDxfRawTags() {
    return this._dxfRawTags != null
  }

  override dxfOut(...args: unknown[]): unknown {
    const tags = this._dxfRawTags
    if (!tags) return super.dxfOut(...args)
    const [filer, allXdata = false] = args as [AcDbDxfFiler, boolean?]
    acdbWriteDxfRawTags(filer, tags, this)
    if (allXdata) {
      this.dxfOutXData(filer)
    }
    return this
  }

  get classVersion() {
    return this._classVersion
  }
  set classVersion(value: number) {
    this._classVersion = value
  }

  /** True when this representation matches the entity record (DXF 290). */
  get isDefault() {
    return this._isDefault
  }
  set isDefault(value: boolean) {
    this._isDefault = value
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbObjectContextData')
    filer.writeInt16(70, this._classVersion)
    filer.writeBoolean(290, this._isDefault)
    return this
  }

  /**
   * Reads `AcDbObjectContextData` fields. Returns the next subclass marker
   * when present so subclasses can continue the section walk.
   */
  protected dxfInObjectContextData(
    filer: AcDbDxfFiler
  ): string | undefined {
    filer.atSubclassData('AcDbObjectContextData')
    while (!filer.atEndOfObject && !filer.atEof && !filer.atExtendedData) {
      const item = filer.readItem()
      if (!item) break
      const code = Number(item.code)
      if (code === 100) {
        return String(item.value)
      }
      switch (code) {
        case 70:
          this._classVersion = Number(item.value)
          break
        case 290:
          this._isDefault = Boolean(Number(item.value))
          break
        default:
          break
      }
    }
    return undefined
  }
}
