import {
  AcGeCircArc2d,
  AcGeEllipseArc2d,
  AcGeFillet2dError,
  acgeFilletCurves2d,
  AcGeFilletPrimitive2d,
  acgeFilletPrimitiveFromEllipse2d,
  acgeFilletPrimitiveFromSpline3d,
  AcGeMathUtil,
  AcGePoint2d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGeVector3d,
  FLOAT_TOL
} from '@mlightcad/geometry-engine'

import { AcDbArc } from './AcDbArc.js'
import { AcDbCircle } from './AcDbCircle.js'
import { AcDbEllipse } from './AcDbEllipse.js'
import { AcDbEntity } from './AcDbEntity.js'
import { AcDbLine } from './AcDbLine.js'
import { AcDbPolyline } from './AcDbPolyline.js'
import { AcDbRay } from './AcDbRay.js'
import { AcDbSpline } from './AcDbSpline.js'
import { AcDbXline } from './AcDbXline.js'

/**
 * Options for {@link acdbFilletTwoEntities}.
 */
export interface AcDbFilletOptions {
  /** Fillet radius (0 = sharp corner). */
  radius: number
  /** When true, trim/extend the operands to the fillet ends (default true). */
  trim?: boolean
}

/**
 * Result of filleting two entities.
 */
export interface AcDbFilletTwoResult {
  /** Newly created entities (fillet arc, and replacements for xline→ray/line). */
  created: AcDbEntity[]
  /** Entities that should be erased (e.g. converted xlines). */
  erase: AcDbEntity[]
  /** Entities that were mutated in place. */
  modified: AcDbEntity[]
}

/**
 * Result of filleting every eligible vertex of a polyline.
 */
export interface AcDbFilletPolylineResult {
  /** Number of vertices successfully filleted. */
  filleted: number
  /** Number of vertices skipped (too short, parallel, arc segment, …). */
  skipped: number
}

export type AcDbFilletableEntity =
  | AcDbLine
  | AcDbArc
  | AcDbCircle
  | AcDbEllipse
  | AcDbPolyline
  | AcDbSpline
  | AcDbRay
  | AcDbXline

/**
 * Returns true when the entity can participate in FILLET.
 */
export function acdbIsFilletableEntity(
  entity: AcDbEntity
): entity is AcDbFilletableEntity {
  return (
    entity instanceof AcDbLine ||
    entity instanceof AcDbArc ||
    entity instanceof AcDbCircle ||
    entity instanceof AcDbEllipse ||
    entity instanceof AcDbPolyline ||
    entity instanceof AcDbSpline ||
    entity instanceof AcDbRay ||
    entity instanceof AcDbXline
  )
}

/**
 * Fillets two entities (or two polyline segments) using AutoCAD-like rules.
 *
 * Mutates operands in place when possible. Circles are never trimmed. Xlines
 * may be converted to rays or lines (returned in `created` / `erase`).
 *
 * @param e1 - First selected entity
 * @param pick1 - Pick point on the first entity
 * @param e2 - Second selected entity
 * @param pick2 - Pick point on the second entity
 * @param options - Radius and trim mode
 */
export function acdbFilletTwoEntities(
  e1: AcDbEntity,
  pick1: AcGePoint3dLike,
  e2: AcDbEntity,
  pick2: AcGePoint3dLike,
  options: AcDbFilletOptions
): { ok: true; result: AcDbFilletTwoResult } | { ok: false; error: AcGeFillet2dError } {
  if (e1 instanceof AcDbPolyline && e1 === e2) {
    return filletPolylineSegments(e1, pick1, pick2, options)
  }

  const primA = entityToPrimitive(e1, pick1)
  const primB = entityToPrimitive(e2, pick2)
  if (!primA || !primB) {
    return { ok: false, error: 'unsupported' }
  }

  const outcome = acgeFilletCurves2d(primA, primB, {
    radius: options.radius,
    hintA: { x: pick1.x, y: pick1.y },
    hintB: { x: pick2.x, y: pick2.y }
  })
  if (!outcome.ok) return outcome

  const created: AcDbEntity[] = []
  const erase: AcDbEntity[] = []
  const modified: AcDbEntity[] = []
  const trim = options.trim !== false

  if (trim) {
    const m1 = applyTrim(e1, pick1, outcome.result.trimA, created, erase)
    const m2 = applyTrim(e2, pick2, outcome.result.trimB, created, erase)
    if (m1) modified.push(m1)
    if (m2) modified.push(m2)
  }

  if (outcome.result.arc && outcome.result.radius > FLOAT_TOL) {
    const arc = createFilletArcEntity(
      outcome.result.arc,
      e1,
      e2,
      pick1.z ?? 0
    )
    created.push(arc)
  }

  return { ok: true, result: { created, erase, modified } }
}

/**
 * Inserts fillets at every vertex of a 2D polyline where two straight segments meet.
 *
 * @param pline - Polyline to mutate
 * @param options - Radius and trim mode
 * @param onlyCorner - When set, fillet only this vertex index (AutoCAD two-segment pick)
 */
export function acdbFilletPolyline(
  pline: AcDbPolyline,
  options: AcDbFilletOptions,
  onlyCorner?: number
): AcDbFilletPolylineResult {
  return filletPolylineCorners(pline, options, onlyCorner)
}

function filletPolylineCorners(
  pline: AcDbPolyline,
  options: AcDbFilletOptions,
  onlyCorner?: number
): AcDbFilletPolylineResult {
  const n = pline.numberOfVertices
  if (n < 2) return { filleted: 0, skipped: 0 }

  type Vertex = {
    x: number
    y: number
    bulge: number
    startWidth?: number
    endWidth?: number
  }

  const verts: Vertex[] = []
  for (let i = 0; i < n; i++) {
    const p = pline.getPoint2dAt(i)
    verts.push({
      x: p.x,
      y: p.y,
      bulge: pline.getBulgeAt(i),
      startWidth: pline.getStartWidthAt(i) || undefined,
      endWidth: pline.getEndWidthAt(i) || undefined
    })
  }

  const closed = pline.closed
  const radius = options.radius
  const out: Vertex[] = []
  let filleted = 0
  let skipped = 0

  // Open: corners are vertices 1..n-2. Closed: every vertex is a corner.
  const cornerStart = closed ? 0 : 1
  const cornerEnd = closed ? n - 1 : n - 2

  if (!closed) {
    out.push({ ...verts[0] })
  }

  for (let c = cornerStart; c <= cornerEnd; c++) {
    const shouldFillet = onlyCorner === undefined || onlyCorner === c
    const iPrev = closed ? (c - 1 + n) % n : c - 1
    const iCurr = c
    const iNext = closed ? (c + 1) % n : c + 1

    if (!shouldFillet) {
      out.push({ ...verts[iCurr] })
      continue
    }

    // Only fillet where both adjoining segments are straight.
    if (
      Math.abs(verts[iPrev].bulge) > FLOAT_TOL ||
      Math.abs(verts[iCurr].bulge) > FLOAT_TOL
    ) {
      out.push({ ...verts[iCurr] })
      skipped++
      continue
    }

    const outcome = acgeFilletCurves2d(
      {
        kind: 'line',
        start: { x: verts[iPrev].x, y: verts[iPrev].y },
        end: { x: verts[iCurr].x, y: verts[iCurr].y }
      },
      {
        kind: 'line',
        start: { x: verts[iCurr].x, y: verts[iCurr].y },
        end: { x: verts[iNext].x, y: verts[iNext].y }
      },
      {
        radius,
        hintA: {
          x: (verts[iPrev].x + verts[iCurr].x) / 2,
          y: (verts[iPrev].y + verts[iCurr].y) / 2
        },
        hintB: {
          x: (verts[iCurr].x + verts[iNext].x) / 2,
          y: (verts[iCurr].y + verts[iNext].y) / 2
        }
      }
    )

    if (!outcome.ok || !outcome.result.arc) {
      if (outcome.ok && radius <= FLOAT_TOL) {
        // Sharp corner: keep the intersection (current vertex already).
        out.push({ ...verts[iCurr] })
        filleted++
        continue
      }
      out.push({ ...verts[iCurr] })
      skipped++
      continue
    }

    const { trimA, trimB, arc } = outcome.result
    const bulge = arcBulge(arc)
    // Polyline encoding: vertex at trimA has bulge for the fillet arc to trimB.
    if (out.length === 0 || !sameXY(out[out.length - 1], trimA)) {
      if (
        out.length > 0 &&
        sameXY(out[out.length - 1], { x: verts[iCurr].x, y: verts[iCurr].y })
      ) {
        out[out.length - 1] = {
          x: trimA.x,
          y: trimA.y,
          bulge,
          startWidth: verts[iCurr].startWidth,
          endWidth: verts[iCurr].endWidth
        }
      } else {
        out.push({
          x: trimA.x,
          y: trimA.y,
          bulge,
          startWidth: verts[iCurr].startWidth,
          endWidth: verts[iCurr].endWidth
        })
      }
    } else {
      out[out.length - 1].bulge = bulge
    }
    out.push({
      x: trimB.x,
      y: trimB.y,
      bulge: 0,
      startWidth: verts[iCurr].startWidth,
      endWidth: verts[iCurr].endWidth
    })
    filleted++
  }

  if (!closed) {
    const end = verts[n - 1]
    if (out.length === 0 || !sameXY(out[out.length - 1], end)) {
      out.push({ ...end })
    }
  }

  pline.reset(false)
  for (let i = 0; i < out.length; i++) {
    const v = out[i]
    pline.addVertexAt(
      i,
      new AcGePoint2d(v.x, v.y),
      v.bulge,
      v.startWidth ?? -1,
      v.endWidth ?? -1
    )
  }
  pline.closed = closed

  return { filleted, skipped }
}

function filletPolylineSegments(
  pline: AcDbPolyline,
  pick1: AcGePoint3dLike,
  pick2: AcGePoint3dLike,
  options: AcDbFilletOptions
): { ok: true; result: AcDbFilletTwoResult } | { ok: false; error: AcGeFillet2dError } {
  const seg1 = nearestSegmentIndex(pline, pick1)
  const seg2 = nearestSegmentIndex(pline, pick2)
  if (seg1 < 0 || seg2 < 0 || seg1 === seg2) {
    return { ok: false, error: 'noSolution' }
  }

  const shared = sharedVertex(seg1, seg2, pline.numberOfVertices, pline.closed)
  if (shared < 0) {
    // Non-adjacent segments on one polyline are not a valid FILLET pick.
    return { ok: false, error: 'noSolution' }
  }

  if (!pline.closed && (shared === 0 || shared === pline.numberOfVertices - 1)) {
    return { ok: false, error: 'noSolution' }
  }

  if (options.trim === false) {
    const p1a = pline.getPoint2dAt(seg1)
    const p1b = pline.getPoint2dAt(
      pline.closed ? (seg1 + 1) % pline.numberOfVertices : seg1 + 1
    )
    const p2a = pline.getPoint2dAt(seg2)
    const p2b = pline.getPoint2dAt(
      pline.closed ? (seg2 + 1) % pline.numberOfVertices : seg2 + 1
    )
    const outcome = acgeFilletCurves2d(
      { kind: 'line', start: p1a, end: p1b },
      { kind: 'line', start: p2a, end: p2b },
      {
        radius: options.radius,
        hintA: { x: pick1.x, y: pick1.y },
        hintB: { x: pick2.x, y: pick2.y }
      }
    )
    if (!outcome.ok) return outcome
    const created: AcDbEntity[] = []
    if (outcome.result.arc && outcome.result.radius > FLOAT_TOL) {
      created.push(
        createFilletArcEntity(outcome.result.arc, pline, pline, pick1.z ?? 0)
      )
    }
    return { ok: true, result: { created, erase: [], modified: [] } }
  }

  const stats = filletPolylineCorners(pline, options, shared)
  if (stats.filleted === 0 && options.radius > FLOAT_TOL) {
    return { ok: false, error: 'radiusTooLarge' }
  }
  return {
    ok: true,
    result: { created: [], erase: [], modified: [pline] }
  }
}

function entityToPrimitive(
  entity: AcDbEntity,
  pick: AcGePoint3dLike
): AcGeFilletPrimitive2d | null {
  if (entity instanceof AcDbLine) {
    return {
      kind: 'line',
      start: entity.startPoint,
      end: entity.endPoint,
      extent: 'bounded'
    }
  }
  if (entity instanceof AcDbRay) {
    const end = {
      x: entity.basePoint.x + entity.unitDir.x * 1e6,
      y: entity.basePoint.y + entity.unitDir.y * 1e6
    }
    return {
      kind: 'line',
      start: entity.basePoint,
      end,
      extent: 'ray'
    }
  }
  if (entity instanceof AcDbXline) {
    const start = {
      x: entity.basePoint.x - entity.unitDir.x * 1e6,
      y: entity.basePoint.y - entity.unitDir.y * 1e6
    }
    const end = {
      x: entity.basePoint.x + entity.unitDir.x * 1e6,
      y: entity.basePoint.y + entity.unitDir.y * 1e6
    }
    return { kind: 'line', start, end, extent: 'unbounded' }
  }
  if (entity instanceof AcDbArc) {
    return {
      kind: 'circArc',
      center: entity.center,
      radius: entity.radius,
      startAngle: entity.startAngle,
      endAngle: entity.endAngle,
      closed: false
    }
  }
  if (entity instanceof AcDbCircle) {
    return {
      kind: 'circArc',
      center: entity.center,
      radius: entity.radius,
      startAngle: 0,
      endAngle: Math.PI * 2,
      closed: true
    }
  }
  if (entity instanceof AcDbEllipse) {
    const major = entity.majorAxis
    const rotation = Math.atan2(major.y, major.x)
    const ellipse2d = new AcGeEllipseArc2d(
      entity.center,
      entity.majorAxisRadius,
      entity.minorAxisRadius,
      entity.startAngle,
      entity.endAngle,
      false,
      rotation
    )
    return acgeFilletPrimitiveFromEllipse2d(ellipse2d)
  }
  if (entity instanceof AcDbSpline) {
    const prim = entity.subGetIntersectCurves()[0]
    if (prim?.kind === 'spline') {
      return acgeFilletPrimitiveFromSpline3d(prim.spline)
    }
    return null
  }
  if (entity instanceof AcDbPolyline) {
    const seg = nearestSegmentIndex(entity, pick)
    if (seg < 0) return null
    const a = entity.getPoint2dAt(seg)
    const b = entity.getPoint2dAt(
      entity.closed
        ? (seg + 1) % entity.numberOfVertices
        : seg + 1
    )
    const bulge = entity.getBulgeAt(seg)
    if (Math.abs(bulge) > FLOAT_TOL) {
      // Convert bulge segment to circArc.
      const arc = new AcGeCircArc2d(a, b, bulge)
      return {
        kind: 'circArc',
        center: arc.center,
        radius: arc.radius,
        startAngle: arc.startAngle,
        endAngle: arc.endAngle,
        clockwise: arc.clockwise
      }
    }
    return { kind: 'line', start: a, end: b, extent: 'bounded' }
  }
  return null
}

/**
 * Trims or converts an entity so one end meets `trimPt`.
 * Returns the mutated entity, or undefined when only a replacement was created.
 */
function applyTrim(
  entity: AcDbEntity,
  pick: AcGePoint3dLike,
  trimPt: AcGePoint2d,
  created: AcDbEntity[],
  erase: AcDbEntity[]
): AcDbEntity | undefined {
  const z = pick.z ?? 0
  const trim3 = new AcGePoint3d(trimPt.x, trimPt.y, z)

  if (entity instanceof AcDbLine) {
    // Keep the half of the segment that contains the pick (AutoCAD-like), and
    // move the opposite endpoint to the fillet/chamfer trim point. Comparing
    // endpoint-to-pick distances alone is wrong for connected lines: a pick
    // near the shared corner collapses the segment to zero length.
    trimLineToPoint(entity, pick, trim3)
    return entity
  }

  if (entity instanceof AcDbRay) {
    entity.basePoint = trim3
    return entity
  }

  if (entity instanceof AcDbXline) {
    // Convert to ray starting at trim, pointing away from the other side of pick.
    const ray = new AcDbRay()
    ray.basePoint = trim3
    const toPick = new AcGeVector3d(
      pick.x - trimPt.x,
      pick.y - trimPt.y,
      0
    )
    if (toPick.lengthSq() < FLOAT_TOL) {
      ray.unitDir = entity.unitDir.clone()
    } else {
      ray.unitDir = toPick.normalize()
    }
    ray.setPropertiesFrom(entity)
    created.push(ray)
    erase.push(entity)
    return undefined
  }

  if (entity instanceof AcDbArc) {
    const ang = Math.atan2(
      trimPt.y - entity.center.y,
      trimPt.x - entity.center.x
    )
    const midPick = Math.atan2(
      pick.y - entity.center.y,
      pick.x - entity.center.x
    )
    // Keep the side containing the pick.
    if (
      AcGeMathUtil.isAngleOnCcwSweep(entity.startAngle, midPick, ang) ||
      closerAngle(entity.startAngle, midPick) < closerAngle(entity.endAngle, midPick)
    ) {
      entity.endAngle = ang
    } else {
      entity.startAngle = ang
    }
    return entity
  }

  if (entity instanceof AcDbCircle) {
    // Circles are not trimmed.
    return undefined
  }

  if (entity instanceof AcDbEllipse || entity instanceof AcDbSpline) {
    // Ellipse/spline trim is not implemented in v1 — do not claim modified.
    return undefined
  }

  if (entity instanceof AcDbPolyline) {
    return trimPolylineSegment(entity, pick, trimPt)
  }

  return undefined
}

/**
 * Moves the far endpoint of the picked polyline segment to `trimPt`, keeping
 * the pick side. Returns the polyline when updated.
 */
function trimPolylineSegment(
  pline: AcDbPolyline,
  pick: AcGePoint3dLike,
  trimPt: AcGePoint2d
): AcDbEntity | undefined {
  const seg = nearestSegmentIndex(pline, pick)
  if (seg < 0) return undefined
  const n = pline.numberOfVertices
  const i0 = seg
  const i1 = pline.closed ? (seg + 1) % n : seg + 1
  const a = pline.getPoint2dAt(i0)
  const b = pline.getPoint2dAt(i1)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq < FLOAT_TOL) return undefined
  const tPick = ((pick.x - a.x) * dx + (pick.y - a.y) * dy) / lenSq
  const tTrim = ((trimPt.x - a.x) * dx + (trimPt.y - a.y) * dy) / lenSq
  if (tPick <= tTrim) {
    pline.setPointAt(i1, new AcGePoint2d(trimPt.x, trimPt.y))
  } else {
    pline.setPointAt(i0, new AcGePoint2d(trimPt.x, trimPt.y))
  }
  return pline
}

function createFilletArcEntity(
  arc2d: AcGeCircArc2d,
  e1: AcDbEntity,
  e2: AcDbEntity,
  z: number
): AcDbArc {
  const center = new AcGePoint3d(arc2d.center.x, arc2d.center.y, z)
  // AcDbArc always sweeps CCW from startAngle to endAngle. Derive math
  // atan2 angles from the actual endpoints (do not use CircArc2d's angle
  // getters — when clockwise they are mirrored and a naive swap becomes the
  // major arc). Pick the CCW order whose midpoint matches the 2d fillet arc.
  const startPt = arc2d.startPoint
  const endPt = arc2d.endPoint
  const through = arc2d.midPoint
  const a0 = Math.atan2(startPt.y - arc2d.center.y, startPt.x - arc2d.center.x)
  const a1 = Math.atan2(endPt.y - arc2d.center.y, endPt.x - arc2d.center.x)
  const aThrough = Math.atan2(
    through.y - arc2d.center.y,
    through.x - arc2d.center.x
  )
  const startAng = AcGeMathUtil.isAngleOnCcwSweep(a0, aThrough, a1) ? a0 : a1
  const endAng = startAng === a0 ? a1 : a0
  const arc = new AcDbArc(center, arc2d.radius, startAng, endAng)
  if (e1.layer === e2.layer) {
    arc.setPropertiesFrom(e1)
  }
  return arc
}

function nearestSegmentIndex(
  pline: AcDbPolyline,
  pick: AcGePoint3dLike
): number {
  const n = pline.numberOfVertices
  if (n < 2) return -1
  const count = pline.closed ? n : n - 1
  let best = -1
  let bestDist = Infinity
  for (let i = 0; i < count; i++) {
    const a = pline.getPoint2dAt(i)
    const b = pline.getPoint2dAt(pline.closed ? (i + 1) % n : i + 1)
    const proj = projectSeg(a, b, pick)
    const d = dist2(proj, pick)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

function sharedVertex(
  seg1: number,
  seg2: number,
  n: number,
  closed: boolean
): number {
  const a1 = seg1
  const a2 = closed ? (seg1 + 1) % n : seg1 + 1
  const b1 = seg2
  const b2 = closed ? (seg2 + 1) % n : seg2 + 1
  if (a1 === b1 || a1 === b2) return a1
  if (a2 === b1 || a2 === b2) return a2
  return -1
}

function projectSeg(
  a: AcGePoint2d,
  b: AcGePoint2d,
  pt: AcGePoint3dLike
): AcGePoint2d {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq < FLOAT_TOL) return a.clone()
  let t = ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return new AcGePoint2d(a.x + t * dx, a.y + t * dy)
}

function dist2(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * Shortens or extends a line so one end sits at `trimPt`, keeping the side that
 * contains `pick`.
 */
function trimLineToPoint(
  line: AcDbLine,
  pick: AcGePoint3dLike,
  trimPt: AcGePoint3d
) {
  const start = line.startPoint
  const end = line.endPoint
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lenSq = dx * dx + dy * dy
  if (lenSq < FLOAT_TOL) {
    line.endPoint = trimPt
    return
  }
  const tPick =
    ((pick.x - start.x) * dx + (pick.y - start.y) * dy) / lenSq
  const tTrim =
    ((trimPt.x - start.x) * dx + (trimPt.y - start.y) * dy) / lenSq
  if (tPick <= tTrim) {
    // Pick is toward the start side of the trim → keep start, move end.
    line.endPoint = trimPt
  } else {
    // Pick is toward the end side of the trim → keep end, move start.
    line.startPoint = trimPt
  }
}

function sameXY(
  a: { x: number; y: number },
  b: { x: number; y: number }
): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < 1e-8
}

function closerAngle(a: number, b: number): number {
  let d = Math.abs(AcGeMathUtil.normalizeAngle(a - b))
  if (d > Math.PI) d = Math.PI * 2 - d
  return d
}

function arcBulge(arc: AcGeCircArc2d): number {
  let sweep = AcGeMathUtil.normalizeAngle(arc.endAngle - arc.startAngle)
  if (arc.clockwise) {
    sweep = -AcGeMathUtil.normalizeAngle(arc.startAngle - arc.endAngle)
  }
  // bulge = tan(included/4); included is signed (negative = CW)
  const included = arc.clockwise ? -Math.abs(sweep) : Math.abs(sweep)
  return Math.tan(included / 4)
}
