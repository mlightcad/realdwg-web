import {
  AcGePoint3d,
  AcGePoint3dLike,
  AcGeVector3d
} from '@mlightcad/geometry-engine'

import { AcDbEntity } from './AcDbEntity.js'

/**
 * Abstract base class for all curve entities.
 *
 * This class provides the fundamental functionality for all curve entities,
 * including the ability to determine if a curve is closed. A curve is
 * considered closed if its start point is identical to its end point.
 *
 * @example
 * ```typescript
 * class MyCurve extends AcDbCurve {
 *   get closed(): boolean {
 *     // Implementation to determine if curve is closed
 *     return this.startPoint.equals(this.endPoint);
 *   }
 * }
 * ```
 */
export abstract class AcDbCurve extends AcDbEntity {
  /** The entity type name */
  static override typeName: string = 'Curve'

  /**
   * Returns true if the curve is closed.
   *
   * A curve is considered closed if its start point is identical to its end point.
   * This property is used by various operations that need to know if a curve
   * forms a complete loop.
   *
   * @returns True if the curve is closed, false otherwise
   *
   * @example
   * ```typescript
   * const curve = new AcDbCircle();
   * console.log('Is circle closed?', curve.closed); // true
   *
   * const line = new AcDbLine();
   * console.log('Is line closed?', line.closed); // false
   * ```
   */
  abstract get closed(): boolean

  /**
   * The area enclosed by this curve. Returns `0` when the curve does not form a
   * closed region.
   */
  abstract get area(): number

  /**
   * Creates offset curves at the given signed distance, similar to ObjectARX
   * `AcDbCurve::getOffsetCurves`.
   *
   * The sign of `offsetDist` determines the offset side relative to the curve
   * direction in the curve plane. Returns an empty array when offsetting fails.
   *
   * @param offsetDist - Signed offset distance in drawing units
   * @returns Offset curve entities (equivalent to `AcDbVoidPtrArray`)
   */
  abstract getOffsetCurves(offsetDist: number): AcDbCurve[]

  /**
   * Determines which side of this curve a point lies on for offset operations.
   *
   * @param point - Test point in WCS
   * @returns `1` for the positive offset side, `-1` for the negative side
   */
  getOffsetSideAtPoint(_point: AcGePoint3dLike): 1 | -1 {
    return 1
  }

  /**
   * Parameter at the start of the curve, like ObjectARX
   * `AcDbCurve::getStartParam`. Curves that do not support parameterization
   * return `0`.
   */
  get startParam(): number {
    return 0
  }

  /**
   * Parameter at the end of the curve, like ObjectARX
   * `AcDbCurve::getEndParam`. It is always `>= startParam`; unbounded curves
   * return `Infinity`. Curves that do not support parameterization return `0`.
   */
  get endParam(): number {
    return 0
  }

  /**
   * Returns the parameter of a point on the curve, like ObjectARX
   * `AcDbCurve::getParamAtPoint`.
   *
   * The point must lie on the curve within tolerance. Some curve types also
   * accept points on their natural extension and return a parameter outside
   * `[startParam, endParam]` (lines, rays, xlines: signed distance; arcs and
   * ellipse arcs: any point of the full circle / ellipse maps into
   * `[startParam, startParam + 2π)`; open polylines: the extension of the
   * first and last segments).
   *
   * @param _point - Point in WCS
   * @returns The parameter, or `undefined` when the point is not on the curve
   *   or the curve type does not support parameterization
   */
  getParamAtPoint(_point: AcGePoint3dLike): number | undefined {
    return undefined
  }

  /**
   * Returns the point at a parameter, like ObjectARX
   * `AcDbCurve::getPointAtParam`. Parameters returned by
   * {@link getParamAtPoint} for points on the natural extension are accepted
   * as well.
   *
   * @param _param - Curve parameter
   * @returns The point in WCS, or `undefined` when unsupported
   */
  getPointAtParam(_param: number): AcGePoint3d | undefined {
    return undefined
  }

  /**
   * Returns the point on the curve closest to `point`, like ObjectARX
   * `AcDbCurve::getClosestPointTo`.
   *
   * @param _point - Query point in WCS
   * @param _extend - When true, the natural extension of the curve (infinite
   *   line, full circle, full ellipse, open polyline end segments) is
   *   considered as well
   * @returns The closest point in WCS, or `undefined` when unsupported
   */
  getClosestPointTo(
    _point: AcGePoint3dLike,
    _extend?: boolean
  ): AcGePoint3d | undefined {
    return undefined
  }

  /**
   * Returns the curve length from {@link startParam} to `param`, like
   * ObjectARX `AcDbCurve::getDistAtParam`. Rays and xlines measure the signed
   * distance from their base point. Parameters on the natural extension of
   * analytic curves give a signed (possibly negative) distance.
   *
   * @param _param - Curve parameter
   * @returns The distance, or `undefined` when unsupported
   */
  getDistAtParam(_param: number): number | undefined {
    return undefined
  }

  /**
   * Returns the parameter at a distance measured from {@link startParam}, like
   * ObjectARX `AcDbCurve::getParamAtDist`.
   *
   * Default implementation binary-searches {@link getDistAtParam} over
   * `[startParam, endParam]`.
   */
  getParamAtDist(dist: number): number | undefined {
    const start = this.startParam
    const end = this.endParam
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return undefined
    }
    const startDist = this.getDistAtParam(start)
    const endDist = this.getDistAtParam(end)
    if (startDist == null || endDist == null) return undefined
    const target = startDist + dist
    if (dist <= 0) return start
    if (target >= endDist) return end

    let lo = start
    let hi = end
    for (let i = 0; i < 48; i++) {
      const mid = (lo + hi) / 2
      const d = this.getDistAtParam(mid)
      if (d == null) return undefined
      if (d < target) lo = mid
      else hi = mid
    }
    return (lo + hi) / 2
  }

  /**
   * Returns the point at a distance measured from {@link startParam}, like
   * ObjectARX `AcDbCurve::getPointAtDist`.
   */
  getPointAtDist(dist: number): AcGePoint3d | undefined {
    const param = this.getParamAtDist(dist)
    if (param == null) return undefined
    return this.getPointAtParam(param)
  }

  /**
   * Returns the first derivative (tangent) at `param`, like ObjectARX
   * `AcDbCurve::getFirstDeriv`. Default uses a finite difference.
   */
  getFirstDeriv(param: number): AcGeVector3d | undefined {
    const eps = 1e-4
    const p0 = this.getPointAtParam(param - eps)
    const p1 = this.getPointAtParam(param + eps)
    if (!p0 || !p1) return undefined
    const v = new AcGeVector3d(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z)
    return v.lengthSq() > 1e-20 ? v : undefined
  }

  /**
   * Returns the first derivative at a distance from {@link startParam}.
   */
  getFirstDerivAtDist(dist: number): AcGeVector3d | undefined {
    const param = this.getParamAtDist(dist)
    if (param == null) return undefined
    return this.getFirstDeriv(param)
  }

  /**
   * Splits the curve at the given parameters, like ObjectARX
   * `AcDbCurve::getSplitCurves(const AcGeDoubleArray&, ...)`.
   *
   * Parameters are sorted and de-duplicated. On open curves, parameters not
   * strictly inside `(startParam, endParam)` are ignored and `n` parameters
   * produce `n + 1` pieces ordered from start to end. On closed curves,
   * parameters are wrapped into `[startParam, endParam)`, at least two are
   * required, and the last piece runs from the last parameter through the
   * start/end seam to the first one.
   *
   * The pieces are new entities that are not database resident and carry
   * the common properties (layer, color, linetype, ...) of this curve.
   * Zero-length pieces are dropped.
   *
   * @param _params - Split parameters
   * @returns The pieces, or an empty array when nothing is split or the curve
   *   type does not support splitting
   */
  getSplitCurves(_params: readonly number[]): AcDbCurve[] {
    return []
  }

  /**
   * Splits the curve at the given points, like ObjectARX
   * `AcDbCurve::getSplitCurves(const AcGePoint3dArray&, ...)`.
   *
   * Each point is mapped through {@link getParamAtPoint}; points that are not
   * on the curve are ignored. See {@link getSplitCurves} for the rules.
   *
   * @param points - Split points in WCS
   * @returns The pieces, or an empty array when nothing is split
   */
  getSplitCurvesAtPoints(points: readonly AcGePoint3dLike[]): AcDbCurve[] {
    const params: number[] = []
    for (const point of points) {
      const param = this.getParamAtPoint(point)
      if (param !== undefined) params.push(param)
    }
    return params.length > 0 ? this.getSplitCurves(params) : []
  }

  /**
   * Extends the curve in place to `newParam`, like ObjectARX
   * `AcDbCurve::extend(double)`.
   *
   * A parameter below {@link startParam} moves the start, one above
   * {@link endParam} moves the end.
   *
   * @param _newParam - Parameter to extend to
   * @returns True when the curve was modified; false when `newParam` is
   *   inside the curve or the curve cannot be extended
   */
  extend(_newParam: number): boolean {
    return false
  }

  /**
   * Extends the start or end of the curve in place to a point, like
   * ObjectARX `AcDbCurve::extend(Adesk::Boolean, const AcGePoint3d&)`.
   *
   * The point must lie on the natural extension of the curve beyond that end
   * (within tolerance); otherwise false is returned and the curve is left
   * unchanged.
   *
   * @param _extendStart - True to extend the start, false to extend the end
   * @param _toPoint - Target point in WCS
   * @returns True when the curve was modified
   */
  extendToPoint(_extendStart: boolean, _toPoint: AcGePoint3dLike): boolean {
    return false
  }
}
