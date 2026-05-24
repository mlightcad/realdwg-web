import {
  EndType,
  inflatePaths,
  JoinType,
  type Path64,
  type Paths64
} from 'clipper2-ts'

import { AcGePoint2d } from '../math/AcGePoint2d'
import { AcGeMathUtil, AcGeTol, TAU } from '../util'
import { AcGeCircArc2d } from './AcGeCircArc2d'
import { AcGePolyline2d } from './AcGePolyline2d'

const POLYLINE_OFFSET_CLIPPER_SCALE = 1e6

type PolylineOffsetSegment = {
  start: AcGePoint2d
  end: AcGePoint2d
  dx: number
  dy: number
}

type PlanarSegment =
  | { kind: 'line'; start: AcGePoint2d; end: AcGePoint2d }
  | { kind: 'arc'; arc: AcGeCircArc2d }

type OffsetSegment =
  | {
      kind: 'line'
      start: AcGePoint2d
      end: AcGePoint2d
      dx: number
      dy: number
    }
  | { kind: 'arc'; arc: AcGeCircArc2d }

/**
 * Creates offset curves for a 2D polyline in the XY plane.
 *
 * Arc segments (non-zero bulge) are offset concentrically; straight segments use
 * parallel offsets. Mixed paths are joined at segment boundaries.
 *
 * @param polyline - Source polyline geometry
 * @param offsetDist - Signed offset distance in drawing units
 * @returns Offset polylines; empty when offsetting fails
 */
export function offsetAcGePolyline2d(
  polyline: AcGePolyline2d,
  offsetDist: number
): AcGePolyline2d[] {
  if (hasArcSegments(polyline)) {
    const result = offsetPolylineWithArcSegments(polyline, offsetDist)
    return result ? [result] : []
  }

  const source = normalizeVertexPolyline(polyline)
  const n = source.numberOfVertices
  if (n < 2) return []

  if (!source.closed) {
    const result = createOpenPolylineOffset(source, offsetDist)
    return result ? [result] : []
  }

  const path: Path64 = []
  for (let i = 0; i < n; i++) {
    const pt = source.getPointAt(i)
    path.push({
      x: Math.round(pt.x * POLYLINE_OFFSET_CLIPPER_SCALE),
      y: Math.round(pt.y * POLYLINE_OFFSET_CLIPPER_SCALE)
    })
  }
  const sourcePaths: Paths64 = [path]
  const paths = inflatePaths(
    sourcePaths,
    offsetDist * POLYLINE_OFFSET_CLIPPER_SCALE,
    JoinType.Miter,
    EndType.Polygon
  )
  if (!paths || paths.length === 0) return []

  const result = new AcGePolyline2d()
  paths[0].forEach((pt: { x: number; y: number }, i: number) => {
    result.addVertexAt(i, {
      x: pt.x / POLYLINE_OFFSET_CLIPPER_SCALE,
      y: pt.y / POLYLINE_OFFSET_CLIPPER_SCALE
    })
  })
  result.closed = source.closed
  return [result]
}

/**
 * Normalizes a vertex-only polyline path by removing duplicate closure points.
 */
export function preparePolylineForOffset(
  polyline: AcGePolyline2d
): AcGePolyline2d {
  return normalizeVertexPolyline(polyline)
}

function offsetPolylineWithArcSegments(
  polyline: AcGePolyline2d,
  offsetDist: number
): AcGePolyline2d | null {
  const segments = collectPlanarSegments(polyline)
  if (segments.length === 0) return null

  const offsetSegments: OffsetSegment[] = []
  for (const segment of segments) {
    const offsetSegment = offsetPlanarSegment(segment, offsetDist)
    if (!offsetSegment) return null
    offsetSegments.push(offsetSegment)
  }

  const joinVertices = collectJoinVertices(polyline)
  const points = buildJoinedOffsetPath(
    offsetSegments,
    joinVertices,
    polyline.closed
  )
  if (points.length < 2) return null

  const result = new AcGePolyline2d()
  points.forEach((point, index) => {
    result.addVertexAt(index, { x: point.x, y: point.y })
  })
  result.closed = polyline.closed
  return result
}

function collectPlanarSegments(polyline: AcGePolyline2d): PlanarSegment[] {
  const segments: PlanarSegment[] = []
  const count = polyline.numberOfVertices
  const segmentCount = polyline.closed ? count : count - 1

  for (let i = 0; i < segmentCount; i++) {
    const start = polyline.vertices[i]
    const end = polyline.vertices[(i + 1) % count]
    if (AcGeTol.isPositive(Math.abs(start.bulge ?? 0))) {
      segments.push({
        kind: 'arc',
        arc: new AcGeCircArc2d(start, end, start.bulge!)
      })
    } else {
      segments.push({
        kind: 'line',
        start: new AcGePoint2d(start.x, start.y),
        end: new AcGePoint2d(end.x, end.y)
      })
    }
  }

  return segments
}

function collectJoinVertices(polyline: AcGePolyline2d): AcGePoint2d[] {
  const vertices: AcGePoint2d[] = []
  for (let i = 0; i < polyline.numberOfVertices; i++) {
    vertices.push(polyline.getPointAt(i))
  }
  return vertices
}

function offsetPlanarSegment(
  segment: PlanarSegment,
  offsetDist: number
): OffsetSegment | null {
  if (segment.kind === 'line') {
    const offsetLine = offsetLineSegment(segment.start, segment.end, offsetDist)
    if (!offsetLine) return null
    return { kind: 'line', ...offsetLine }
  }

  const offsetArc = offsetCircArc2d(
    segment.arc,
    segment.arc.startPoint,
    segment.arc.endPoint,
    offsetDist
  )
  if (!offsetArc) return null
  return { kind: 'arc', arc: offsetArc }
}

function offsetCircArc2d(
  arc: AcGeCircArc2d,
  start: AcGePoint2d,
  end: AcGePoint2d,
  offsetDist: number
): AcGeCircArc2d | null {
  const radiusDelta = getArcRadiusDelta(arc, start, end, offsetDist)
  const radius = arc.radius + radiusDelta
  if (AcGeTol.isNonPositive(radius)) return null
  return new AcGeCircArc2d(
    arc.center,
    radius,
    arc.startAngle,
    arc.endAngle,
    arc.clockwise
  )
}

/**
 * Applies the same left-hand offset rule used for line segments: positive
 * `offsetDist` shifts the arc to the left of its travel direction.
 *
 * Concentric offset direction depends on which side of the chord the center
 * lies: when the center is on the left, shrink the radius; when on the right,
 * expand it.
 */
function getArcRadiusDelta(
  arc: AcGeCircArc2d,
  start: AcGePoint2d,
  end: AcGePoint2d,
  offsetDist: number
): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const len = Math.hypot(dx, dy)
  if (AcGeTol.isNonPositive(len)) {
    return arc.clockwise ? -offsetDist : offsetDist
  }

  const leftNx = -dy / len
  const leftNy = dx / len
  const toCenterX = arc.center.x - (start.x + end.x) / 2
  const toCenterY = arc.center.y - (start.y + end.y) / 2
  const centerOnLeft = toCenterX * leftNx + toCenterY * leftNy > 0

  return centerOnLeft ? -offsetDist : offsetDist
}

function offsetLineSegment(
  start: AcGePoint2d,
  end: AcGePoint2d,
  offsetDist: number
): { start: AcGePoint2d; end: AcGePoint2d; dx: number; dy: number } | null {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const len = Math.hypot(dx, dy)
  if (AcGeTol.isNonPositive(len)) return null

  const nx = (-dy / len) * offsetDist
  const ny = (dx / len) * offsetDist
  return {
    start: new AcGePoint2d(start.x + nx, start.y + ny),
    end: new AcGePoint2d(end.x + nx, end.y + ny),
    dx,
    dy
  }
}

function buildJoinedOffsetPath(
  offsetSegments: OffsetSegment[],
  joinVertices: AcGePoint2d[],
  closed: boolean
): AcGePoint2d[] {
  const count = offsetSegments.length
  if (count === 0) return []

  const junctions = computeJunctionPoints(offsetSegments, joinVertices, closed)
  const points: AcGePoint2d[] = [junctions[0].clone()]

  for (let i = 0; i < count; i++) {
    const segment = offsetSegments[i]
    const endJunction =
      i === count - 1 && !closed
        ? getOffsetSegmentEnd(segment)
        : junctions[(i + 1) % count]

    if (segment.kind === 'arc') {
      const arcSamples = sampleArcBetweenPoints(
        segment.arc,
        junctions[i],
        endJunction,
        Math.max(16, 32)
      )
      for (let j = 1; j < arcSamples.length; j++) {
        points.push(arcSamples[j])
      }
    } else {
      points.push(endJunction.clone())
    }
  }

  return dedupeConsecutivePoints(points)
}

function computeJunctionPoints(
  offsetSegments: OffsetSegment[],
  joinVertices: AcGePoint2d[],
  closed: boolean
): AcGePoint2d[] {
  const count = offsetSegments.length
  const junctions: AcGePoint2d[] = []

  for (let i = 0; i < count; i++) {
    if (i === 0) {
      junctions.push(
        closed
          ? joinOffsetSegments(
              offsetSegments[count - 1],
              offsetSegments[0],
              joinVertices[0]
            )
          : getOffsetSegmentStart(offsetSegments[0])
      )
    } else {
      junctions.push(
        joinOffsetSegments(
          offsetSegments[i - 1],
          offsetSegments[i],
          joinVertices[i]
        )
      )
    }
  }

  return junctions
}

function sampleArcBetweenPoints(
  arc: AcGeCircArc2d,
  start: AcGePoint2d,
  end: AcGePoint2d,
  numPoints: number
): AcGePoint2d[] {
  const startOnArc = arc.nearestPoint(start)
  const endOnArc = arc.nearestPoint(end)
  const startInternal = internalAngleAtPoint(arc, startOnArc)
  const endInternal = internalAngleAtPoint(arc, endOnArc)
  const sweep = sweepAlongArc(arc, startInternal, endInternal)
  const points: AcGePoint2d[] = []

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints
    const internalAngle = arc.clockwise
      ? startInternal - sweep * t
      : startInternal + sweep * t
    points.push(
      arc.getPointAtAngle(publicAngleFromInternal(arc, internalAngle))
    )
  }

  return points
}

function internalAngleAtPoint(arc: AcGeCircArc2d, point: AcGePoint2d): number {
  return Math.atan2(point.y - arc.center.y, point.x - arc.center.x)
}

function publicAngleFromInternal(
  arc: AcGeCircArc2d,
  internalAngle: number
): number {
  const normalized = AcGeMathUtil.normalizeAngle(internalAngle)
  return arc.clockwise ? mirrorAngle(normalized) : normalized
}

function mirrorAngle(angle: number): number {
  const degrees = (angle * 180) / Math.PI
  return ((360 - degrees) % 360) * (Math.PI / 180)
}

function sweepAlongArc(
  arc: AcGeCircArc2d,
  fromInternal: number,
  toInternal: number
): number {
  if (arc.clockwise) {
    let sweep = fromInternal - toInternal
    if (AcGeTol.isNonPositive(sweep)) {
      sweep += TAU
    }
    return sweep
  }

  let sweep = toInternal - fromInternal
  if (AcGeTol.isNonPositive(sweep)) {
    sweep += TAU
  }
  return sweep
}

function getOffsetSegmentStart(segment: OffsetSegment): AcGePoint2d {
  return segment.kind === 'line'
    ? segment.start.clone()
    : segment.arc.startPoint.clone()
}

function getOffsetSegmentEnd(segment: OffsetSegment): AcGePoint2d {
  return segment.kind === 'line'
    ? segment.end.clone()
    : segment.arc.endPoint.clone()
}

function joinOffsetSegments(
  previous: OffsetSegment,
  next: OffsetSegment,
  _near: AcGePoint2d
): AcGePoint2d {
  if (previous.kind === 'line' && next.kind === 'line') {
    return intersectPolylineOffsetSegments(
      {
        start: previous.start,
        end: previous.end,
        dx: previous.dx,
        dy: previous.dy
      },
      {
        start: next.start,
        end: next.end,
        dx: next.dx,
        dy: next.dy
      }
    )
  }

  if (previous.kind === 'line' && next.kind === 'arc') {
    return intersectLineWithCircle(
      previous,
      next.arc,
      midpoint(previous.end, next.arc.startPoint)
    )
  }

  if (previous.kind === 'arc' && next.kind === 'line') {
    return intersectLineWithCircle(
      next,
      previous.arc,
      midpoint(previous.arc.endPoint, next.start)
    )
  }

  if (previous.kind === 'arc' && next.kind === 'arc') {
    return intersectCircles(
      previous.arc,
      next.arc,
      midpoint(previous.arc.endPoint, next.arc.startPoint)
    )
  }

  return _near.clone()
}

function intersectLineWithCircle(
  line: { start: AcGePoint2d; end: AcGePoint2d; dx: number; dy: number },
  arc: AcGeCircArc2d,
  near: AcGePoint2d
): AcGePoint2d {
  const dirLen = Math.hypot(line.dx, line.dy)
  if (AcGeTol.isNonPositive(dirLen)) {
    return near.clone()
  }

  const ux = line.dx / dirLen
  const uy = line.dy / dirLen
  const fx = line.start.x - arc.center.x
  const fy = line.start.y - arc.center.y
  const b = 2 * (fx * ux + fy * uy)
  const c = fx * fx + fy * fy - arc.radius * arc.radius
  const discriminant = b * b - 4 * c

  if (discriminant < 0) {
    return near.clone()
  }

  const sqrtDisc = Math.sqrt(discriminant)
  const candidates = [(-b - sqrtDisc) / 2, (-b + sqrtDisc) / 2].map(
    t => new AcGePoint2d(line.start.x + ux * t, line.start.y + uy * t)
  )

  const onArc = candidates.filter(candidate => isPointOnArc(arc, candidate))
  return pickClosestPoint(onArc.length > 0 ? onArc : candidates, near)
}

function isPointOnArc(arc: AcGeCircArc2d, point: AcGePoint2d): boolean {
  const radiusDelta = Math.abs(
    Math.hypot(point.x - arc.center.x, point.y - arc.center.y) - arc.radius
  )
  if (AcGeTol.isPositive(radiusDelta)) {
    return false
  }

  const internalAngle = internalAngleAtPoint(arc, point)
  const internalStart = arc.clockwise
    ? mirrorAngle(AcGeMathUtil.normalizeAngle(arc.startAngle))
    : AcGeMathUtil.normalizeAngle(arc.startAngle)
  const internalEnd = arc.clockwise
    ? mirrorAngle(AcGeMathUtil.normalizeAngle(arc.endAngle))
    : AcGeMathUtil.normalizeAngle(arc.endAngle)

  return AcGeMathUtil.isBetweenAngle(
    internalAngle,
    internalStart,
    internalEnd,
    arc.clockwise
  )
}

function intersectCircles(
  a: AcGeCircArc2d,
  b: AcGeCircArc2d,
  near: AcGePoint2d
): AcGePoint2d {
  const dx = b.center.x - a.center.x
  const dy = b.center.y - a.center.y
  const dist = Math.hypot(dx, dy)
  if (AcGeTol.isNonPositive(dist) || dist > a.radius + b.radius) {
    return near.clone()
  }

  const aTerm =
    (a.radius * a.radius - b.radius * b.radius + dist * dist) / (2 * dist)
  const hSquared = a.radius * a.radius - aTerm * aTerm
  if (hSquared < 0) {
    return near.clone()
  }

  const h = Math.sqrt(hSquared)
  const mx = a.center.x + (aTerm * dx) / dist
  const my = a.center.y + (aTerm * dy) / dist
  const rx = (-dy * h) / dist
  const ry = (dx * h) / dist

  return pickClosestPoint(
    [new AcGePoint2d(mx + rx, my + ry), new AcGePoint2d(mx - rx, my - ry)],
    near
  )
}

function pickClosestPoint(
  points: AcGePoint2d[],
  near: AcGePoint2d
): AcGePoint2d {
  let best = points[0]
  let bestDist = best.distanceToSquared(near)
  for (let i = 1; i < points.length; i++) {
    const dist = points[i].distanceToSquared(near)
    if (dist < bestDist) {
      best = points[i]
      bestDist = dist
    }
  }
  return best.clone()
}

function midpoint(a: AcGePoint2d, b: AcGePoint2d): AcGePoint2d {
  return new AcGePoint2d((a.x + b.x) / 2, (a.y + b.y) / 2)
}

function hasArcSegments(polyline: AcGePolyline2d): boolean {
  const count = polyline.numberOfVertices
  const segmentCount = polyline.closed ? count : count - 1
  for (let i = 0; i < segmentCount; i++) {
    const vertex = polyline.vertices[i]
    if (AcGeTol.isPositive(Math.abs(vertex.bulge ?? 0))) {
      return true
    }
  }
  return false
}

function normalizeVertexPolyline(polyline: AcGePolyline2d): AcGePolyline2d {
  const points = normalizePathPoints(
    polyline.vertices.map(vertex => new AcGePoint2d(vertex.x, vertex.y)),
    polyline.closed
  )
  if (points.length === polyline.numberOfVertices) {
    return polyline
  }
  return new AcGePolyline2d(
    points.map(point => ({ x: point.x, y: point.y })),
    polyline.closed
  )
}

function normalizePathPoints(
  points: AcGePoint2d[],
  closed: boolean
): AcGePoint2d[] {
  const deduped = dedupeConsecutivePoints(points)
  if (!closed || deduped.length < 2) return deduped

  const first = deduped[0]
  const last = deduped[deduped.length - 1]
  if (AcGeTol.isNonPositive(Math.hypot(first.x - last.x, first.y - last.y))) {
    deduped.pop()
  }
  return deduped
}

function dedupeConsecutivePoints(points: AcGePoint2d[]): AcGePoint2d[] {
  const result: AcGePoint2d[] = []
  points.forEach(point => {
    const last = result[result.length - 1]
    if (
      !last ||
      AcGeTol.isPositive(Math.hypot(last.x - point.x, last.y - point.y))
    ) {
      result.push(new AcGePoint2d(point.x, point.y))
    }
  })
  return result
}

function createOpenPolylineOffset(
  polyline: AcGePolyline2d,
  offsetDist: number
): AcGePolyline2d | null {
  const sourcePoints: AcGePoint2d[] = []
  for (let i = 0; i < polyline.numberOfVertices; i++) {
    sourcePoints.push(polyline.getPointAt(i))
  }

  const offsetSegments: PolylineOffsetSegment[] = []
  for (let i = 0; i < sourcePoints.length - 1; i++) {
    const start = sourcePoints[i]
    const end = sourcePoints[i + 1]
    const dx = end.x - start.x
    const dy = end.y - start.y
    const len = Math.hypot(dx, dy)
    if (AcGeTol.isNonPositive(len)) continue

    const nx = (-dy / len) * offsetDist
    const ny = (dx / len) * offsetDist
    offsetSegments.push({
      start: new AcGePoint2d(start.x + nx, start.y + ny),
      end: new AcGePoint2d(end.x + nx, end.y + ny),
      dx,
      dy
    })
  }

  if (offsetSegments.length === 0) return null

  const resultPoints: AcGePoint2d[] = [offsetSegments[0].start]
  for (let i = 1; i < offsetSegments.length; i++) {
    resultPoints.push(
      intersectPolylineOffsetSegments(offsetSegments[i - 1], offsetSegments[i])
    )
  }
  resultPoints.push(offsetSegments[offsetSegments.length - 1].end)

  const result = new AcGePolyline2d()
  resultPoints.forEach((point, index) => {
    result.addVertexAt(index, { x: point.x, y: point.y })
  })
  result.closed = false
  return result
}

function intersectPolylineOffsetSegments(
  a: PolylineOffsetSegment,
  b: PolylineOffsetSegment
): AcGePoint2d {
  const det = a.dx * b.dy - a.dy * b.dx
  if (AcGeTol.equalToZero(det)) {
    return new AcGePoint2d((a.end.x + b.start.x) / 2, (a.end.y + b.start.y) / 2)
  }

  const qpx = b.start.x - a.start.x
  const qpy = b.start.y - a.start.y
  const t = (qpx * b.dy - qpy * b.dx) / det
  return new AcGePoint2d(a.start.x + t * a.dx, a.start.y + t * a.dy)
}
