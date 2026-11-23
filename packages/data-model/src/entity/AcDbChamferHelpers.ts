import {
  AcGeChamfer2dError,
  acgeChamferCurves2d,
  AcGeChamferMode,
  AcGePoint2d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGeVector3d,
  FLOAT_TOL
} from '@mlightcad/geometry-engine'

import { AcDbEntity } from './AcDbEntity.js'
import { AcDbLine } from './AcDbLine.js'
import { AcDbPolyline } from './AcDbPolyline.js'
import { AcDbRay } from './AcDbRay.js'
import { AcDbXline } from './AcDbXline.js'

/**
 * Options for {@link acdbChamferTwoEntities}.
 */
export interface AcDbChamferOptions {
  mode: AcGeChamferMode
  /** When true, trim/extend operands to the chamfer ends (default true). */
  trim?: boolean
}

/**
 * Result of chamfering two linear entities.
 */
export interface AcDbChamferTwoResult {
  created: AcDbEntity[]
  erase: AcDbEntity[]
  modified: AcDbEntity[]
}

/**
 * Result of chamfering every eligible polyline vertex.
 */
export interface AcDbChamferPolylineResult {
  chamfered: number
  skipped: number
}

export type AcDbChamferableEntity = AcDbLine | AcDbPolyline | AcDbRay | AcDbXline

/**
 * Returns true when the entity can participate in CHAMFER (linear only).
 */
export function acdbIsChamferableEntity(
  entity: AcDbEntity
): entity is AcDbChamferableEntity {
  return (
    entity instanceof AcDbLine ||
    entity instanceof AcDbPolyline ||
    entity instanceof AcDbRay ||
    entity instanceof AcDbXline
  )
}

/**
 * Chamfers two linear entities.
 */
export function acdbChamferTwoEntities(
  e1: AcDbEntity,
  pick1: AcGePoint3dLike,
  e2: AcDbEntity,
  pick2: AcGePoint3dLike,
  options: AcDbChamferOptions
):
  | { ok: true; result: AcDbChamferTwoResult }
  | { ok: false; error: AcGeChamfer2dError } {
  if (!acdbIsChamferableEntity(e1) || !acdbIsChamferableEntity(e2)) {
    return { ok: false, error: 'unsupported' }
  }

  if (e1 instanceof AcDbPolyline && e1 === e2) {
    return chamferPolylineSegments(e1, pick1, pick2, options)
  }

  const lineA = toChamferLine(e1, pick1)
  const lineB = toChamferLine(e2, pick2)
  if (!lineA || !lineB) return { ok: false, error: 'unsupported' }

  const outcome = acgeChamferCurves2d(lineA, lineB, {
    mode: options.mode,
    hintA: { x: pick1.x, y: pick1.y },
    hintB: { x: pick2.x, y: pick2.y }
  })
  if (!outcome.ok) return outcome

  const created: AcDbEntity[] = []
  const erase: AcDbEntity[] = []
  const modified: AcDbEntity[] = []
  const trim = options.trim !== false

  if (trim) {
    const m1 = applyLinearTrim(e1, pick1, outcome.result.trimA, created, erase)
    const m2 = applyLinearTrim(e2, pick2, outcome.result.trimB, created, erase)
    if (m1) modified.push(m1)
    if (m2) modified.push(m2)
  }

  if (!outcome.result.isCornerOnly) {
    const z = pick1.z ?? 0
    const chamfer = new AcDbLine(
      new AcGePoint3d(outcome.result.trimA.x, outcome.result.trimA.y, z),
      new AcGePoint3d(outcome.result.trimB.x, outcome.result.trimB.y, z)
    )
    if (e1.layer === e2.layer) {
      chamfer.setPropertiesFrom(e1)
    }
    created.push(chamfer)
  }

  return { ok: true, result: { created, erase, modified } }
}

/**
 * Inserts chamfers at every vertex of a 2D polyline where two straight segments meet.
 *
 * @param pline - Polyline to mutate
 * @param options - Distance/angle mode
 * @param onlyCorner - When set, chamfer only this vertex index
 */
export function acdbChamferPolyline(
  pline: AcDbPolyline,
  options: AcDbChamferOptions,
  onlyCorner?: number
): AcDbChamferPolylineResult {
  return chamferPolylineCorners(pline, options, onlyCorner)
}

function chamferPolylineCorners(
  pline: AcDbPolyline,
  options: AcDbChamferOptions,
  onlyCorner?: number
): AcDbChamferPolylineResult {
  const n = pline.numberOfVertices
  if (n < 2) return { chamfered: 0, skipped: 0 }

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
  const out: Vertex[] = []
  let chamfered = 0
  let skipped = 0

  const cornerStart = closed ? 0 : 1
  const cornerEnd = closed ? n - 1 : n - 2

  if (!closed) {
    out.push({ ...verts[0] })
  }

  for (let c = cornerStart; c <= cornerEnd; c++) {
    const shouldChamfer = onlyCorner === undefined || onlyCorner === c
    const iPrev = closed ? (c - 1 + n) % n : c - 1
    const iCurr = c
    const iNext = closed ? (c + 1) % n : c + 1

    if (!shouldChamfer) {
      out.push({ ...verts[iCurr] })
      continue
    }

    if (
      Math.abs(verts[iPrev].bulge) > FLOAT_TOL ||
      Math.abs(verts[iCurr].bulge) > FLOAT_TOL
    ) {
      out.push({ ...verts[iCurr] })
      skipped++
      continue
    }

    const outcome = acgeChamferCurves2d(
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
        mode: options.mode,
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

    if (!outcome.ok) {
      out.push({ ...verts[iCurr] })
      skipped++
      continue
    }

    if (outcome.result.isCornerOnly) {
      out.push({ ...verts[iCurr] })
      chamfered++
      continue
    }

    const { trimA, trimB } = outcome.result
    out.push({
      x: trimA.x,
      y: trimA.y,
      bulge: 0,
      startWidth: verts[iCurr].startWidth,
      endWidth: verts[iCurr].endWidth
    })
    out.push({
      x: trimB.x,
      y: trimB.y,
      bulge: 0,
      startWidth: verts[iCurr].startWidth,
      endWidth: verts[iCurr].endWidth
    })
    chamfered++
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
  return { chamfered, skipped }
}

function chamferPolylineSegments(
  pline: AcDbPolyline,
  pick1: AcGePoint3dLike,
  pick2: AcGePoint3dLike,
  options: AcDbChamferOptions
):
  | { ok: true; result: AcDbChamferTwoResult }
  | { ok: false; error: AcGeChamfer2dError } {
  const seg1 = nearestChamferSegmentIndex(pline, pick1)
  const seg2 = nearestChamferSegmentIndex(pline, pick2)
  if (seg1 < 0 || seg2 < 0 || seg1 === seg2) {
    return { ok: false, error: 'noSolution' }
  }

  const shared = sharedChamferVertex(
    seg1,
    seg2,
    pline.numberOfVertices,
    pline.closed
  )
  if (shared < 0) {
    return { ok: false, error: 'noSolution' }
  }

  if (!pline.closed && (shared === 0 || shared === pline.numberOfVertices - 1)) {
    return { ok: false, error: 'noSolution' }
  }

  if (options.trim === false) {
    const lineA = toChamferLine(pline, pick1)
    const lineB = toChamferLine(pline, pick2)
    if (!lineA || !lineB) return { ok: false, error: 'unsupported' }
    const outcome = acgeChamferCurves2d(lineA, lineB, {
      mode: options.mode,
      hintA: { x: pick1.x, y: pick1.y },
      hintB: { x: pick2.x, y: pick2.y }
    })
    if (!outcome.ok) return outcome
    const created: AcDbEntity[] = []
    if (!outcome.result.isCornerOnly) {
      const z = pick1.z ?? 0
      const chamfer = new AcDbLine(
        new AcGePoint3d(outcome.result.trimA.x, outcome.result.trimA.y, z),
        new AcGePoint3d(outcome.result.trimB.x, outcome.result.trimB.y, z)
      )
      chamfer.setPropertiesFrom(pline)
      created.push(chamfer)
    }
    return { ok: true, result: { created, erase: [], modified: [] } }
  }

  const stats = chamferPolylineCorners(pline, options, shared)
  if (stats.chamfered === 0) {
    return { ok: false, error: 'noSolution' }
  }
  return {
    ok: true,
    result: { created: [], erase: [], modified: [pline] }
  }
}

function nearestChamferSegmentIndex(
  pline: AcDbPolyline,
  pick: AcGePoint3dLike
): number {
  const n = pline.numberOfVertices
  if (n < 2) return -1
  const count = pline.closed ? n : n - 1
  let best = -1
  let bestDist = Infinity
  for (let i = 0; i < count; i++) {
    if (Math.abs(pline.getBulgeAt(i)) > FLOAT_TOL) continue
    const a = pline.getPoint2dAt(i)
    const b = pline.getPoint2dAt(pline.closed ? (i + 1) % n : i + 1)
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lenSq = dx * dx + dy * dy
    let t = 0
    if (lenSq > FLOAT_TOL) {
      t = ((pick.x - a.x) * dx + (pick.y - a.y) * dy) / lenSq
      t = Math.max(0, Math.min(1, t))
    }
    const px = a.x + t * dx
    const py = a.y + t * dy
    const d = Math.hypot(px - pick.x, py - pick.y)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

function sharedChamferVertex(
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

function sameXY(
  a: { x: number; y: number },
  b: { x: number; y: number }
): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < 1e-8
}

function toChamferLine(entity: AcDbChamferableEntity, pick: AcGePoint3dLike) {
  if (entity instanceof AcDbLine) {
    return {
      kind: 'line' as const,
      start: entity.startPoint,
      end: entity.endPoint,
      extent: 'bounded' as const
    }
  }
  if (entity instanceof AcDbRay) {
    return {
      kind: 'line' as const,
      start: entity.basePoint,
      end: {
        x: entity.basePoint.x + entity.unitDir.x * 1e6,
        y: entity.basePoint.y + entity.unitDir.y * 1e6
      },
      extent: 'ray' as const
    }
  }
  if (entity instanceof AcDbXline) {
    return {
      kind: 'line' as const,
      start: {
        x: entity.basePoint.x - entity.unitDir.x * 1e6,
        y: entity.basePoint.y - entity.unitDir.y * 1e6
      },
      end: {
        x: entity.basePoint.x + entity.unitDir.x * 1e6,
        y: entity.basePoint.y + entity.unitDir.y * 1e6
      },
      extent: 'unbounded' as const
    }
  }
  // Polyline: nearest straight segment
  const n = entity.numberOfVertices
  const count = entity.closed ? n : n - 1
  let best = -1
  let bestDist = Infinity
  for (let i = 0; i < count; i++) {
    if (Math.abs(entity.getBulgeAt(i)) > FLOAT_TOL) continue
    const a = entity.getPoint2dAt(i)
    const b = entity.getPoint2dAt(entity.closed ? (i + 1) % n : i + 1)
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lenSq = dx * dx + dy * dy
    let t = 0
    if (lenSq > FLOAT_TOL) {
      t = ((pick.x - a.x) * dx + (pick.y - a.y) * dy) / lenSq
      t = Math.max(0, Math.min(1, t))
    }
    const px = a.x + t * dx
    const py = a.y + t * dy
    const d = Math.hypot(px - pick.x, py - pick.y)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  if (best < 0) return null
  const a = entity.getPoint2dAt(best)
  const b = entity.getPoint2dAt(entity.closed ? (best + 1) % n : best + 1)
  return {
    kind: 'line' as const,
    start: a,
    end: b,
    extent: 'bounded' as const
  }
}

function applyLinearTrim(
  entity: AcDbEntity,
  pick: AcGePoint3dLike,
  trimPt: AcGePoint2d,
  created: AcDbEntity[],
  erase: AcDbEntity[]
): AcDbEntity | undefined {
  const z = pick.z ?? 0
  const trim3 = new AcGePoint3d(trimPt.x, trimPt.y, z)

  if (entity instanceof AcDbLine) {
    const start = entity.startPoint
    const end = entity.endPoint
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lenSq = dx * dx + dy * dy
    if (lenSq < FLOAT_TOL) {
      entity.endPoint = trim3
      return entity
    }
    const tPick =
      ((pick.x - start.x) * dx + (pick.y - start.y) * dy) / lenSq
    const tTrim =
      ((trim3.x - start.x) * dx + (trim3.y - start.y) * dy) / lenSq
    // Keep the half containing the pick; move the opposite endpoint.
    if (tPick <= tTrim) {
      entity.endPoint = trim3
    } else {
      entity.startPoint = trim3
    }
    return entity
  }

  if (entity instanceof AcDbRay) {
    entity.basePoint = trim3
    return entity
  }

  if (entity instanceof AcDbXline) {
    const ray = new AcDbRay()
    ray.basePoint = trim3
    const toPick = new AcGeVector3d(pick.x - trimPt.x, pick.y - trimPt.y, 0)
    ray.unitDir =
      toPick.lengthSq() < FLOAT_TOL
        ? entity.unitDir.clone()
        : toPick.normalize()
    ray.setPropertiesFrom(entity)
    created.push(ray)
    erase.push(entity)
    return undefined
  }

  if (entity instanceof AcDbPolyline) {
    const seg = nearestChamferSegmentIndex(entity, pick)
    if (seg < 0) return undefined
    const n = entity.numberOfVertices
    const i0 = seg
    const i1 = entity.closed ? (seg + 1) % n : seg + 1
    const a = entity.getPoint2dAt(i0)
    const b = entity.getPoint2dAt(i1)
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lenSq = dx * dx + dy * dy
    if (lenSq < FLOAT_TOL) return undefined
    const tPick = ((pick.x - a.x) * dx + (pick.y - a.y) * dy) / lenSq
    const tTrim = ((trimPt.x - a.x) * dx + (trimPt.y - a.y) * dy) / lenSq
    if (tPick <= tTrim) {
      entity.setPointAt(i1, new AcGePoint2d(trimPt.x, trimPt.y))
    } else {
      entity.setPointAt(i0, new AcGePoint2d(trimPt.x, trimPt.y))
    }
    return entity
  }

  return undefined
}
