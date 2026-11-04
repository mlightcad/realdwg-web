import type { AcDbDxfFiler } from '../base/AcDbDxfFiler.js'
import { AcDbObject } from '../base/AcDbObject.js'
import {
  acdbCaptureDxfRawTags,
  type AcDbDxfRawTags,
  acdbWriteDxfRawTags
} from '../dxf/AcDbDxfRawTags.js'

/**
 * An OBJECTS-section record whose DXF type has no native implementation
 * (for example `PLOTSETTINGS`, `MATERIAL`, `VISUALSTYLE`, `TABLESTYLE`,
 * `ACDBPLACEHOLDER`, `RASTERVARIABLES`, `DIMASSOC` or third-party classes).
 *
 * Like ezdxf's `DXFTagStorage`, the record's tags are kept verbatim and
 * written back by `dxfOut` so references to it (dictionary entries, entity
 * material / plot-style handles, …) stay valid after a round trip.
 */
export class AcDbUnknownObject extends AcDbObject {
  private _dxfTypeName: string
  private _rawTags: AcDbDxfRawTags = { header: [], body: [] }

  constructor(dxfTypeName = '') {
    super()
    this._dxfTypeName = dxfTypeName.toUpperCase()
  }

  /** DXF record type name (group 0), e.g. `MATERIAL`. */
  get dxfTypeName() {
    return this._dxfTypeName
  }

  /** Tags captured from the source DXF, excluding handle, owner and XData. */
  get rawTags(): Readonly<AcDbDxfRawTags> {
    return this._rawTags
  }

  override dxfIn(filer: AcDbDxfFiler): this {
    const { tags, handle, ownerId, extensionDictionary } =
      acdbCaptureDxfRawTags(filer)
    this._rawTags = tags
    if (handle) this.objectId = handle
    if (ownerId) this.ownerId = ownerId
    if (extensionDictionary) this.extensionDictionary = extensionDictionary
    if (filer.atExtendedData) {
      this.dxfInXData(filer)
    }
    return this
  }

  override dxfOut(...args: unknown[]): unknown {
    const [filer, allXdata = false] = args as [AcDbDxfFiler, boolean?]
    acdbWriteDxfRawTags(filer, this._rawTags, this)
    if (allXdata) {
      this.dxfOutXData(filer)
    }
    return this
  }
}
