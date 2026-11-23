import { AcGePoint3dLike } from '../math/index.js'
import {
  acgeCalculateCurveLength,
  acgeEvaluateNurbsDerivatives
} from './AcGeNurbsUtil.js'

/**
 * Plain NURBS curve data (degree, knot vector, control points and weights)
 * used by the knot-insertion, split and join helpers.
 *
 * `knots.length` must equal `controlPoints.length + degree + 1` and
 * `weights.length` must equal `controlPoints.length`.
 */
export interface AcGeNurbsCurveData {
  /** Polynomial degree `p`. */
  degree: number
  /** Non-decreasing knot vector. */
  knots: number[]
  /** Control points in curve order. */
  controlPoints: AcGePoint3dLike[]
  /** Rational weights aligned with `controlPoints`. */
  weights: number[]
}

/** Default tolerance used to snap a parameter onto an existing knot. */
const KNOT_TOL = 1e-10

type Homogeneous = [number, number, number, number]

function toHomogeneous(curve: AcGeNurbsCurveData): Homogeneous[] {
  return curve.controlPoints.map((p, i) => {
    const w = curve.weights[i] ?? 1
    return [p.x * w, p.y * w, (p.z ?? 0) * w, w]
  })
}

function fromHomogeneous(
  degree: number,
  knots: number[],
  points: Homogeneous[]
): AcGeNurbsCurveData {
  const controlPoints: AcGePoint3dLike[] = []
  const weights: number[] = []
  for (const [x, y, z, w] of points) {
    const div = w === 0 ? 1 : w
    controlPoints.push({ x: x / div, y: y / div, z: z / div })
    weights.push(w)
  }
  return { degree, knots, controlPoints, weights }
}

/**
 * Returns the valid parameter range `[knots[p], knots[m - p]]` of a NURBS
 * curve.
 *
 * @param curve - Curve data
 * @returns Start and end parameters
 */
export function acgeNurbsParameterRange(curve: AcGeNurbsCurveData): {
  start: number
  end: number
} {
  const { degree, knots } = curve
  return { start: knots[degree], end: knots[knots.length - degree - 1] }
}

/**
 * Inserts knot `u` into a NURBS curve up to `times` times (Boehm / Piegl &
 * Tiller algorithm A5.1, applied to homogeneous control points so rational
 * curves keep their exact shape).
 *
 * The total multiplicity of `u` never exceeds the curve degree. A parameter
 * within `tol` of an existing knot is snapped onto it.
 *
 * @param curve - Source curve (not modified)
 * @param u - Knot value to insert
 * @param times - Requested number of insertions
 * @param tol - Knot snapping tolerance
 * @returns New curve data with the same geometry
 */
export function acgeNurbsInsertKnot(
  curve: AcGeNurbsCurveData,
  u: number,
  times: number,
  tol: number = KNOT_TOL
): AcGeNurbsCurveData {
  const p = curve.degree
  const UP = curve.knots
  const mp = UP.length - 1
  const np = curve.controlPoints.length - 1

  // Snap onto an existing knot so multiplicity is counted correctly.
  for (const knot of UP) {
    if (Math.abs(knot - u) <= tol) {
      u = knot
      break
    }
  }

  let k = -1
  let s = 0
  for (let i = 0; i <= mp; i++) {
    if (UP[i] <= u) k = i
    if (UP[i] === u) s++
  }
  const r = Math.min(times, p - s)
  if (r <= 0 || k < p || k >= mp) {
    return {
      degree: p,
      knots: [...UP],
      controlPoints: curve.controlPoints.map(c => ({
        x: c.x,
        y: c.y,
        z: c.z ?? 0
      })),
      weights: [...curve.weights]
    }
  }

  const Pw = toHomogeneous(curve)
  const UQ: number[] = new Array(mp + r + 1)
  const Qw: Homogeneous[] = new Array(np + r + 1)
  const Rw: Homogeneous[] = new Array(p + 1)

  for (let i = 0; i <= k; i++) UQ[i] = UP[i]
  for (let i = 1; i <= r; i++) UQ[k + i] = u
  for (let i = k + 1; i <= mp; i++) UQ[i + r] = UP[i]

  for (let i = 0; i <= k - p; i++) Qw[i] = [...Pw[i]] as Homogeneous
  for (let i = k - s; i <= np; i++) Qw[i + r] = [...Pw[i]] as Homogeneous
  for (let i = 0; i <= p - s; i++) Rw[i] = [...Pw[k - p + i]] as Homogeneous

  let L = k - p
  for (let j = 1; j <= r; j++) {
    L = k - p + j
    for (let i = 0; i <= p - j - s; i++) {
      const alpha = (u - UP[L + i]) / (UP[i + k + 1] - UP[L + i])
      const a = Rw[i + 1]
      const b = Rw[i]
      Rw[i] = [
        alpha * a[0] + (1 - alpha) * b[0],
        alpha * a[1] + (1 - alpha) * b[1],
        alpha * a[2] + (1 - alpha) * b[2],
        alpha * a[3] + (1 - alpha) * b[3]
      ]
    }
    Qw[L] = [...Rw[0]] as Homogeneous
    Qw[k + r - j - s] = [...Rw[p - j - s]] as Homogeneous
  }
  for (let i = L + 1; i < k - s; i++) Qw[i] = [...Rw[i - L]] as Homogeneous

  return fromHomogeneous(p, UQ, Qw)
}

/**
 * Extracts the sub-curve between parameters `u0 < u1` as a new clamped NURBS
 * curve whose parameter range is `[u0, u1]`.
 *
 * Both parameters are clamped into the curve's parameter range. Knots are
 * inserted to multiplicity `degree` at each cut so the result traces exactly
 * the same geometry. Works for clamped and unclamped knot vectors.
 *
 * @param curve - Source curve (not modified)
 * @param u0 - Start parameter of the piece
 * @param u1 - End parameter of the piece
 * @param tol - Knot snapping tolerance
 * @returns The extracted piece, or `undefined` when `u1 - u0 <= tol`
 */
export function acgeNurbsExtractSegment(
  curve: AcGeNurbsCurveData,
  u0: number,
  u1: number,
  tol: number = KNOT_TOL
): AcGeNurbsCurveData | undefined {
  const p = curve.degree
  const range = acgeNurbsParameterRange(curve)
  u0 = Math.max(range.start, Math.min(range.end, u0))
  u1 = Math.max(range.start, Math.min(range.end, u1))
  if (u1 - u0 <= tol) return undefined

  let c = acgeNurbsInsertKnot(curve, u0, p, tol)
  c = acgeNurbsInsertKnot(c, u1, p, tol)
  const U = c.knots
  const snap = (value: number) => {
    for (const knot of U) {
      if (Math.abs(knot - value) <= tol) return knot
    }
    return value
  }
  const a0 = snap(u0)
  const a1 = snap(u1)

  let lastU0 = -1
  let firstU1 = -1
  for (let i = 0; i < U.length; i++) {
    if (U[i] === a0) lastU0 = i
    if (firstU1 < 0 && U[i] === a1) firstU1 = i
  }
  if (lastU0 < 0 || firstU1 < 0) return undefined

  const firstCp = lastU0 - p
  const lastCp = firstU1 - 1
  if (firstCp < 0 || lastCp >= c.controlPoints.length || lastCp < firstCp) {
    return undefined
  }

  const knots: number[] = []
  for (let i = 0; i <= p; i++) knots.push(a0)
  for (let i = lastU0 + 1; i < firstU1; i++) knots.push(U[i])
  for (let i = 0; i <= p; i++) knots.push(a1)

  return {
    degree: p,
    knots,
    controlPoints: c.controlPoints.slice(firstCp, lastCp + 1),
    weights: c.weights.slice(firstCp, lastCp + 1)
  }
}

/**
 * Splits a NURBS curve at parameter `u` into two clamped curves.
 *
 * @param curve - Source curve (not modified)
 * @param u - Split parameter, strictly inside the parameter range
 * @param tol - Knot snapping tolerance
 * @returns `[left, right]`, or `undefined` when `u` is not inside the range
 */
export function acgeNurbsSplitAt(
  curve: AcGeNurbsCurveData,
  u: number,
  tol: number = KNOT_TOL
): [AcGeNurbsCurveData, AcGeNurbsCurveData] | undefined {
  const range = acgeNurbsParameterRange(curve)
  if (u <= range.start + tol || u >= range.end - tol) return undefined
  const left = acgeNurbsExtractSegment(curve, range.start, u, tol)
  const right = acgeNurbsExtractSegment(curve, u, range.end, tol)
  return left && right ? [left, right] : undefined
}

/**
 * Joins two clamped NURBS curves of the same degree where the end point of
 * `first` coincides with the start point of `second`.
 *
 * The knots of `second` are shifted to continue the parameter range of
 * `first`, and its weights are scaled so the shared control point has a
 * single homogeneous representation (scaling all weights of a rational curve
 * does not change its shape).
 *
 * @param first - Leading curve (clamped at its end)
 * @param second - Trailing curve (clamped at its start)
 * @returns The joined curve, or `undefined` when the degrees differ
 */
export function acgeNurbsJoin(
  first: AcGeNurbsCurveData,
  second: AcGeNurbsCurveData
): AcGeNurbsCurveData | undefined {
  const p = first.degree
  if (second.degree !== p) return undefined
  const firstEnd = first.knots[first.knots.length - 1]
  const secondStart = second.knots[0]
  const shift = firstEnd - secondStart

  const knots = first.knots.slice(0, first.knots.length - 1)
  for (let i = p + 1; i < second.knots.length; i++) {
    knots.push(second.knots[i] + shift)
  }

  const wa = first.weights[first.weights.length - 1] ?? 1
  const wb = second.weights[0] ?? 1
  const scale = wb === 0 ? 1 : wa / wb

  const controlPoints = [
    ...first.controlPoints.map(c => ({ x: c.x, y: c.y, z: c.z ?? 0 })),
    ...second.controlPoints.slice(1).map(c => ({ x: c.x, y: c.y, z: c.z ?? 0 }))
  ]
  const weights = [
    ...first.weights,
    ...second.weights.slice(1).map(w => w * scale)
  ]
  return { degree: p, knots, controlPoints, weights }
}

/**
 * Evaluates a NURBS curve point and its first two derivatives.
 *
 * @param curve - Curve data
 * @param u - Parameter (clamped into the parameter range)
 */
export function acgeNurbsEvaluate(curve: AcGeNurbsCurveData, u: number) {
  return acgeEvaluateNurbsDerivatives(
    u,
    curve.degree,
    curve.knots,
    curve.controlPoints.map(c => [c.x, c.y, c.z ?? 0]),
    curve.weights
  )
}

function distSq(a: number[], p: AcGePoint3dLike) {
  const dx = a[0] - p.x
  const dy = a[1] - p.y
  const dz = a[2] - (p.z ?? 0)
  return dx * dx + dy * dy + dz * dz
}

/**
 * Finds the parameter of the point on a NURBS curve closest to `point`.
 *
 * Uses dense sampling over the parameter range followed by a golden-section
 * search on the best bracket and a few Newton iterations on
 * `C'(u) · (C(u) - P) = 0`.
 *
 * @param curve - Curve data
 * @param point - Query point
 * @param samples - Minimum number of samples over the range
 * @returns Parameter of the closest point within the parameter range
 */
export function acgeNurbsClosestParam(
  curve: AcGeNurbsCurveData,
  point: AcGePoint3dLike,
  samples = 128
): number {
  const { start, end } = acgeNurbsParameterRange(curve)
  if (!(end > start)) return start
  const count = Math.max(samples, curve.controlPoints.length * 16)
  const cps = curve.controlPoints.map(c => [c.x, c.y, c.z ?? 0])
  const evalAt = (u: number) =>
    acgeEvaluateNurbsDerivatives(
      u,
      curve.degree,
      curve.knots,
      cps,
      curve.weights
    )
  const f = (u: number) => distSq(evalAt(u).point, point)

  let bestIndex = 0
  let bestDist = Infinity
  const step = (end - start) / count
  for (let i = 0; i <= count; i++) {
    const d = f(start + i * step)
    if (d < bestDist) {
      bestDist = d
      bestIndex = i
    }
  }

  // Golden-section search on the bracket around the best sample.
  let lo = start + Math.max(0, bestIndex - 1) * step
  let hi = start + Math.min(count, bestIndex + 1) * step
  const ratio = (Math.sqrt(5) - 1) / 2
  let x1 = hi - ratio * (hi - lo)
  let x2 = lo + ratio * (hi - lo)
  let f1 = f(x1)
  let f2 = f(x2)
  for (let i = 0; i < 60 && hi - lo > 1e-14 * (end - start); i++) {
    if (f1 < f2) {
      hi = x2
      x2 = x1
      f2 = f1
      x1 = hi - ratio * (hi - lo)
      f1 = f(x1)
    } else {
      lo = x1
      x1 = x2
      f1 = f2
      x2 = lo + ratio * (hi - lo)
      f2 = f(x2)
    }
  }
  let u = (lo + hi) / 2
  let du = f(u)

  // Newton polish; keep only improving steps.
  for (let i = 0; i < 8; i++) {
    const { point: c, deriv1: d1, deriv2: d2 } = evalAt(u)
    const diff = [c[0] - point.x, c[1] - point.y, c[2] - (point.z ?? 0)]
    const g = d1[0] * diff[0] + d1[1] * diff[1] + d1[2] * diff[2]
    const h =
      d2[0] * diff[0] +
      d2[1] * diff[1] +
      d2[2] * diff[2] +
      d1[0] * d1[0] +
      d1[1] * d1[1] +
      d1[2] * d1[2]
    if (!(Math.abs(h) > 1e-30)) break
    const next = Math.max(start, Math.min(end, u - g / h))
    const dn = f(next)
    if (!(dn < du)) break
    u = next
    du = dn
  }

  const dStart = f(start)
  const dEnd = f(end)
  if (dStart < du && dStart <= dEnd) return start
  if (dEnd < du) return end
  return u
}

/**
 * Returns the arc length of a NURBS curve between its start parameter and
 * `u` (numerical integration).
 *
 * @param curve - Curve data
 * @param u - End parameter of the measured part
 */
export function acgeNurbsLengthTo(curve: AcGeNurbsCurveData, u: number) {
  const { start } = acgeNurbsParameterRange(curve)
  const piece = acgeNurbsExtractSegment(curve, start, u)
  if (!piece) return 0
  return acgeCalculateCurveLength(
    piece.degree,
    piece.knots,
    piece.controlPoints.map(c => [c.x, c.y, c.z ?? 0]),
    piece.weights
  )
}
