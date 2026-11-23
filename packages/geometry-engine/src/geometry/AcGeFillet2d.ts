import { AcGePoint2d, AcGePoint2dLike } from '../math/index.js'
import { AcGeMathUtil, AcGeTol, DEFAULT_TOL, FLOAT_TOL } from '../util/index.js'
import { AcGeCircArc2d } from './AcGeCircArc2d.js'
import {
  acgeAngleAtCenter2d,
  acgeDistance2d
} from './AcGeCircArcUtil.js'
import { AcGeCurveExtent } from './AcGeCurveIntersect.js'
import { AcGeEllipseArc2d } from './AcGeEllipseArc2d.js'
import { AcGeSpline3d } from './AcGeSpline3d.js'

/**
 * Error codes returned when a 2D fillet cannot be constructed.
 */
export type AcGeFillet2dError =
  | 'invalidRadius'
  | 'parallel'
  | 'noIntersection'
  | 'radiusTooLarge'
  | 'noSolution'
  | 'unsupported'

/**
 * Linear fillet operand in XY (segment, ray, or infinite line).
 */
export interface AcGeFilletLine2d {
  kind: 'line'
  start: AcGePoint2dLike
  end: AcGePoint2dLike
  extent?: AcGeCurveExtent
}

/**
 * Circular arc / full circle fillet operand in XY.
 */
export interface AcGeFilletCircArc2d {
  kind: 'circArc'
  center: AcGePoint2dLike
  radius: number
  startAngle: number
  endAngle: number
  clockwise?: boolean
  /** When true the arc is treated as a full circle (not trimmed). */
  closed?: boolean
}

/**
 * Elliptical arc fillet operand in XY (solved numerically).
 */
export interface AcGeFilletEllipseArc2d {
  kind: 'ellipseArc'
  center: AcGePoint2dLike
  majorRadius: number
  minorRadius: number
  startAngle: number
  endAngle: number
  clockwise?: boolean
  closed?: boolean
  /** Rotation of the major axis from +X, radians. Defaults to 0. */
  rotation?: number
}

/**
 * Spline fillet operand (solved by sampling in XY, z ignored).
 */
export interface AcGeFilletSpline2d {
  kind: 'spline'
  /** Sampled polyline approximation in XY (at least 2 points). */
  samples: readonly AcGePoint2dLike[]
}

/**
 * Union of planar curve primitives accepted by {@link acgeFilletCurves2d}.
 */
export type AcGeFilletPrimitive2d =
  | AcGeFilletLine2d
  | AcGeFilletCircArc2d
  | AcGeFilletEllipseArc2d
  | AcGeFilletSpline2d

/**
 * Successful fillet solution.
 */
export interface AcGeFillet2dResult {
  /** Fillet arc, omitted when radius is zero (sharp corner). */
  arc?: AcGeCircArc2d
  /** Trim / touch point on the first curve. */
  trimA: AcGePoint2d
  /** Trim / touch point on the second curve. */
  trimB: AcGePoint2d
  /** Fillet center when an arc was created. */
  center?: AcGePoint2d
  /** Effective radius (may differ from the request for parallel lines). */
  radius: number
}

/**
 * Options for {@link acgeFilletCurves2d}.
 */
export interface AcGeFillet2dOptions {
  /** Requested fillet radius. Zero produces a sharp corner at the intersection. */
  radius: number
  /** Pick near the first curve; selects which corner / solution. */
  hintA?: AcGePoint2dLike
  /** Pick near the second curve; selects which corner / solution. */
  hintB?: AcGePoint2dLike
  /** Geometric tolerance. */
  tol?: AcGeTol
}

/**
 * Failure payload from {@link acgeFilletCurves2d}.
 */
export interface AcGeFillet2dFailure {
  ok: false
  error: AcGeFillet2dError
}

/**
 * Success payload from {@link acgeFilletCurves2d}.
 */
export interface AcGeFillet2dSuccess {
  ok: true
  result: AcGeFillet2dResult
}

export type AcGeFillet2dOutcome = AcGeFillet2dSuccess | AcGeFillet2dFailure

interface LineGeom {
  origin: AcGePoint2d
  dir: AcGePoint2d
  length: number
  extent: AcGeCurveExtent
}

interface CircGeom {
  center: AcGePoint2d
  radius: number
  startAngle: number
  endAngle: number
  clockwise: boolean
  closed: boolean
}

/**
 * Computes a 2D fillet between two planar curve primitives.
 *
 * Analytic solvers cover line–line, line–circle, and circle–circle. Ellipse and
 * spline operands are approximated by sampling then refined against the circle
 * of the requested radius.
 *
 * @param a - First curve primitive
 * @param b - Second curve primitive
 * @param options - Radius and optional pick hints
 */
export function acgeFilletCurves2d(
  a: AcGeFilletPrimitive2d,
  b: AcGeFilletPrimitive2d,
  options: AcGeFillet2dOptions
): AcGeFillet2dOutcome {
  const radius = options.radius
  if (!Number.isFinite(radius) || radius < 0) {
    return { ok: false, error: 'invalidRadius' }
  }
  const tol = options.tol ?? DEFAULT_TOL

  if (a.kind === 'line' && b.kind === 'line') {
    return filletLineLine(a, b, radius, options.hintA, options.hintB, tol)
  }
  if (a.kind === 'line' && b.kind === 'circArc') {
    return filletLineCirc(a, b, radius, options.hintA, options.hintB, tol)
  }
  if (a.kind === 'circArc' && b.kind === 'line') {
    const swapped = filletLineCirc(
      b,
      a,
      radius,
      options.hintB,
      options.hintA,
      tol
    )
    return swapOutcome(swapped)
  }
  if (a.kind === 'circArc' && b.kind === 'circArc') {
    return filletCircCirc(a, b, radius, options.hintA, options.hintB, tol)
  }

  // Ellipse / spline: sample to polyline segments and try line–line against
  // the nearest segment of each operand (and circ when mixed).
  return filletNumeric(a, b, radius, options.hintA, options.hintB, tol)
}

/**
 * Builds a fillet between two infinite or bounded lines.
 */
function filletLineLine(
  a: AcGeFilletLine2d,
  b: AcGeFilletLine2d,
  radius: number,
  hintA: AcGePoint2dLike | undefined,
  hintB: AcGePoint2dLike | undefined,
  tol: AcGeTol
): AcGeFillet2dOutcome {
  const la = toLineGeom(a)
  const lb = toLineGeom(b)
  if (la.length < FLOAT_TOL || lb.length < FLOAT_TOL) {
    return { ok: false, error: 'noSolution' }
  }

  const cross = la.dir.x * lb.dir.y - la.dir.y * lb.dir.x
  if (Math.abs(cross) < tol.equalVectorTol) {
    return filletParallelLines(la, lb, radius, hintA, hintB, tol)
  }

  const corner = intersectInfinite(la, lb)
  if (!corner) return { ok: false, error: 'noIntersection' }

  if (AcGeTol.isNonPositive(radius)) {
    return {
      ok: true,
      result: {
        trimA: corner.clone(),
        trimB: corner.clone(),
        radius: 0
      }
    }
  }

  const candidates: AcGeFillet2dResult[] = []
  for (const s1 of [1, -1] as const) {
    for (const s2 of [1, -1] as const) {
      const offsetA = offsetLine(la, s1 * radius)
      const offsetB = offsetLine(lb, s2 * radius)
      const center = intersectInfinite(offsetA, offsetB)
      if (!center) continue

      const trimA = projectToInfinite(la, center)
      const trimB = projectToInfinite(lb, center)
      const dA = acgeDistance2d(center, trimA)
      const dB = acgeDistance2d(center, trimB)
      if (
        Math.abs(dA - radius) > tol.equalPointTol * 10 ||
        Math.abs(dB - radius) > tol.equalPointTol * 10
      ) {
        continue
      }

      // Arc must turn through the corner (smaller turn toward P).
      const arc = buildFilletArc(center, radius, trimA, trimB, corner)
      if (!arc) continue

      candidates.push({
        arc,
        trimA,
        trimB,
        center,
        radius
      })
    }
  }

  if (candidates.length === 0) {
    return { ok: false, error: 'noSolution' }
  }

  const best = pickBestCandidate(candidates, hintA, hintB, corner)
  return { ok: true, result: best }
}

/**
 * AutoCAD parallel-line fillet: radius becomes half the gap; builds a semicircle.
 */
function filletParallelLines(
  la: LineGeom,
  lb: LineGeom,
  _requestedRadius: number,
  hintA: AcGePoint2dLike | undefined,
  hintB: AcGePoint2dLike | undefined,
  tol: AcGeTol
): AcGeFillet2dOutcome {
  const n = new AcGePoint2d(-la.dir.y, la.dir.x)
  const gap = (lb.origin.x - la.origin.x) * n.x + (lb.origin.y - la.origin.y) * n.y
  const absGap = Math.abs(gap)
  if (absGap < tol.equalPointTol) {
    return { ok: false, error: 'parallel' }
  }
  const radius = absGap / 2
  const sign = gap > 0 ? 1 : -1

  // Midline between the two parallels.
  const midOrigin = new AcGePoint2d(
    la.origin.x + n.x * sign * radius,
    la.origin.y + n.y * sign * radius
  )

  const pick =
    hintA && hintB
      ? midpoint2d(hintA, hintB)
      : hintA
        ? new AcGePoint2d(hintA)
        : hintB
          ? new AcGePoint2d(hintB)
          : new AcGePoint2d(
              (la.origin.x + lb.origin.x) / 2,
              (la.origin.y + lb.origin.y) / 2
            )

  const center = projectToInfinite({ ...la, origin: midOrigin }, pick)
  const trimA = new AcGePoint2d(
    center.x - n.x * sign * radius,
    center.y - n.y * sign * radius
  )
  const trimB = new AcGePoint2d(
    center.x + n.x * sign * radius,
    center.y + n.y * sign * radius
  )

  // Prefer the semicircle whose bulge faces the average of the picks along dir.
  const through = new AcGePoint2d(
    center.x + la.dir.x * radius,
    center.y + la.dir.y * radius
  )
  const throughAlt = new AcGePoint2d(
    center.x - la.dir.x * radius,
    center.y - la.dir.y * radius
  )
  const preferThrough =
    acgeDistance2d(through, pick) <= acgeDistance2d(throughAlt, pick)
      ? through
      : throughAlt

  const arc = AcGeCircArc2d.tryCreateByThreePoints(trimA, preferThrough, trimB)
  if (!arc) return { ok: false, error: 'noSolution' }

  return {
    ok: true,
    result: { arc, trimA, trimB, center, radius }
  }
}

/**
 * Fillet between a line and a circular arc / circle.
 */
function filletLineCirc(
  line: AcGeFilletLine2d,
  circ: AcGeFilletCircArc2d,
  radius: number,
  hintA: AcGePoint2dLike | undefined,
  hintB: AcGePoint2dLike | undefined,
  tol: AcGeTol
): AcGeFillet2dOutcome {
  const la = toLineGeom(line)
  const ca = toCircGeom(circ)
  if (la.length < FLOAT_TOL || ca.radius < FLOAT_TOL) {
    return { ok: false, error: 'noSolution' }
  }

  if (AcGeTol.isNonPositive(radius)) {
    return filletLineCircZero(la, ca, hintA, hintB, tol)
  }

  const candidates: AcGeFillet2dResult[] = []
  for (const sLine of [1, -1] as const) {
    for (const sCirc of [1, -1] as const) {
      const offsetR = ca.radius + sCirc * radius
      if (offsetR < FLOAT_TOL) continue
      const offsetLineGeom = offsetLine(la, sLine * radius)
      const centers = intersectLineCircle(
        offsetLineGeom,
        ca.center,
        offsetR,
        tol
      )
      for (const center of centers) {
        const trimA = projectToInfinite(la, center)
        const toCenter = new AcGePoint2d(
          center.x - ca.center.x,
          center.y - ca.center.y
        )
        const len = Math.hypot(toCenter.x, toCenter.y)
        if (len < FLOAT_TOL) continue
        const trimB = new AcGePoint2d(
          ca.center.x + (toCenter.x / len) * ca.radius,
          ca.center.y + (toCenter.y / len) * ca.radius
        )
        if (!pointOnCirc(ca, trimB, tol) && !ca.closed) continue

        const midHint = midpointOptional(hintA, hintB) ?? cornerHint(trimA, trimB)
        const arc = buildFilletArc(center, radius, trimA, trimB, midHint)
        if (!arc) continue
        candidates.push({ arc, trimA, trimB, center, radius })
      }
    }
  }

  if (candidates.length === 0) return { ok: false, error: 'noSolution' }
  const hint = midpointOptional(hintA, hintB)
  const best = pickBestCandidate(candidates, hintA, hintB, hint)
  return { ok: true, result: best }
}

function filletLineCircZero(
  la: LineGeom,
  ca: CircGeom,
  hintA: AcGePoint2dLike | undefined,
  hintB: AcGePoint2dLike | undefined,
  tol: AcGeTol
): AcGeFillet2dOutcome {
  const hits = intersectLineCircle(la, ca.center, ca.radius, tol)
  if (hits.length === 0) return { ok: false, error: 'noIntersection' }
  const hint = midpointOptional(hintA, hintB)
  let best = hits[0]
  let bestDist = Infinity
  for (const hit of hits) {
    const d = hint ? acgeDistance2d(hit, hint) : 0
    if (d < bestDist) {
      bestDist = d
      best = hit
    }
  }
  return {
    ok: true,
    result: {
      trimA: best.clone(),
      trimB: best.clone(),
      radius: 0
    }
  }
}

/**
 * Fillet between two circular arcs / circles.
 */
function filletCircCirc(
  a: AcGeFilletCircArc2d,
  b: AcGeFilletCircArc2d,
  radius: number,
  hintA: AcGePoint2dLike | undefined,
  hintB: AcGePoint2dLike | undefined,
  tol: AcGeTol
): AcGeFillet2dOutcome {
  const ca = toCircGeom(a)
  const cb = toCircGeom(b)

  if (AcGeTol.isNonPositive(radius)) {
    const hits = intersectCircles(ca.center, ca.radius, cb.center, cb.radius, tol)
    if (hits.length === 0) return { ok: false, error: 'noIntersection' }
    const hint = midpointOptional(hintA, hintB)
    let best = hits[0]
    let bestDist = Infinity
    for (const hit of hits) {
      const d = hint ? acgeDistance2d(hit, hint) : 0
      if (d < bestDist) {
        bestDist = d
        best = hit
      }
    }
    return {
      ok: true,
      result: { trimA: best.clone(), trimB: best.clone(), radius: 0 }
    }
  }

  const candidates: AcGeFillet2dResult[] = []
  for (const sA of [1, -1] as const) {
    for (const sB of [1, -1] as const) {
      const rA = ca.radius + sA * radius
      const rB = cb.radius + sB * radius
      if (rA < FLOAT_TOL || rB < FLOAT_TOL) continue
      const centers = intersectCircles(ca.center, rA, cb.center, rB, tol)
      for (const center of centers) {
        const trimA = radialPoint(ca.center, ca.radius, center)
        const trimB = radialPoint(cb.center, cb.radius, center)
        if (!trimA || !trimB) continue
        if (!ca.closed && !pointOnCirc(ca, trimA, tol)) continue
        if (!cb.closed && !pointOnCirc(cb, trimB, tol)) continue
        const midHint = midpointOptional(hintA, hintB) ?? cornerHint(trimA, trimB)
        const arc = buildFilletArc(center, radius, trimA, trimB, midHint)
        if (!arc) continue
        candidates.push({ arc, trimA, trimB, center, radius })
      }
    }
  }

  if (candidates.length === 0) return { ok: false, error: 'noSolution' }
  const best = pickBestCandidate(
    candidates,
    hintA,
    hintB,
    midpointOptional(hintA, hintB)
  )
  return { ok: true, result: best }
}

/**
 * Numeric fillet for ellipse / spline (and mixed) by sampling to polylines.
 */
function filletNumeric(
  a: AcGeFilletPrimitive2d,
  b: AcGeFilletPrimitive2d,
  radius: number,
  hintA: AcGePoint2dLike | undefined,
  hintB: AcGePoint2dLike | undefined,
  tol: AcGeTol
): AcGeFillet2dOutcome {
  const samplesA = samplePrimitive(a)
  const samplesB = samplePrimitive(b)
  if (samplesA.length < 2 || samplesB.length < 2) {
    return { ok: false, error: 'unsupported' }
  }

  const segA = nearestSegment(samplesA, hintA ?? samplesA[0])
  const segB = nearestSegment(samplesB, hintB ?? samplesB[0])
  if (!segA || !segB) return { ok: false, error: 'noSolution' }

  if (a.kind === 'circArc') {
    const mixed = filletLineCirc(
      { kind: 'line', start: segB.p0, end: segB.p1, extent: 'bounded' },
      a,
      radius,
      hintB,
      hintA,
      tol
    )
    if (mixed.ok) return swapOutcome(mixed)
  }
  if (b.kind === 'circArc') {
    const mixed = filletLineCirc(
      { kind: 'line', start: segA.p0, end: segA.p1, extent: 'bounded' },
      b,
      radius,
      hintA,
      hintB,
      tol
    )
    if (mixed.ok) return mixed
  }

  return filletLineLine(
    { kind: 'line', start: segA.p0, end: segA.p1, extent: 'bounded' },
    { kind: 'line', start: segB.p0, end: segB.p1, extent: 'bounded' },
    radius,
    hintA,
    hintB,
    tol
  )
}

function samplePrimitive(p: AcGeFilletPrimitive2d): AcGePoint2d[] {
  if (p.kind === 'line') {
    return [new AcGePoint2d(p.start), new AcGePoint2d(p.end)]
  }
  if (p.kind === 'circArc') {
    return sampleCirc(p, 64)
  }
  if (p.kind === 'ellipseArc') {
    return sampleEllipse(p, 96)
  }
  return p.samples.map(s => new AcGePoint2d(s))
}

function sampleCirc(c: AcGeFilletCircArc2d, count: number): AcGePoint2d[] {
  const pts: AcGePoint2d[] = []
  const start = AcGeMathUtil.normalizeAngle(c.startAngle)
  const n = Math.max(8, count)
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const use = c.closed
      ? start + Math.PI * 2 * t
      : c.clockwise
        ? start - AcGeMathUtil.normalizeAngle(c.startAngle - c.endAngle) * t
        : start + AcGeMathUtil.normalizeAngle(c.endAngle - c.startAngle) * t
    pts.push(
      new AcGePoint2d(
        c.center.x + c.radius * Math.cos(use),
        c.center.y + c.radius * Math.sin(use)
      )
    )
  }
  return pts
}

function sampleEllipse(
  e: AcGeFilletEllipseArc2d,
  count: number
): AcGePoint2d[] {
  const pts: AcGePoint2d[] = []
  const rotation = e.rotation ?? 0
  const cosR = Math.cos(rotation)
  const sinR = Math.sin(rotation)
  const n = Math.max(8, count)
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const ang = e.closed
      ? e.startAngle + Math.PI * 2 * t
      : e.clockwise
        ? e.startAngle -
          AcGeMathUtil.normalizeAngle(e.startAngle - e.endAngle) * t
        : e.startAngle +
          AcGeMathUtil.normalizeAngle(e.endAngle - e.startAngle) * t
    const lx = e.majorRadius * Math.cos(ang)
    const ly = e.minorRadius * Math.sin(ang)
    pts.push(
      new AcGePoint2d(
        e.center.x + lx * cosR - ly * sinR,
        e.center.y + lx * sinR + ly * cosR
      )
    )
  }
  return pts
}

function nearestSegment(
  samples: AcGePoint2d[],
  hint: AcGePoint2dLike
): { p0: AcGePoint2d; p1: AcGePoint2d } | null {
  let best: { p0: AcGePoint2d; p1: AcGePoint2d } | null = null
  let bestDist = Infinity
  for (let i = 0; i < samples.length - 1; i++) {
    const p0 = samples[i]
    const p1 = samples[i + 1]
    const proj = projectSegment(p0, p1, hint)
    const d = acgeDistance2d(proj, hint)
    if (d < bestDist) {
      bestDist = d
      best = { p0, p1 }
    }
  }
  return best
}

function projectSegment(
  p0: AcGePoint2d,
  p1: AcGePoint2d,
  pt: AcGePoint2dLike
): AcGePoint2d {
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  const lenSq = dx * dx + dy * dy
  if (lenSq < FLOAT_TOL) return p0.clone()
  let t = ((pt.x - p0.x) * dx + (pt.y - p0.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return new AcGePoint2d(p0.x + t * dx, p0.y + t * dy)
}

function toLineGeom(line: AcGeFilletLine2d): LineGeom {
  const origin = new AcGePoint2d(line.start)
  const end = new AcGePoint2d(line.end)
  const dx = end.x - origin.x
  const dy = end.y - origin.y
  const length = Math.hypot(dx, dy)
  const dir =
    length > FLOAT_TOL
      ? new AcGePoint2d(dx / length, dy / length)
      : new AcGePoint2d(1, 0)
  return { origin, dir, length, extent: line.extent ?? 'bounded' }
}

function toCircGeom(c: AcGeFilletCircArc2d): CircGeom {
  return {
    center: new AcGePoint2d(c.center),
    radius: c.radius,
    startAngle: AcGeMathUtil.normalizeAngle(c.startAngle),
    endAngle: AcGeMathUtil.normalizeAngle(c.endAngle),
    clockwise: !!c.clockwise,
    closed: !!c.closed
  }
}

function offsetLine(line: LineGeom, dist: number): LineGeom {
  const n = new AcGePoint2d(-line.dir.y, line.dir.x)
  return {
    origin: new AcGePoint2d(
      line.origin.x + n.x * dist,
      line.origin.y + n.y * dist
    ),
    dir: line.dir.clone(),
    length: line.length,
    extent: 'unbounded'
  }
}

function intersectInfinite(a: LineGeom, b: LineGeom): AcGePoint2d | null {
  const cross = a.dir.x * b.dir.y - a.dir.y * b.dir.x
  if (Math.abs(cross) < FLOAT_TOL) return null
  const dx = b.origin.x - a.origin.x
  const dy = b.origin.y - a.origin.y
  const t = (dx * b.dir.y - dy * b.dir.x) / cross
  return new AcGePoint2d(a.origin.x + a.dir.x * t, a.origin.y + a.dir.y * t)
}

function projectToInfinite(line: LineGeom, pt: AcGePoint2dLike): AcGePoint2d {
  const t =
    (pt.x - line.origin.x) * line.dir.x + (pt.y - line.origin.y) * line.dir.y
  return new AcGePoint2d(
    line.origin.x + line.dir.x * t,
    line.origin.y + line.dir.y * t
  )
}

function intersectLineCircle(
  line: LineGeom,
  center: AcGePoint2d,
  radius: number,
  tol: AcGeTol
): AcGePoint2d[] {
  const f = new AcGePoint2d(
    line.origin.x - center.x,
    line.origin.y - center.y
  )
  const a = 1
  const b = 2 * (f.x * line.dir.x + f.y * line.dir.y)
  const c = f.x * f.x + f.y * f.y - radius * radius
  const disc = b * b - 4 * a * c
  if (disc < -tol.equalPointTol) return []
  const sqrtDisc = Math.sqrt(Math.max(0, disc))
  const t1 = (-b - sqrtDisc) / (2 * a)
  const t2 = (-b + sqrtDisc) / (2 * a)
  const out = [
    new AcGePoint2d(
      line.origin.x + line.dir.x * t1,
      line.origin.y + line.dir.y * t1
    )
  ]
  if (Math.abs(t2 - t1) > tol.equalPointTol) {
    out.push(
      new AcGePoint2d(
        line.origin.x + line.dir.x * t2,
        line.origin.y + line.dir.y * t2
      )
    )
  }
  return out
}

function intersectCircles(
  c0: AcGePoint2d,
  r0: number,
  c1: AcGePoint2d,
  r1: number,
  tol: AcGeTol
): AcGePoint2d[] {
  const dx = c1.x - c0.x
  const dy = c1.y - c0.y
  const dist = Math.hypot(dx, dy)
  if (dist < FLOAT_TOL) return []
  if (dist > r0 + r1 + tol.equalPointTol) return []
  if (dist < Math.abs(r0 - r1) - tol.equalPointTol) return []

  const a = (r0 * r0 - r1 * r1 + dist * dist) / (2 * dist)
  const hSq = r0 * r0 - a * a
  const h = Math.sqrt(Math.max(0, hSq))
  const mx = c0.x + (dx * a) / dist
  const my = c0.y + (dy * a) / dist
  if (h < tol.equalPointTol) {
    return [new AcGePoint2d(mx, my)]
  }
  const rx = (-dy * h) / dist
  const ry = (dx * h) / dist
  return [new AcGePoint2d(mx + rx, my + ry), new AcGePoint2d(mx - rx, my - ry)]
}

function radialPoint(
  center: AcGePoint2d,
  radius: number,
  from: AcGePoint2d
): AcGePoint2d | null {
  const dx = from.x - center.x
  const dy = from.y - center.y
  const len = Math.hypot(dx, dy)
  if (len < FLOAT_TOL) return null
  return new AcGePoint2d(
    center.x + (dx / len) * radius,
    center.y + (dy / len) * radius
  )
}

function pointOnCirc(c: CircGeom, pt: AcGePoint2d, _tol: AcGeTol): boolean {
  if (c.closed) return true
  const ang = acgeAngleAtCenter2d(c.center, pt)
  if (c.clockwise) {
    return AcGeMathUtil.isAngleOnCcwSweep(c.endAngle, ang, c.startAngle)
  }
  return AcGeMathUtil.isAngleOnCcwSweep(c.startAngle, ang, c.endAngle)
}

/**
 * Builds a fillet arc from trimA to trimB that bends toward `toward`.
 */
function buildFilletArc(
  center: AcGePoint2d,
  _radius: number,
  trimA: AcGePoint2d,
  trimB: AcGePoint2d,
  toward: AcGePoint2dLike
): AcGeCircArc2d | null {
  const startAng = acgeAngleAtCenter2d(center, trimA)
  const endAng = acgeAngleAtCenter2d(center, trimB)
  const towardAng = acgeAngleAtCenter2d(center, toward)

  const ccwOn = AcGeMathUtil.isAngleOnCcwSweep(startAng, towardAng, endAng)
  const clockwise = !ccwOn
  return AcGeCircArc2d.tryCreateByCenterStartEnd(center, trimA, trimB, clockwise)
}

function pickBestCandidate(
  candidates: AcGeFillet2dResult[],
  hintA: AcGePoint2dLike | undefined,
  hintB: AcGePoint2dLike | undefined,
  corner: AcGePoint2dLike | undefined
): AcGeFillet2dResult {
  const hint = midpointOptional(hintA, hintB) ?? corner
  if (!hint) return candidates[0]

  let best = candidates[0]
  let bestScore = Infinity
  for (const c of candidates) {
    const mid = c.center
      ? c.center
      : midpoint2d(c.trimA, c.trimB)
    // Prefer solutions whose trim points are near the picks and center near corner.
    let score = acgeDistance2d(mid, hint)
    if (hintA) score += acgeDistance2d(c.trimA, hintA) * 0.5
    if (hintB) score += acgeDistance2d(c.trimB, hintB) * 0.5
    if (c.arc) {
      // Prefer smaller sweep (typical corner fillet).
      const sweep = Math.abs(c.arc.endAngle - c.arc.startAngle)
      score += sweep * 0.01
    }
    if (score < bestScore) {
      bestScore = score
      best = c
    }
  }
  return best
}

function midpoint2d(a: AcGePoint2dLike, b: AcGePoint2dLike): AcGePoint2d {
  return new AcGePoint2d((a.x + b.x) / 2, (a.y + b.y) / 2)
}

function midpointOptional(
  a: AcGePoint2dLike | undefined,
  b: AcGePoint2dLike | undefined
): AcGePoint2d | undefined {
  if (a && b) return midpoint2d(a, b)
  if (a) return new AcGePoint2d(a)
  if (b) return new AcGePoint2d(b)
  return undefined
}

function cornerHint(a: AcGePoint2d, b: AcGePoint2d): AcGePoint2d {
  return midpoint2d(a, b)
}

function swapOutcome(outcome: AcGeFillet2dOutcome): AcGeFillet2dOutcome {
  if (!outcome.ok) return outcome
  return {
    ok: true,
    result: {
      ...outcome.result,
      trimA: outcome.result.trimB,
      trimB: outcome.result.trimA
    }
  }
}

/**
 * Creates an {@link AcGeFilletSpline2d} primitive by sampling an {@link AcGeSpline3d}.
 *
 * @param spline - Source spline (XY of samples used)
 * @param sampleCount - Number of samples along the spline (≥2)
 */
export function acgeFilletPrimitiveFromSpline3d(
  spline: AcGeSpline3d,
  sampleCount = 64
): AcGeFilletSpline2d {
  const n = Math.max(2, sampleCount)
  const points = spline.getPoints(n)
  return {
    kind: 'spline',
    samples: points.map(p => ({ x: p.x, y: p.y }))
  }
}

/**
 * Creates an {@link AcGeFilletEllipseArc2d} from an {@link AcGeEllipseArc2d}.
 */
export function acgeFilletPrimitiveFromEllipse2d(
  ellipse: AcGeEllipseArc2d
): AcGeFilletEllipseArc2d {
  return {
    kind: 'ellipseArc',
    center: { x: ellipse.center.x, y: ellipse.center.y },
    majorRadius: ellipse.majorAxisRadius,
    minorRadius: ellipse.minorAxisRadius,
    startAngle: ellipse.startAngle,
    endAngle: ellipse.endAngle,
    clockwise: ellipse.clockwise,
    closed: ellipse.closed,
    rotation: ellipse.rotation
  }
}
