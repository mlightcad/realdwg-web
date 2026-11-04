import type { AcGeMatrix3d } from '@mlightcad/geometry-engine'

import { AcDbDxfFiler } from '../base/AcDbDxfFiler.js'
import type { AcDbTypedValue } from '../base/AcDbTypedValue.js'
import {
  AcDbDxfPairArrayReader,
  acdbTypedValueToDxfPair
} from '../dxf/AcDbDxfPairArrayReader.js'
import {
  acdbCaptureDxfRawTags,
  type AcDbDxfRawTags,
  acdbWriteDxfRawTags
} from '../dxf/AcDbDxfRawTags.js'
import { AcDbEntity } from './AcDbEntity.js'
import { AcDbProxyEntity } from './AcDbProxyEntity.js'

/**
 * An entity whose DXF type has no native implementation (for example `HELIX`,
 * `MESH`, `REGION`, `PDFUNDERLAY` or a third-party class).
 *
 * Mirrors ezdxf's `DXFTagStorage` / ODA's handling of unknown classes: all
 * tags are kept verbatim and written back unchanged by `dxfOut`, so opening
 * and saving a drawing no longer silently deletes such entities. Common
 * entity properties (layer, color, …) are parsed for display and filtering,
 * and an embedded proxy graphic (AcDbEntity groups 92/160 + 310), when
 * present, is rendered through {@link AcDbProxyEntity}.
 *
 * Geometry edits cannot be expressed in the preserved tags: the entity cannot
 * be transformed, and only the layer is patched on output.
 */
export class AcDbUnknownEntity extends AcDbProxyEntity {
  static override typeName: string = 'UnknownEntity'

  private _dxfTypeName: string
  private _rawTags: AcDbDxfRawTags = { header: [], body: [] }

  constructor(dxfTypeName = '') {
    super()
    this._dxfTypeName = dxfTypeName.toUpperCase()
    this.originalDxfName = this._dxfTypeName
  }

  override get dxfTypeName() {
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

    // Replay the AcDbEntity subclass for layer/color/… and proxy graphics.
    const replay = AcDbDxfFiler.forReading(
      new AcDbDxfPairArrayReader(tags.body.map(acdbTypedValueToDxfPair)),
      { database: filer.database }
    )
    this.dxfInFields(replay)
    this.loadEmbeddedProxyGraphic()

    if (filer.atExtendedData) {
      this.dxfInXData(filer)
    }
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    // Only the common AcDbEntity fields are understood; subclass data stays raw.
    AcDbEntity.prototype.dxfInFields.call(this, filer)
    return this
  }

  override dxfOut(...args: unknown[]): unknown {
    const [filer, allXdata = false] = args as [AcDbDxfFiler, boolean?]
    acdbWriteDxfRawTags(filer, this.patchedTags(), this)
    if (allXdata) {
      this.dxfOutXData(filer)
    }
    return this
  }

  /** Raw tags with the AcDbEntity layer (group 8) set to the current one. */
  private patchedTags(): AcDbDxfRawTags {
    const body = [...this._rawTags.body]
    const start = body.findIndex(
      item => Number(item.code) === 100 && item.value === 'AcDbEntity'
    )
    if (start < 0) return this._rawTags
    let end = body.findIndex((item, i) => i > start && Number(item.code) === 100)
    if (end < 0) end = body.length
    const layer = { code: 8, value: this.layer } as AcDbTypedValue
    const index = body.findIndex(
      (item, i) => i > start && i < end && Number(item.code) === 8
    )
    if (index >= 0) {
      body[index] = layer
    } else {
      body.splice(start + 1, 0, layer)
    }
    return { header: this._rawTags.header, body }
  }

  /**
   * True when the preserved tags use subclass markers (R13+ layout), i.e.
   * they can be written to an R13+ DXF.
   */
  get hasSubclassData() {
    return this._rawTags.body.some(item => Number(item.code) === 100)
  }

  /**
   * Geometry lives in tags this class does not understand, so it cannot be
   * transformed (ezdxf raises for the same reason). Moving only the display
   * would make the saved file disagree with what the user saw.
   */
  override transformBy(_matrix: AcGeMatrix3d) {
    return this
  }

  override subGetGripPoints() {
    return []
  }

  private loadEmbeddedProxyGraphic() {
    let length: number | undefined
    const chunks: Array<string | Uint8Array> = []
    let inEntity = false
    for (const item of this._rawTags.body) {
      const code = Number(item.code)
      if (code === 100) {
        inEntity = item.value === 'AcDbEntity'
        continue
      }
      if (!inEntity) continue
      if (code === 92 || code === 160) {
        length = Number(item.value)
      } else if (code === 310) {
        chunks.push(
          item.value instanceof Uint8Array ? item.value : String(item.value)
        )
      }
    }
    if (chunks.length > 0) {
      this.loadProxyGraphicFromDxf(length, chunks)
    }
  }
}
