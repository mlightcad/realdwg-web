import { AcGePoint2d, AcGePoint2dLike } from '../math/index.js'
import { AcGeTol, DEFAULT_TOL, FLOAT_TOL } from '../util/index.js'
import { acgeDistance2d } from './AcGeCircArcUtil.js'
import { AcGeCurveExtent } from './AcGeCurveIntersect.js'

/**
 * Error codes returned when a 2D chamfer cannot be constructed.
 */
export type AcGeChamfer2dError =
  | 'invalidDistance'
  | 'parallel'
  | 'noIntersection'
  | 'distanceTooLarge'
  | 'noSolution'
  | 'unsupported'

/**
 * Linear chamfer operand (AutoCAD CHAMFER only accepts linear entities).
 */
export interface AcGeChamferLine2d {
  kind: 'line'
  start: AcGePoint2dLike
  end: AcGePoint2dLike
  extent?: AcGeCurveExtent
}

/**
 * Chamfer defined by two distances from the intersection.
 */
export interface AcGeChamferDistanceMode {
  method: 'distance'
  distance1: number
  distance2: number
}

/**
 * Chamfer defined by length on the first line and an angle from that line.
 */
export interface AcGeChamferAngleMode {
  method: 'angle'
  /** Length along the first line from the intersection. */
  length: number
  /** Angle in radians from the first line toward the second. */
  angle: number
}

export type AcGeChamferMode = AcGeChamferDistanceMode | AcGeChamferAngleMode

/**
 * Successful chamfer solution.
 */
export interface AcGeChamfer2dResult {
  /** Start of the chamfer segment (on the first line). */
  trimA: AcGePoint2d
  /** End of the chamfer segment (on the second line). */
  trimB: AcGePoint2d
  /** Corner intersection used as the reference. */
  corner: AcGePoint2d
  /** True when both distances are zero (sharp corner, no chamfer segment). */
  isCornerOnly: boolean
}

export interface AcGeChamfer2dOptions {
  mode: AcGeChamferMode
  hintA?: AcGePoint2dLike
  hintB?: AcGePoint2dLike
  tol?: AcGeTol
}

export interface AcGeChamfer2dFailure {
  ok: false
  error: AcGeChamfer2dError
}

export interface AcGeChamfer2dSuccess {
  ok: true
  result: AcGeChamfer2dResult
}

export type AcGeChamfer2dOutcome = AcGeChamfer2dSuccess | AcGeChamfer2dFailure

interface LineGeom {
  origin: AcGePoint2d
  end: AcGePoint2d
  dir: AcGePoint2d
  length: number
  extent: AcGeCurveExtent
}

/**
 * Computes a 2D chamfer between two linear primitives.
 *
 * Distances are measured from the extended intersection along each line toward
 * the pick side (the endpoint nearer the hint, or away from the far end).
 *
 * @param a - First line
 * @param b - Second line
 * @param options - Distance or angle mode plus optional pick hints
 */
export function acgeChamferCurves2d(
  a: AcGeChamferLine2d,
  b: AcGeChamferLine2d,
  options: AcGeChamfer2dOptions
): AcGeChamfer2dOutcome {
  const tol = options.tol ?? DEFAULT_TOL
  const la = toLineGeom(a)
  const lb = toLineGeom(b)
  if (la.length < FLOAT_TOL || lb.length < FLOAT_TOL) {
    return { ok: false, error: 'noSolution' }
  }

  const cross = la.dir.x * lb.dir.y - la.dir.y * lb.dir.x
  if (Math.abs(cross) < tol.equalVectorTol) {
    return { ok: false, error: 'parallel' }
  }

  const corner = intersectInfinite(la, lb)
  if (!corner) return { ok: false, error: 'noIntersection' }

  const dirFromCornerA = directionFromCorner(la, corner, options.hintA)
  const dirFromCornerB = directionFromCorner(lb, corner, options.hintB)

  let d1: number
  let d2: number
  if (options.mode.method === 'distance') {
    d1 = options.mode.distance1
    d2 = options.mode.distance2
  } else {
    d1 = options.mode.length
    const angle = options.mode.angle
    if (!Number.isFinite(angle) || angle < 0) {
      return { ok: false, error: 'invalidDistance' }
    }
    // Second distance = length * tan(angle) along the second line direction
    // projected from the first-line cut, matching AutoCAD Angle method.
    if (Math.abs(Math.sin(angle)) < FLOAT_TOL && angle !== 0) {
      return { ok: false, error: 'invalidDistance' }
    }
    d2 = d1 * Math.tan(angle)
  }

  if (!Number.isFinite(d1) || !Number.isFinite(d2) || d1 < 0 || d2 < 0) {
    return { ok: false, error: 'invalidDistance' }
  }

  if (AcGeTol.isNonPositive(d1) && AcGeTol.isNonPositive(d2)) {
    return {
      ok: true,
      result: {
        trimA: corner.clone(),
        trimB: corner.clone(),
        corner: corner.clone(),
        isCornerOnly: true
      }
    }
  }

  const trimA = new AcGePoint2d(
    corner.x + dirFromCornerA.x * d1,
    corner.y + dirFromCornerA.y * d1
  )
  const trimB = new AcGePoint2d(
    corner.x + dirFromCornerB.x * d2,
    corner.y + dirFromCornerB.y * d2
  )

  return {
    ok: true,
    result: {
      trimA,
      trimB,
      corner: corner.clone(),
      isCornerOnly: false
    }
  }
}

/**
 * Returns the unit direction along the line from the corner toward the pick
 * side (the half of the line containing the hint, or toward the nearer endpoint).
 */
function directionFromCorner(
  line: LineGeom,
  corner: AcGePoint2d,
  hint: AcGePoint2dLike | undefined
): AcGePoint2d {
  // Parameter of corner on the infinite line.
  const tCorner =
    (corner.x - line.origin.x) * line.dir.x +
    (corner.y - line.origin.y) * line.dir.y

  let preferPositive: boolean
  if (hint) {
    const tHint =
      (hint.x - line.origin.x) * line.dir.x +
      (hint.y - line.origin.y) * line.dir.y
    preferPositive = tHint >= tCorner
  } else {
    // Default: cut toward the segment midpoint relative to the corner.
    const midT = line.length / 2
    preferPositive = midT >= tCorner
  }

  // Chamfer distances go from the corner *along the selected object*, which is
  // toward the pick — i.e. away from the unused half. If the pick is on the
  // positive-dir side of the corner, move +dir; else -dir.
  // Actually AutoCAD measures from the intersection back along each edge
  // toward the selected portion of the object. So we move from corner toward
  // the pick.
  if (preferPositive) {
    return line.dir.clone()
  }
  return new AcGePoint2d(-line.dir.x, -line.dir.y)
}

function toLineGeom(line: AcGeChamferLine2d): LineGeom {
  const origin = new AcGePoint2d(line.start)
  const end = new AcGePoint2d(line.end)
  const dx = end.x - origin.x
  const dy = end.y - origin.y
  const length = Math.hypot(dx, dy)
  const dir =
    length > FLOAT_TOL
      ? new AcGePoint2d(dx / length, dy / length)
      : new AcGePoint2d(1, 0)
  return {
    origin,
    end,
    dir,
    length,
    extent: line.extent ?? 'bounded'
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

/** @internal exported for tests */
export function acgeChamferDistance2d(
  a: AcGePoint2dLike,
  b: AcGePoint2dLike
): number {
  return acgeDistance2d(a, b)
}
