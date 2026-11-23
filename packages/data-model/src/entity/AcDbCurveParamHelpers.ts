import {
  AcGePoint3d,
  AcGePoint3dLike,
  AcGeVector3d,
  AcGeVector3dLike,
  DEFAULT_TOL,
  TAU
} from '@mlightcad/geometry-engine'

import type { AcDbCurve } from './AcDbCurve.js'
import type { AcDbEntity } from './AcDbEntity.js'

/**
 * Returns the distance tolerance used to decide whether a point lies on a
 * curve (or on its natural extension).
 *
 * It is a little looser than {@link DEFAULT_TOL} so that intersection points
 * computed by `intersectWith` (refined to a few `equalPointTol` for splines)
 * are accepted, and grows with the coordinate magnitude so drawings far from
 * the origin still work.
 *
 * @param scale - Typical coordinate magnitude of the curve
 * @returns Distance tolerance in drawing units
 */
export function acdbCurveOnTol(scale = 0): number {
  return Math.max(DEFAULT_TOL.equalPointTol * 10, Math.abs(scale) * 1e-9)
}

/**
 * Normalizes split parameters following ObjectARX `getSplitCurves` rules.
 *
 * - Open curves: parameters not strictly inside `(start, end)` are dropped.
 * - Closed curves: parameters are wrapped into `[start, end)`.
 * - The result is sorted ascending and de-duplicated with `paramTol`.
 *
 * @param params - Raw split parameters
 * @param start - Start parameter of the curve
 * @param end - End parameter of the curve
 * @param closed - Whether the curve is periodic over `[start, end]`
 * @param paramTol - Parameter tolerance
 * @returns Valid, sorted, unique parameters
 */
export function acdbNormalizeSplitParams(
  params: readonly number[],
  start: number,
  end: number,
  closed: boolean,
  paramTol: number
): number[] {
  const period = end - start
  const values: number[] = []
  for (const raw of params) {
    if (!Number.isFinite(raw)) continue
    let p = raw
    if (closed) {
      if (!(period > 0) || !Number.isFinite(period)) continue
      p = start + ((((p - start) % period) + period) % period)
      if (p > end - paramTol) p = start
      if (Math.abs(p - start) <= paramTol) p = start
    } else if (!(p > start + paramTol && p < end - paramTol)) {
      continue
    }
    values.push(p)
  }
  values.sort((a, b) => a - b)
  const unique: number[] = []
  for (const p of values) {
    if (unique.length === 0 || p - unique[unique.length - 1] > paramTol) {
      unique.push(p)
    }
  }
  if (
    closed &&
    unique.length > 1 &&
    unique[0] + period - unique[unique.length - 1] <= paramTol
  ) {
    unique.pop()
  }
  return unique
}

/**
 * Splits a curve into pieces using {@link acdbNormalizeSplitParams} and the
 * ObjectARX ordering rules.
 *
 * - Open curve, `n` params: `[start,p1], [p1,p2], ..., [pn,end]`.
 * - Closed curve, `n >= 2` params: `[p1,p2], ..., [pn, p1 + period]` — the last
 *   piece wraps through the start/end seam, so its end parameter is larger
 *   than `end`.
 *
 * @param params - Raw split parameters
 * @param start - Start parameter of the curve
 * @param end - End parameter of the curve
 * @param closed - Whether the curve is periodic over `[start, end]`
 * @param paramTol - Parameter tolerance
 * @param makePiece - Builds one piece for `[from, to]`; returns `undefined`
 *   for a degenerate piece, which is dropped
 * @returns Pieces in curve order
 */
export function acdbSplitCurveByParams(
  params: readonly number[],
  start: number,
  end: number,
  closed: boolean,
  paramTol: number,
  makePiece: (from: number, to: number) => AcDbCurve | undefined
): AcDbCurve[] {
  const valid = acdbNormalizeSplitParams(params, start, end, closed, paramTol)
  const bounds: [number, number][] = []
  if (closed) {
    if (valid.length < 2) return []
    for (let i = 0; i < valid.length - 1; i++) {
      bounds.push([valid[i], valid[i + 1]])
    }
    bounds.push([valid[valid.length - 1], valid[0] + (end - start)])
  } else {
    if (valid.length === 0) return []
    const all = [start, ...valid, end]
    for (let i = 0; i < all.length - 1; i++) bounds.push([all[i], all[i + 1]])
  }
  const pieces: AcDbCurve[] = []
  for (const [from, to] of bounds) {
    if (!(to - from > paramTol)) continue
    const piece = makePiece(from, to)
    if (piece) pieces.push(piece)
  }
  return pieces
}

/**
 * Detaches a cloned split piece from its source's database identity: the
 * owner and extension dictionary references are removed (the clone already
 * received a fresh temporary object id).
 *
 * @param entity - Freshly cloned entity
 * @returns The same entity
 */
export function acdbDetachSplitPiece<T extends AcDbEntity>(entity: T): T {
  entity.attrs.set('ownerId', undefined, { unset: true, silent: true })
  entity.attrs.set('extensionDictionary', undefined, {
    unset: true,
    silent: true
  })
  return entity
}

/** Normalizes an angle into `[0, 2π)`. */
export function acdbNormalizeAngle(angle: number): number {
  return ((angle % TAU) + TAU) % TAU
}

/**
 * Decomposes `point` in the plane frame `(center, xAxis, normal)` of a circle
 * or ellipse.
 *
 * @returns Local `x` / `y` coordinates and the signed distance to the plane
 */
export function acdbPlaneCoords(
  center: AcGePoint3dLike,
  xAxis: AcGeVector3dLike,
  normal: AcGeVector3dLike,
  point: AcGePoint3dLike
): { x: number; y: number; h: number } {
  const n = new AcGeVector3d(normal).normalize()
  const xa = new AcGeVector3d(xAxis).normalize()
  const ya = new AcGeVector3d().crossVectors(n, xa).normalize()
  const v = new AcGeVector3d(
    point.x - center.x,
    point.y - center.y,
    (point.z ?? 0) - (center.z ?? 0)
  )
  return { x: v.dot(xa), y: v.dot(ya), h: v.dot(n) }
}

/**
 * Polar angle (around `normal`, measured from `refVec`, in `[0, 2π)`) of
 * `point` relative to a circle, plus the distance from the point to the
 * circle.
 *
 * @param center - Circle center
 * @param radius - Circle radius
 * @param refVec - Direction of angle 0
 * @param normal - Circle normal
 * @param point - Query point
 */
export function acdbCircleAngleOf(
  center: AcGePoint3dLike,
  radius: number,
  refVec: AcGeVector3dLike,
  normal: AcGeVector3dLike,
  point: AcGePoint3dLike
): { angle: number; dist: number; rho: number } {
  const { x, y, h } = acdbPlaneCoords(center, refVec, normal, point)
  const rho = Math.hypot(x, y)
  const angle = rho > 0 ? acdbNormalizeAngle(Math.atan2(y, x)) : 0
  return { angle, dist: Math.hypot(h, rho - radius), rho }
}

/**
 * Maps WCS points to the coordinate system of an {@link AcDbCurvePath}
 * (OCS relative to the elevation for 2D polylines) and back. The mapping
 * must be a rigid motion so distances are preserved.
 */
export interface AcDbCurvePathFrame {
  toPath(point: AcGePoint3dLike): AcGePoint3dLike
  fromPath(point: AcGePoint3dLike): AcGePoint3d
}

/** Identity {@link AcDbCurvePathFrame} (3D polylines). */
export const ACDB_IDENTITY_PATH_FRAME: AcDbCurvePathFrame = {
  toPath: point => point,
  fromPath: point => new AcGePoint3d(point.x, point.y, point.z ?? 0)
}

/**
 * WCS-level parameter, split and extend operations of a polyline-like curve
 * built on an {@link AcDbCurvePath}. Shared by `AcDbPolyline`,
 * `AcDb2dPolyline` and `AcDb3dPolyline`.
 *
 * @internal
 */
export class AcDbCurvePathOps {
  readonly path: AcDbCurvePath
  readonly frame: AcDbCurvePathFrame
  /** Distance tolerance. */
  readonly tol: number
  /** Parameter tolerance (vertex-index units). */
  readonly paramTol: number

  constructor(
    vertices: readonly AcDbCurvePathVertex[],
    closed: boolean,
    frame: AcDbCurvePathFrame,
    extraScale = 0
  ) {
    this.path = new AcDbCurvePath(vertices, closed)
    this.frame = frame
    this.tol = acdbCurveOnTol(this.path.scale + Math.abs(extraScale))
    let maxLen = 0
    for (const seg of this.path.segments) maxLen = Math.max(maxLen, seg.length)
    this.paramTol = maxLen > 0 ? Math.min(1e-6, this.tol / maxLen) : 1e-9
  }

  get endParam() {
    return this.path.segmentCount
  }

  paramAtPoint(point: AcGePoint3dLike): number | undefined {
    return this.path.paramAt(this.frame.toPath(point), this.tol)
  }

  pointAtParam(param: number): AcGePoint3d | undefined {
    const p = this.path.pointAt(param)
    return p ? this.frame.fromPath(p) : undefined
  }

  closestPoint(point: AcGePoint3dLike, extend: boolean): AcGePoint3d {
    return this.frame.fromPath(
      this.path.closestPoint(this.frame.toPath(point), extend)
    )
  }

  distAtParam(param: number): number | undefined {
    return this.path.distAt(param)
  }

  /**
   * Splits the path; `makePiece` receives the open vertex list of each piece
   * (in path coordinates).
   */
  split(
    params: readonly number[],
    makePiece: (vertices: AcDbCurvePathVertex[]) => AcDbCurve | undefined
  ): AcDbCurve[] {
    if (this.path.segmentCount === 0) return []
    return acdbSplitCurveByParams(
      params,
      0,
      this.path.segmentCount,
      this.path.closed,
      this.paramTol,
      (from, to) => {
        const vertices = this.path.subVertices(from, to)
        if (vertices.length < 2) return undefined
        if (new AcDbCurvePath(vertices, false).length <= this.tol) {
          return undefined
        }
        return makePiece(vertices)
      }
    )
  }

  /** Vertices after extending to `newParam`, or `undefined`. */
  extendedVertices(newParam: number): AcDbCurvePathVertex[] | undefined {
    return this.path.extendedVertices(newParam, this.paramTol)
  }

  /** Parameter of a point on the extension beyond the start / end. */
  extensionParam(
    extendStart: boolean,
    point: AcGePoint3dLike
  ): number | undefined {
    return this.path.extensionParamAt(
      extendStart,
      this.frame.toPath(point),
      this.tol
    )
  }
}

/** Vertex of an {@link AcDbCurvePath}. */
export interface AcDbCurvePathVertex {
  x: number
  y: number
  z?: number
  bulge?: number
  startWidth?: number
  endWidth?: number
}

interface PathSegment {
  ax: number
  ay: number
  az: number
  bx: number
  by: number
  bz: number
  /** Included angle (signed, CCW positive); 0 for a straight segment. */
  theta: number
  cx: number
  cy: number
  r: number
  /** Polar angle of the start point around the center. */
  a0: number
  length: number
  startWidth?: number
  endWidth?: number
}

const BULGE_EPS = 1e-10

/**
 * Vertex-index parameterization of a (possibly bulged) polyline path, as used
 * by ObjectARX for `AcDbPolyline`, `AcDb2dPolyline` and `AcDb3dPolyline`.
 *
 * The parameter is `vertexIndex + fraction`; the fraction is the arc-length
 * fraction of that segment (equal to the angle fraction for bulge arcs).
 * Arcs are evaluated in the XY plane of the path coordinates (OCS for 2D
 * polylines); straight segments are full 3D.
 *
 * @internal
 */
export class AcDbCurvePath {
  readonly closed: boolean
  readonly vertices: readonly AcDbCurvePathVertex[]
  readonly segments: PathSegment[]

  constructor(vertices: readonly AcDbCurvePathVertex[], closed: boolean) {
    this.vertices = vertices
    this.closed = closed && vertices.length >= 2
    const n = vertices.length
    const count = n < 2 ? 0 : this.closed ? n : n - 1
    this.segments = []
    for (let i = 0; i < count; i++) {
      this.segments.push(
        createSegment(vertices[i], vertices[(i + 1) % n], vertices[i])
      )
    }
  }

  /** Number of segments (end parameter). */
  get segmentCount() {
    return this.segments.length
  }

  /**
   * Index of the segment whose natural extension continues the start (first
   * non-degenerate segment) or the end (last non-degenerate segment) of an
   * open path. Duplicated end vertices are common in imported drawings and
   * must not block extension.
   */
  private endSegmentIndex(atStart: boolean): number {
    const count = this.segmentCount
    if (atStart) {
      for (let i = 0; i < count; i++) if (this.segments[i].length > 0) return i
      return 0
    }
    for (let i = count - 1; i >= 0; i--) {
      if (this.segments[i].length > 0) return i
    }
    return count - 1
  }

  /** Characteristic coordinate magnitude used for tolerances. */
  get scale() {
    let s = 0
    for (const v of this.vertices) {
      s = Math.max(s, Math.abs(v.x), Math.abs(v.y), Math.abs(v.z ?? 0))
    }
    return s
  }

  /**
   * Splits `param` into a segment index and a fraction. Parameters before
   * the start / after the end of an open path map onto the first / last
   * non-degenerate segment with a fraction `< 0` / `> 1` (natural extension).
   */
  locate(param: number): { index: number; f: number } | undefined {
    const count = this.segmentCount
    if (count === 0 || !Number.isFinite(param)) return undefined
    if (this.closed) {
      if (param < 0 || param > count) {
        param = ((param % count) + count) % count
      }
    } else if (param < 0) {
      return { index: this.endSegmentIndex(true), f: param }
    } else if (param > count) {
      return { index: this.endSegmentIndex(false), f: 1 + param - count }
    }
    let index = Math.floor(param)
    if (index >= count) index = count - 1
    return { index, f: param - index }
  }

  /** Point at `param` (open paths extend along their end segments). */
  pointAt(param: number): AcGePoint3d | undefined {
    const loc = this.locate(param)
    if (!loc) return undefined
    return segmentPoint(this.segments[loc.index], loc.f)
  }

  /** Distance along the path from the start to `param`. */
  distAt(param: number): number | undefined {
    const loc = this.locate(param)
    if (!loc) return undefined
    let dist = 0
    for (let i = 0; i < loc.index; i++) dist += this.segments[i].length
    return dist + this.segments[loc.index].length * loc.f
  }

  /** Total length. */
  get length() {
    return this.segments.reduce((sum, seg) => sum + seg.length, 0)
  }

  /**
   * Parameter of a point on the path. For open paths, a point on the natural
   * extension of the first segment (param `< 0`) or of the last segment
   * (param `> segmentCount`) is also accepted.
   */
  paramAt(point: AcGePoint3dLike, tol: number): number | undefined {
    let best: { param: number; dist: number } | undefined
    const count = this.segmentCount
    for (let i = 0; i < count; i++) {
      const seg = this.segments[i]
      if (seg.length <= 0) continue
      const proj = projectOnSegment(seg, point, false)
      if (proj.dist > tol) continue
      if (!best || proj.dist < best.dist - 1e-15) {
        best = { param: i + proj.f, dist: proj.dist }
      }
    }
    if (best) {
      if (this.closed && best.param >= count) best.param -= count
      return best.param
    }
    if (this.closed) return undefined
    const atStart = this.extensionParamAt(true, point, tol)
    const atEnd = this.extensionParamAt(false, point, tol)
    if (atStart === undefined) return atEnd
    if (atEnd === undefined) return atStart
    // Single-segment path: pick the extension that needs less lengthening.
    return -atStart <= atEnd - count ? atStart : atEnd
  }

  /**
   * Parameter of a point on the natural extension beyond the start
   * (`atStart`, param `< 0`) or the end (param `> segmentCount`) of an open
   * path, or `undefined`.
   */
  extensionParamAt(
    atStart: boolean,
    point: AcGePoint3dLike,
    tol: number
  ): number | undefined {
    const count = this.segmentCount
    if (this.closed || count === 0) return undefined
    const seg = this.segments[this.endSegmentIndex(atStart)]
    if (seg.length <= 0) return undefined
    const proj = projectOnSegment(seg, point, true, atStart)
    if (proj.dist > tol) return undefined
    const segTol = tol / seg.length
    if (atStart) return proj.f < -segTol ? proj.f : undefined
    // Same mapping as `locate`: `count` is the end of that segment.
    return proj.f > 1 + segTol ? count - 1 + proj.f : undefined
  }

  /** Closest point on the path, optionally on its natural end extensions. */
  closestPoint(point: AcGePoint3dLike, extend: boolean): AcGePoint3d {
    const count = this.segmentCount
    if (count === 0) {
      const v = this.vertices[0]
      return new AcGePoint3d(v?.x ?? 0, v?.y ?? 0, v?.z ?? 0)
    }
    let best: AcGePoint3d | undefined
    let bestDist = Infinity
    const first = this.endSegmentIndex(true)
    const last = this.endSegmentIndex(false)
    for (let i = 0; i < count; i++) {
      const seg = this.segments[i]
      const extendSeg = extend && !this.closed && (i === first || i === last)
      let candidate: AcGePoint3d
      if (seg.length <= 0) {
        candidate = new AcGePoint3d(seg.ax, seg.ay, seg.az)
      } else if (extendSeg) {
        const allowStart = i === first
        const allowEnd = i === last
        candidate = closestOnSegment(seg, point, allowStart, allowEnd)
      } else {
        candidate = closestOnSegment(seg, point, false, false)
      }
      const d = candidate.distanceTo(point)
      if (d < bestDist) {
        bestDist = d
        best = candidate
      }
    }
    return best!
  }

  /**
   * Open vertex list tracing the path from `from` to `to` (`from < to`;
   * `to` may exceed `segmentCount` on closed paths to wrap through the
   * seam). Bulges of partial arc segments become `tan(subSweep / 4)` and
   * widths are interpolated linearly at the cut points. Zero-length segments
   * (duplicated vertices) are left out so pieces have no coincident vertices.
   */
  subVertices(from: number, to: number): AcDbCurvePathVertex[] {
    const count = this.segmentCount
    const result: AcDbCurvePathVertex[] = []
    if (count === 0 || !(to > from)) return result
    const firstIndex = Math.floor(from)
    let lastSegIndex = firstIndex
    let lastF = 1
    for (let k = firstIndex; k < to; k++) {
      const seg = this.segments[((k % count) + count) % count]
      const f0 = Math.max(0, from - k)
      const f1 = Math.min(1, to - k)
      if (!(f1 - f0 > 1e-12) || !(seg.length > 0)) continue
      const p = segmentPoint(seg, f0)
      const vertex: AcDbCurvePathVertex = {
        x: p.x,
        y: p.y,
        z: p.z,
        bulge: seg.theta === 0 ? 0 : Math.tan((seg.theta * (f1 - f0)) / 4)
      }
      if (seg.startWidth != null || seg.endWidth != null) {
        vertex.startWidth = lerpWidth(seg, f0)
        vertex.endWidth = lerpWidth(seg, f1)
      }
      result.push(vertex)
      lastSegIndex = k
      lastF = f1
    }
    if (result.length === 0) return result
    const lastSeg = this.segments[((lastSegIndex % count) + count) % count]
    const end = segmentPoint(lastSeg, lastF)
    const endVertex: AcDbCurvePathVertex = { x: end.x, y: end.y, z: end.z }
    // Keep the trailing vertex widths in line with the source so constant
    // width polylines stay constant width.
    const source =
      lastF >= 1 - 1e-12
        ? this.vertices[(lastSegIndex + 1) % this.vertices.length]
        : this.vertices[((lastSegIndex % count) + count) % count]
    if (source.startWidth != null || source.endWidth != null) {
      if (lastF >= 1 - 1e-12) {
        endVertex.startWidth = source.startWidth
        endVertex.endWidth = source.endWidth
      } else {
        const w = lerpWidth(lastSeg, lastF)
        endVertex.startWidth = w
        endVertex.endWidth = w
      }
    }
    result.push(endVertex)
    return result
  }

  /**
   * Vertex list of this open path extended to `newParam` (`< 0` extends the
   * start, `> segmentCount` the end), or `undefined` when not possible
   * (closed path, `newParam` inside the range, or an arc that would reach a
   * full turn).
   */
  extendedVertices(
    newParam: number,
    paramTol: number
  ): AcDbCurvePathVertex[] | undefined {
    const count = this.segmentCount
    if (this.closed || count === 0 || !Number.isFinite(newParam)) {
      return undefined
    }
    const vertices = this.vertices.map(v => ({ ...v }))
    // `loc.index` is the first / last non-degenerate segment. When it is not
    // the very first / last segment, the zero-length segments in front of /
    // behind it become the extension: the end vertex moves to the new point
    // and its segment gets the bulge of the extension part only.
    const bulgeOf = (seg: PathSegment, sweepFraction: number) =>
      seg.theta === 0 ? 0 : Math.tan((seg.theta * sweepFraction) / 4)
    if (newParam < -paramTol) {
      const loc = this.locate(newParam)!
      const seg = this.segments[loc.index]
      if (seg.length <= 0) return undefined
      if (Math.abs(seg.theta * (1 - newParam)) >= TAU - 1e-9) return undefined
      const p = segmentPoint(seg, newParam)
      vertices[0].x = p.x
      vertices[0].y = p.y
      vertices[0].z = p.z
      vertices[0].bulge =
        loc.index === 0 ? bulgeOf(seg, 1 - newParam) : bulgeOf(seg, -newParam)
      return vertices
    }
    if (newParam > count + paramTol) {
      const loc = this.locate(newParam)!
      const seg = this.segments[loc.index]
      if (seg.length <= 0) return undefined
      const f = loc.f
      if (Math.abs(seg.theta * f) >= TAU - 1e-9) return undefined
      const p = segmentPoint(seg, f)
      const last = vertices[count]
      last.x = p.x
      last.y = p.y
      last.z = p.z
      if (loc.index === count - 1) {
        vertices[count - 1].bulge = bulgeOf(seg, f)
      } else {
        vertices[count - 1].bulge = bulgeOf(seg, f - 1)
      }
      return vertices
    }
    return undefined
  }
}

function lerpWidth(seg: PathSegment, f: number) {
  const sw = seg.startWidth ?? 0
  const ew = seg.endWidth ?? 0
  return sw + (ew - sw) * f
}

function createSegment(
  a: AcDbCurvePathVertex,
  b: AcDbCurvePathVertex,
  widths: AcDbCurvePathVertex
): PathSegment {
  const ax = a.x
  const ay = a.y
  const az = a.z ?? 0
  const bx = b.x
  const by = b.y
  const bz = b.z ?? 0
  const bulge = a.bulge ?? 0
  const dx = bx - ax
  const dy = by - ay
  const chord = Math.hypot(dx, dy)
  const base = {
    ax,
    ay,
    az,
    bx,
    by,
    bz,
    startWidth: widths.startWidth,
    endWidth: widths.endWidth
  }
  if (Math.abs(bulge) <= BULGE_EPS || chord <= 0) {
    return {
      ...base,
      theta: 0,
      cx: 0,
      cy: 0,
      r: 0,
      a0: 0,
      length: Math.hypot(dx, dy, bz - az)
    }
  }
  const theta = 4 * Math.atan(bulge)
  const h = chord / (2 * Math.tan(theta / 2))
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  const cx = mx - (dy / chord) * h
  const cy = my + (dx / chord) * h
  const r = Math.hypot(ax - cx, ay - cy)
  return {
    ...base,
    theta,
    cx,
    cy,
    r,
    a0: Math.atan2(ay - cy, ax - cx),
    length: r * Math.abs(theta)
  }
}

function segmentPoint(seg: PathSegment, f: number): AcGePoint3d {
  if (seg.theta === 0) {
    return new AcGePoint3d(
      seg.ax + (seg.bx - seg.ax) * f,
      seg.ay + (seg.by - seg.ay) * f,
      seg.az + (seg.bz - seg.az) * f
    )
  }
  const angle = seg.a0 + seg.theta * f
  return new AcGePoint3d(
    seg.cx + seg.r * Math.cos(angle),
    seg.cy + seg.r * Math.sin(angle),
    seg.az + (seg.bz - seg.az) * f
  )
}

/**
 * Projects `point` onto a segment. Straight segments return the (unclamped)
 * fraction of the foot point. Arc segments return the fraction of the point's
 * angle measured in travel direction; outside the arc (`extension`), the
 * point is mapped beyond the start (`< 0`) when `preferStart`, else beyond
 * the end (`> 1`).
 */
function projectOnSegment(
  seg: PathSegment,
  point: AcGePoint3dLike,
  extension: boolean,
  preferStart = false
): { f: number; dist: number } {
  const px = point.x
  const py = point.y
  const pz = point.z ?? 0
  if (seg.theta === 0) {
    const dx = seg.bx - seg.ax
    const dy = seg.by - seg.ay
    const dz = seg.bz - seg.az
    const len2 = dx * dx + dy * dy + dz * dz
    const f =
      ((px - seg.ax) * dx + (py - seg.ay) * dy + (pz - seg.az) * dz) / len2
    const fx = seg.ax + dx * f
    const fy = seg.ay + dy * f
    const fz = seg.az + dz * f
    const dist = Math.hypot(px - fx, py - fy, pz - fz)
    if (!extension && (f < 0 || f > 1)) {
      const fc = Math.max(0, Math.min(1, f))
      return {
        f: fc,
        dist: Math.hypot(
          px - (seg.ax + dx * fc),
          py - (seg.ay + dy * fc),
          pz - (seg.az + dz * fc)
        )
      }
    }
    return { f, dist }
  }
  const sweep = Math.abs(seg.theta)
  const dir = Math.sign(seg.theta)
  const angle = Math.atan2(py - seg.cy, px - seg.cx)
  let u = (((dir * (angle - seg.a0)) % TAU) + TAU) % TAU
  const radial = Math.hypot(px - seg.cx, py - seg.cy) - seg.r
  const dz = pz - seg.az
  const onCircleDist = Math.hypot(radial, dz)
  // Points just before the start wrap to ~2π; snap them back.
  const angTol = 1e-12
  if (u > TAU - angTol) u = 0
  if (u <= sweep + angTol) {
    return { f: u / sweep, dist: onCircleDist }
  }
  if (extension) {
    const f = preferStart ? -(TAU - u) / sweep : u / sweep
    return { f, dist: onCircleDist }
  }
  const pa = segmentPoint(seg, 0)
  const pb = segmentPoint(seg, 1)
  const da = pa.distanceTo(point)
  const db = pb.distanceTo(point)
  return da <= db ? { f: 0, dist: da } : { f: 1, dist: db }
}

function closestOnSegment(
  seg: PathSegment,
  point: AcGePoint3dLike,
  extendStart: boolean,
  extendEnd: boolean
): AcGePoint3d {
  if (seg.theta === 0) {
    const proj = projectOnSegment(seg, point, true)
    let f = proj.f
    if (!extendStart) f = Math.max(0, f)
    if (!extendEnd) f = Math.min(1, f)
    return segmentPoint(seg, f)
  }
  const sweep = Math.abs(seg.theta)
  const dir = Math.sign(seg.theta)
  const px = point.x - seg.cx
  const py = point.y - seg.cy
  if (Math.hypot(px, py) <= 0) return segmentPoint(seg, 0)
  const angle = Math.atan2(py, px)
  const u = (((dir * (angle - seg.a0)) % TAU) + TAU) % TAU
  if (u <= sweep) return segmentPoint(seg, u / sweep)
  if (extendStart || extendEnd) {
    // Natural extension of an end arc is the full circle.
    const p = new AcGePoint3d(
      seg.cx + seg.r * Math.cos(angle),
      seg.cy + seg.r * Math.sin(angle),
      seg.az
    )
    return p
  }
  const pa = segmentPoint(seg, 0)
  const pb = segmentPoint(seg, 1)
  return pa.distanceTo(point) <= pb.distanceTo(point) ? pa : pb
}
