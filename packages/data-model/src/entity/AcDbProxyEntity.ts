import { AcGeBox3d, AcGeMatrix3d, AcGePoint3d } from '@mlightcad/geometry-engine'
import { AcGiEntity, AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbDxfFiler } from '../base/AcDbDxfFiler'
import {
  AcDbProxyGraphic,
  bytesToHexString,
  loadAcDbProxyGraphicFromDxf
} from '../misc/proxyGraphic'
import { AcDbEntity } from './AcDbEntity'

/**
 * Represents a proxy entity for custom objects not natively supported by the
 * host application.
 *
 * Similar to ObjectARX {@link https://help.autodesk.com/view/OARX/2024/ENU/?guid=OARX-RefGuide-AcDbProxyEntity AcDbProxyEntity},
 * proxy entities store serialized graphics in a binary proxy graphic stream.
 * {@link subWorldDraw} decodes that stream and renders the contained primitives
 * through the graphics renderer so viewers (e.g. cad-viewer) can display them.
 */
export class AcDbProxyEntity extends AcDbEntity {
  /** The entity type name */
  static override typeName: string = 'ProxyEntity'

  override get dxfTypeName() {
    return 'ACAD_PROXY_ENTITY'
  }

  /** Original DXF entity name of the proxied class */
  private _originalDxfName = ''
  /** Original ObjectARX class name */
  private _originalClassName = ''
  /** Application that created the proxied object */
  private _applicationName = ''
  /** Proxy entity class identifier */
  private _proxyEntityClassId = 0
  /** Graphics metafile type */
  private _graphicsMetafileType = 0
  /** Binary proxy graphics data */
  private _proxyGraphic?: Uint8Array
  /** Optional entity origin points */
  private _entityOrigins: AcGePoint3d[] = []

  /**
   * Gets the original DXF name of the proxied entity class.
   */
  get originalDxfName() {
    return this._originalDxfName
  }

  /**
   * Sets the original DXF name of the proxied entity class.
   */
  set originalDxfName(value: string) {
    this._originalDxfName = value
  }

  /**
   * Gets the original ObjectARX class name.
   */
  get originalClassName() {
    return this._originalClassName
  }

  /**
   * Sets the original ObjectARX class name.
   */
  set originalClassName(value: string) {
    this._originalClassName = value
  }

  /**
   * Gets the application name that created the proxied object.
   */
  get applicationName() {
    return this._applicationName
  }

  /**
   * Sets the application name that created the proxied object.
   */
  set applicationName(value: string) {
    this._applicationName = value
  }

  /**
   * Gets the proxy entity class identifier.
   */
  get proxyEntityClassId() {
    return this._proxyEntityClassId
  }

  /**
   * Sets the proxy entity class identifier.
   */
  set proxyEntityClassId(value: number) {
    this._proxyEntityClassId = value
  }

  /**
   * Gets the graphics metafile type.
   */
  get graphicsMetafileType() {
    return this._graphicsMetafileType
  }

  /**
   * Sets the graphics metafile type.
   */
  set graphicsMetafileType(value: number) {
    this._graphicsMetafileType = value
  }

  /**
   * Gets the proxy graphics binary data.
   */
  get proxyGraphic() {
    return this._proxyGraphic
  }

  /**
   * Sets the proxy graphics binary data.
   */
  setProxyGraphic(data?: Uint8Array | null) {
    this._proxyGraphic = data ? new Uint8Array(data) : undefined
  }

  /**
   * Gets entity origin points stored on the proxy entity.
   */
  get entityOrigins() {
    return this._entityOrigins
  }

  /**
   * Sets entity origin points stored on the proxy entity.
   */
  setEntityOrigins(origins: AcGePoint3d[]) {
    this._entityOrigins = origins.map(
      origin => new AcGePoint3d(origin.x, origin.y, origin.z)
    )
  }

  /**
   * Gets the geometric extents of this proxy entity.
   *
   * When proxy graphics contain an EXTENTS chunk, that box is returned.
   * Otherwise an empty box is returned.
   */
  get geometricExtents(): AcGeBox3d {
    const graphic = this._proxyGraphic
    if (!graphic?.length) {
      return new AcGeBox3d()
    }
    const parser = new AcDbProxyGraphic(graphic, {
      database: this.database,
      defaultLayer: this.layer
    })
    const extents = parser.scanExtents()
    if (extents) {
      return new AcGeBox3d().setFromPoints(extents)
    }
    return new AcGeBox3d()
  }

  /**
   * Transforms this proxy entity by the specified matrix.
   *
   * Entity origins are transformed. Proxy graphic data is not modified because
   * it is rendered through matrix attributes inside the graphic stream.
   */
  transformBy(matrix: AcGeMatrix3d) {
    this._entityOrigins.forEach(origin => origin.applyMatrix4(matrix))
    return this
  }

  /**
   * Draws proxy graphics by decoding the binary stream and emitting primitives
   * through the renderer.
   */
  subWorldDraw(renderer: AcGiRenderer): AcGiEntity | undefined {
    const graphic = this._proxyGraphic
    if (!graphic?.length) {
      return undefined
    }

    const parser = new AcDbProxyGraphic(graphic, {
      database: this.database,
      defaultLayer: this.layer
    })
    return parser.worldDraw(renderer)
  }

  /**
   * Writes DXF fields for this proxy entity.
   */
  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbProxyEntity')
    filer.writeString(1, this._originalDxfName)
    if (this._originalClassName) {
      filer.writeString(3, this._originalClassName)
    }
    if (this._applicationName) {
      filer.writeString(1001, this._applicationName)
    }
    filer.writeInt32(90, this._proxyEntityClassId)
    filer.writeInt32(91, this._graphicsMetafileType)
    if (this._entityOrigins.length > 0) {
      filer.writeInt32(92, this._entityOrigins.length)
      this._entityOrigins.forEach(origin => {
        filer.writePoint3d(10, origin)
      })
    }
    if (this._proxyGraphic?.length) {
      filer.writeInt32(160, this._proxyGraphic.length)
      let index = 0
      while (index < this._proxyGraphic.length) {
        const chunk = this._proxyGraphic.subarray(
          index,
          index + 127
        )
        filer.writeString(310, bytesToHexString(chunk))
        index += 127
      }
    }
    return this
  }

  /**
   * Loads proxy graphic data from DXF group 160/310 values.
   */
  loadProxyGraphicFromDxf(length?: number, hexChunks?: string[]) {
    const data = loadAcDbProxyGraphicFromDxf(length, hexChunks)
    if (data) {
      this.setProxyGraphic(data)
    }
  }
}
