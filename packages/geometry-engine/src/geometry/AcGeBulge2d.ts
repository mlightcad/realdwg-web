import { AcGePoint2d, AcGePoint2dLike } from '../math/index.js'
import { AcGeTol, TAU } from '../util/index.js'
import { AcGeCircArc2d } from './AcGeCircArc2d.js'
import {
  acgeTryCreateArcByStartEndDirection,
  acgeTryCreateArcByStartEndRadius,
  acgeTryCreateArcByThreePoints
} from './AcGeCircArc2dFactory.js'

/**
 * Polyline bulge for a circular arc: `tan(signedSweep / 4)`.
 * Positive = counterclockwise; negative = clockwise.
 */
export function acgeBulgeFromCircArc2d(arc: AcGeCircArc2d): number | undefined {
  const sweep = arc.clockwise ? -arc.deltaAngle : arc.deltaAngle
  if (
    !Number.isFinite(sweep) ||
    AcGeTol.equalToZero(sweep) ||
    !AcGeTol.great(TAU - Math.abs(sweep), 0)
  ) {
    return undefined
  }
  const bulge = Math.tan(sweep / 4)
  return Number.isFinite(bulge) ? bulge : undefined
}

/**
 * Complementary arc between the same endpoints (AutoCAD Ctrl-toggle):
 * included angle `2π - |θ|` with opposite winding.
 *
 * Example: `tan(π/8)` (90° CCW) → `-tan(3π/8)` (270° CW).
 */
export function acgeComplementBulge(bulge: number) {
  if (AcGeTol.equalToZero(bulge)) return bulge
  const sweep = 4 * Math.atan(bulge)
  const complement = TAU - Math.abs(sweep)
  if (AcGeTol.equalToZero(complement)) return bulge
  // Flip sign: the other arc between the same endpoints winds the other way.
  return -Math.sign(bulge) * Math.tan(complement / 4)
}

/**
 * Arc center from chord endpoints and bulge (polyline arc convention).
 *
 * Midpoint → center offset is `(chord/2) * (1 - b²) / (2b)` along the left
 * normal of the chord — not the sagitta `(chord/2) * b`.
 */
export function acgeCenterFromBulge(
  start: AcGePoint2dLike,
  end: AcGePoint2dLike,
  bulge: number
): AcGePoint2d | undefined {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const chord = Math.hypot(dx, dy)
  if (AcGeTol.isNonPositive(chord) || AcGeTol.equalToZero(bulge)) {
    return undefined
  }

  const mx = (start.x + end.x) / 2
  const my = (start.y + end.y) / 2
  const offset = (chord / 2) * ((1 - bulge * bulge) / (2 * bulge))
  return new AcGePoint2d(mx - (dy / chord) * offset, my + (dx / chord) * offset)
}

/**
 * Forward tangent at a point on a circular arc, from center and sweep direction.
 */
export function acgeGeometricTangentAtPoint(
  point: AcGePoint2dLike,
  center: AcGePoint2dLike,
  ccw: boolean
) {
  const vx = point.x - center.x
  const vy = point.y - center.y
  // CCW tangent of radius (vx, vy) is (-vy, vx) → atan2(vx, -vy).
  // CW tangent is (vy, -vx) → atan2(-vx, vy).
  return ccw ? Math.atan2(vx, -vy) : Math.atan2(-vx, vy)
}

/**
 * Tangent direction (radians) at the start of a bulged polyline segment.
 */
export function acgeBulgeArcTangentAtStart(
  start: AcGePoint2dLike,
  end: AcGePoint2dLike,
  bulge: number
) {
  const center = acgeCenterFromBulge(start, end, bulge)
  if (!center) return undefined
  return acgeGeometricTangentAtPoint(start, center, bulge >= 0)
}

/**
 * Tangent direction (radians) at the end of a bulged polyline segment.
 */
export function acgeBulgeArcTangentAtEnd(
  start: AcGePoint2dLike,
  end: AcGePoint2dLike,
  bulge: number
) {
  const center = acgeCenterFromBulge(start, end, bulge)
  if (!center) return undefined
  return acgeGeometricTangentAtPoint(end, center, bulge >= 0)
}

/**
 * Bulge from a known center using the signed chord sweep in (-π, π]
 * (always the minor-or-semicircle arc). For major arcs (>180°), use
 * {@link acgeBulgeFromCenterWithTangent} instead.
 */
export function acgeBulgeFromCenter(
  start: AcGePoint2dLike,
  end: AcGePoint2dLike,
  center: AcGePoint2dLike
) {
  const v1x = start.x - center.x
  const v1y = start.y - center.y
  const v2x = end.x - center.x
  const v2y = end.y - center.y
  const cross = v1x * v2y - v1y * v2x
  const dot = v1x * v2x + v1y * v2y
  const angle = Math.atan2(cross, dot)
  if (!Number.isFinite(angle)) return undefined
  return Math.tan(angle / 4)
}

/**
 * Bulge from a known center, sweeping in the direction that matches
 * `tangentRad` at `start` (including included angles greater than 180°).
 */
export function acgeBulgeFromCenterWithTangent(
  start: AcGePoint2dLike,
  end: AcGePoint2dLike,
  center: AcGePoint2dLike,
  tangentRad: number
) {
  const v1x = start.x - center.x
  const v1y = start.y - center.y
  const v2x = end.x - center.x
  const v2y = end.y - center.y
  const tx = Math.cos(tangentRad)
  const ty = Math.sin(tangentRad)
  const chordX = end.x - start.x
  const chordY = end.y - start.y

  const crossStartTangent = v1x * ty - v1y * tx
  let ccw: boolean
  if (AcGeTol.isPositive(Math.abs(crossStartTangent))) {
    ccw = crossStartTangent > 0
  } else {
    const chordCrossTangent = chordX * ty - chordY * tx
    ccw = chordCrossTangent >= 0
  }

  const startAngle = Math.atan2(v1y, v1x)
  const endAngle = Math.atan2(v2y, v2x)

  let sweep: number
  if (ccw) {
    sweep = endAngle - startAngle
    if (AcGeTol.isNonPositive(sweep)) sweep += Math.PI * 2
  } else {
    sweep = startAngle - endAngle
    if (AcGeTol.isNonPositive(sweep)) sweep += Math.PI * 2
  }
  if (!AcGeTol.great(TAU - sweep, 0)) return undefined

  return ccw ? Math.tan(sweep / 4) : -Math.tan(sweep / 4)
}

/**
 * Bulge for an arc through `start` and `end` that is tangent to `tangentRad`
 * at `start`.
 */
export function acgeBulgeFromStartEndDirection(
  start: AcGePoint2dLike,
  end: AcGePoint2dLike,
  tangentRad: number
) {
  const arc = acgeTryCreateArcByStartEndDirection(start, end, tangentRad)
  if (!arc) return undefined
  return acgeBulgeFromCircArc2d(arc)
}

/**
 * Bulge for a three-point arc.
 *
 * When `reverseDirection` is true, returns the complementary sweep between
 * the same endpoints (AutoCAD Ctrl-toggle), matching
 * {@link acgeTryCreateArcByThreePoints}.
 */
export function acgeBulgeFromThreePoints(
  start: AcGePoint2dLike,
  mid: AcGePoint2dLike,
  end: AcGePoint2dLike,
  reverseDirection: boolean = false
) {
  const arc = acgeTryCreateArcByThreePoints(start, mid, end, reverseDirection)
  if (!arc) return undefined
  return acgeBulgeFromCircArc2d(arc)
}

/**
 * Bulge for a radius + endpoint arc (sign of radius selects side / orientation).
 */
export function acgeBulgeFromStartEndRadius(
  start: AcGePoint2dLike,
  end: AcGePoint2dLike,
  radius: number
) {
  const arc = acgeTryCreateArcByStartEndRadius(start, end, radius)
  if (!arc) return undefined
  return acgeBulgeFromCircArc2d(arc)
}
