import { AcGePoint3d, type AcGePoint3dLike } from '@mlightcad/geometry-engine'

import { AcDbDxfFiler } from '../../base/AcDbDxfFiler.js'
import type { AcDbTypedValue } from '../../base/AcDbTypedValue.js'
import {
  AcDbAssocSingleDependencyActionParam,
  acdbAssocWriteRawItems
} from './AcDbAssocActionParam.js'
import { AcDbAssocDxfCursor, acdbAssocWriteId } from './acdbAssocDxf.js'

/**
 * Action parameter that holds a point
 * (ObjectARX `AcDbAssocVertexActionParam`). Associative arrays use it for
 * `Origin`, `BaseNormal` and `basePoint`.
 *
 * DXF layout: `100 AcDbAssocVertexActionParam, 90 0, 10/20/30 point`.
 */
export class AcDbAssocVertexActionParam extends AcDbAssocSingleDependencyActionParam {
  static override readonly DXF_NAME: string = 'ACDBASSOCVERTEXACTIONPARAM'

  private _vertexClassVersion = 0
  private _point = new AcGePoint3d()

  constructor(name = '', point?: AcGePoint3dLike) {
    super(name)
    if (point) this._point.copy(point)
  }

  get point(): AcGePoint3d {
    return this._point
  }
  set point(value: AcGePoint3dLike) {
    this._point.copy(value)
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbAssocVertexActionParam')
    filer.writeInt32(90, this._vertexClassVersion)
    filer.writePoint3d(10, this._point)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    const c = AcDbAssocDxfCursor.read(filer, 'AcDbAssocVertexActionParam')
    this._vertexClassVersion = c.int()
    this._point = c.point(10)
    return this
  }

  /** @internal Restores vertex fields decoded from DWG. */
  setVertexFromDwg(data: { classVersion: number; point: AcGePoint3dLike }) {
    this._vertexClassVersion = data.classVersion
    this._point.copy(data.point)
  }
}

/** AcGe entity id of a 3d line segment (`AcGe::kLineSeg3d`). */
export const ACGE_LINE_SEG_3D = 23
/** AcGe entity id of a 3d composite curve (`AcGe::kCompositeCrv3d`). */
export const ACGE_COMPOSITE_CRV_3D = 47

/** Line segment of an edge parameter's cached curve. */
export interface AcDbAssocEdgeLineSegment {
  start: AcGePoint3d
  end: AcGePoint3d
}

/**
 * Action parameter that references an edge (curve) and caches its geometry
 * (ObjectARX `AcDbAssocEdgeActionParam`). Path arrays use it as
 * `RowProfile`.
 *
 * DXF layout: `100 AcDbAssocEdgeActionParam, 90 0, 330 0, 290 hasCurve,
 * [cached AcGe curve]`. A cached composite curve of line segments is
 * `90 47, 90 n, (90 23, 10 start, 10 direction)×n`. Other cached curve kinds
 * are preserved verbatim.
 */
export class AcDbAssocEdgeActionParam extends AcDbAssocSingleDependencyActionParam {
  static override readonly DXF_NAME: string = 'ACDBASSOCEDGEACTIONPARAM'

  private _edgeClassVersion = 0
  private _edgeRefId = ''
  private _hasCachedCurve = false
  /** Raw cached-curve pairs (after the `290` flag). */
  private _curveItems: AcDbTypedValue[] = []

  /** True when the parameter carries a cached curve. */
  get hasCachedCurve(): boolean {
    return this._hasCachedCurve
  }

  /**
   * Returns the cached curve as line segments when it is a composite curve of
   * line segments (or a single line segment); otherwise `undefined`.
   */
  getCachedLineSegments(): AcDbAssocEdgeLineSegment[] | undefined {
    if (!this._hasCachedCurve) return undefined
    const c = AcDbAssocDxfCursor.fromItems(this._curveItems)
    const readLine = (): AcDbAssocEdgeLineSegment => {
      const start = c.point(10)
      const dir = c.point(10)
      return {
        start,
        end: new AcGePoint3d(start.x + dir.x, start.y + dir.y, start.z + dir.z)
      }
    }
    const kind = c.int()
    if (kind === ACGE_LINE_SEG_3D) return [readLine()]
    if (kind !== ACGE_COMPOSITE_CRV_3D) return undefined
    const count = c.int()
    const segments: AcDbAssocEdgeLineSegment[] = []
    for (let i = 0; i < count; i++) {
      if (c.int() !== ACGE_LINE_SEG_3D) return undefined
      segments.push(readLine())
    }
    return segments
  }

  /**
   * Caches a composite curve made of line segments. Pass `undefined` (or an
   * empty list) to clear the cache.
   */
  setCachedLineSegments(
    segments: readonly AcDbAssocEdgeLineSegment[] | undefined
  ) {
    if (!segments || segments.length === 0) {
      this._hasCachedCurve = false
      this._curveItems = []
      return
    }
    const items: AcDbTypedValue[] = []
    const point = (p: { x: number; y: number; z: number }) => {
      items.push({ code: 10, value: p.x })
      items.push({ code: 20, value: p.y })
      items.push({ code: 30, value: p.z })
    }
    items.push({ code: 90, value: ACGE_COMPOSITE_CRV_3D })
    items.push({ code: 90, value: segments.length })
    for (const seg of segments) {
      items.push({ code: 90, value: ACGE_LINE_SEG_3D })
      point(seg.start)
      point({
        x: seg.end.x - seg.start.x,
        y: seg.end.y - seg.start.y,
        z: seg.end.z - seg.start.z
      })
    }
    this._hasCachedCurve = true
    this._curveItems = items
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbAssocEdgeActionParam')
    filer.writeInt32(90, this._edgeClassVersion)
    acdbAssocWriteId(filer, 330, this._edgeRefId)
    filer.writeBoolean(290, this._hasCachedCurve)
    if (this._hasCachedCurve) acdbAssocWriteRawItems(filer, this._curveItems)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    const c = AcDbAssocDxfCursor.read(filer, 'AcDbAssocEdgeActionParam')
    this._edgeClassVersion = c.int()
    this._edgeRefId = c.id([330, 360])
    this._hasCachedCurve = c.bool()
    this._curveItems = this._hasCachedCurve ? c.rest() : []
    return this
  }

  /** @internal Restores edge fields decoded from DWG. */
  setEdgeFromDwg(data: {
    classVersion: number
    segments?: AcDbAssocEdgeLineSegment[]
  }) {
    this._edgeClassVersion = data.classVersion
    this.setCachedLineSegments(data.segments)
  }
}
