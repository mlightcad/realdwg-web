import {
  AcGeBox3d,
  AcGeMatrix3d,
  AcGePoint3d
} from '@mlightcad/geometry-engine'
import { AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbDxfFiler } from '../base/AcDbDxfFiler'
import { AcDbEntity } from './AcDbEntity'

/**
 * Matches every `point` record in an ACIS SAT text stream, e.g.
 * `point $-1 10 0 -10 #`. The `point` record format (attribute pointer
 * followed by x/y/z) has been stable across ACIS SAT versions, unlike the
 * topology records (`face`/`loop`/`coedge`/`edge`), whose field layout and
 * count vary by surface/curve type and ACIS version. Extracting every point
 * this way, independent of the body's topology, is a format detail that's
 * safe to rely on regardless of which faces/edges reference it.
 */
const ACIS_POINT_RECORD = /\bpoint\s+\$-?\d+\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/g

/**
 * Extracts every vertex position referenced by `point` records in an ACIS
 * SAT text stream.
 *
 * @param acisData - Raw ACIS SAT text (the concatenated group 1/3 lines of a
 * DXF `3DSOLID`/`REGION`/`BODY` entity).
 * @returns Every point found, in file order. Empty when `acisData` doesn't
 * contain any recognizable `point` records (e.g. binary ASM/SAB data).
 */
function extractAcisPointCloud(acisData: string): AcGePoint3d[] {
  const points: AcGePoint3d[] = []
  for (const match of acisData.matchAll(ACIS_POINT_RECORD)) {
    const x = Number.parseFloat(match[1])
    const y = Number.parseFloat(match[2])
    const z = Number.parseFloat(match[3])
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      points.push(new AcGePoint3d(x, y, z))
    }
  }
  return points
}

/**
 * Represents a 3D solid (ACIS/ASM B-rep) entity, such as those created by
 * AutoCAD's BOX, WEDGE, EXTRUDE, or boolean solid-modeling commands.
 *
 * Full B-rep tessellation (rendering the solid's actual trimmed
 * NURBS/planar faces) is not yet supported — that requires implementing (or
 * embedding) a real ACIS/ASM geometry kernel, which is out of scope here.
 *
 * Instead, this renders a wireframe bounding box derived from every vertex
 * position embedded in the entity's raw ACIS SAT data, so the solid is at
 * least visible at its correct location and approximate size rather than
 * silently missing from the drawing. The `point` record format is stable
 * across ACIS SAT versions and independent of the (much more variable)
 * topology record layouts, which is why this approach works without a full
 * B-rep parser. When `acisData` holds binary ASM/SAB data instead of SAT
 * text (common in DWG 2013+), no points are found and this renders nothing.
 */
export class AcDb3dSolid extends AcDbEntity {
  /** The entity type name */
  static override typeName: string = '3dSolid'

  override get dxfTypeName() {
    return '3DSOLID'
  }

  /** Raw ACIS SAT text (or ASM/SAB binary payload) for this solid. */
  private _acisData: string
  /** DXF group 70 ACIS version number, when present. */
  private _version?: number
  /** Vertex positions extracted from `point` records in {@link _acisData}. */
  private _points: AcGePoint3d[]

  /**
   * Creates a new 3D solid entity from raw ACIS data.
   *
   * @param acisData - Raw ACIS SAT text (group 1/3 lines) or ASM/SAB binary payload.
   * @param version - DXF group 70 ACIS version number, when present.
   */
  constructor(acisData: string, version?: number) {
    super()
    this._acisData = acisData
    this._version = version
    this._points = extractAcisPointCloud(acisData)
  }

  /**
   * Raw ACIS SAT text (or ASM/SAB binary payload) for this solid, preserved
   * for future full B-rep parsing support.
   */
  get acisData(): string {
    return this._acisData
  }

  /** DXF group 70 ACIS version number, when present. */
  get version(): number | undefined {
    return this._version
  }

  /**
   * Whether any vertex positions could be extracted from {@link acisData}.
   * False when the data is binary (ASM/SAB) rather than SAT text.
   */
  get hasRenderableGeometry(): boolean {
    return this._points.length > 0
  }

  /** @inheritdoc */
  get geometricExtents(): AcGeBox3d {
    if (this._points.length === 0) {
      return new AcGeBox3d(new AcGePoint3d(0, 0, 0), new AcGePoint3d(0, 0, 0))
    }
    return new AcGeBox3d().setFromPoints(this._points)
  }

  /**
   * Transforms this solid by the specified matrix.
   *
   * Only the extracted point cloud (and thus the wireframe bounding box) is
   * transformed; {@link acisData} itself is left untouched since it isn't
   * fully parsed.
   */
  transformBy(matrix: AcGeMatrix3d) {
    this._points.forEach(point => point.applyMatrix4(matrix))
    return this
  }

  /**
   * Draws a wireframe bounding box around the solid's extracted point cloud.
   *
   * @param renderer - The renderer to use for drawing
   * @returns The rendered wireframe entity, or `undefined` when no points
   * could be extracted from {@link acisData}.
   */
  subWorldDraw(renderer: AcGiRenderer) {
    if (this._points.length === 0) {
      return undefined
    }
    const box = this.geometricExtents
    const min = box.min
    const max = box.max
    const corners = [
      new AcGePoint3d(min.x, min.y, min.z),
      new AcGePoint3d(max.x, min.y, min.z),
      new AcGePoint3d(max.x, max.y, min.z),
      new AcGePoint3d(min.x, max.y, min.z),
      new AcGePoint3d(min.x, min.y, max.z),
      new AcGePoint3d(max.x, min.y, max.z),
      new AcGePoint3d(max.x, max.y, max.z),
      new AcGePoint3d(min.x, max.y, max.z)
    ]
    const buffer = new Float32Array(corners.length * 3)
    corners.forEach((corner, i) => {
      buffer[i * 3] = corner.x
      buffer[i * 3 + 1] = corner.y
      buffer[i * 3 + 2] = corner.z
    })
    // 12 edges of a box, referencing the 8 corners above.
    const indices = new Uint16Array([
      0, 1, 1, 2, 2, 3, 3, 0, // bottom face
      4, 5, 5, 6, 6, 7, 7, 4, // top face
      0, 4, 1, 5, 2, 6, 3, 7 // vertical edges
    ])
    return renderer.lineSegments(buffer, 3, indices)
  }

  /**
   * Writes DXF fields for this object.
   *
   * @param filer - DXF output writer.
   * @returns The instance (for chaining).
   */
  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDb3dSolid')
    if (this._version != null) {
      filer.writeInt16(70, this._version)
    }
    // ACIS text is written as chunked group-3 continuation lines (max 255
    // chars each per the DXF spec), terminated by a final group-1 line.
    const maxChunkLength = 255
    const lines = this._acisData.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const isLast = i === lines.length - 1
      let line = lines[i]
      while (line.length > maxChunkLength) {
        filer.writeString(3, line.slice(0, maxChunkLength))
        line = line.slice(maxChunkLength)
      }
      filer.writeString(isLast ? 1 : 3, line)
    }
    return this
  }
}
