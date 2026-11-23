import {
  AcGeMathUtil,
  AcGePoint2d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGeTol,
  acgeTransformWcsPointToOcs,
  AcGeVector3d,
  DEFAULT_TOL,
  FLOAT_TOL,
  TAU
} from '@mlightcad/geometry-engine'

import { AcDbArc } from './AcDbArc.js'
import { AcDbCircle } from './AcDbCircle.js'
import { AcDbEntity } from './AcDbEntity.js'
import { AcDbLine } from './AcDbLine.js'
import { AcDbPolyline } from './AcDbPolyline.js'

/**
 * One successfully merged group from {@link acdbJoinAllEntities}.
 */
export interface AcDbJoinGroup {
  /** Newly created join result (non-database-resident). */
  result: AcDbEntity
  /** Source entities merged into `result` (≥2). */
  sources: AcDbEntity[]
}

/**
 * Result of {@link acdbJoinAllEntities}: one entry per merged group.
 */
export interface AcDbJoinAllResult {
  /** Successfully joined groups. */
  groups: AcDbJoinGroup[]
  /** Flattened list of every source entity that was consumed. */
  consumed: AcDbEntity[]
}

/** Open curve that JOIN can consider in this v1. */
export type AcDbJoinableCurve = AcDbLine | AcDbArc | AcDbPolyline

interface AcDbJoinEndpoints {
  start: AcGePoint3d
  end: AcGePoint3d
}

/**
 * Returns true when `entity` is an open Line, Arc, or LWPOLYLINE that JOIN
 * may attempt to merge.
 */
export function acdbIsJoinableEntity(
  entity: AcDbEntity
): entity is AcDbJoinableCurve {
  if (entity instanceof AcDbLine) return true
  if (entity instanceof AcDbArc) return !entity.closed
  if (entity instanceof AcDbPolyline) {
    return !entity.closed && entity.numberOfVertices >= 2
  }
  return false
}

/**
 * Start / end points of an open joinable curve in WCS.
 */
export function acdbJoinEndpointsOf(
  entity: AcDbJoinableCurve
): AcDbJoinEndpoints {
  if (entity instanceof AcDbLine) {
    return { start: entity.startPoint, end: entity.endPoint }
  }
  if (entity instanceof AcDbArc) {
    return { start: entity.startPoint, end: entity.endPoint }
  }
  return {
    start: entity.getPoint3dAt(0),
    end: entity.getPoint3dAt(entity.numberOfVertices - 1)
  }
}

/**
 * Joins collinear open lines into one line spanning their union. Gaps between
 * endpoints are filled, matching AutoCAD JOIN for lines. Returns `undefined`
 * when fewer than two lines are collinear with `primary`.
 */
export function acdbJoinCollinearLines(
  primary: AcDbLine,
  others: readonly AcDbEntity[],
  tol: AcGeTol = DEFAULT_TOL
): AcDbLine | undefined {
  const lines = [primary]
  for (const entity of others) {
    if (!(entity instanceof AcDbLine)) continue
    if (entity === primary) continue
    if (acdbAreCollinearLines(primary, entity, tol)) lines.push(entity)
  }
  if (lines.length < 2) return undefined
  return acdbMergeCollinearLines(lines, primary, tol)
}

/**
 * Joins coplanar arcs that share center and radius into one arc, or a circle
 * when the joined span covers a full turn. Gaps are filled by lengthening
 * counter-clockwise from `primary`, matching AutoCAD JOIN.
 */
export function acdbJoinConcentricArcs(
  primary: AcDbArc,
  others: readonly AcDbEntity[],
  tol: AcGeTol = DEFAULT_TOL
): AcDbArc | AcDbCircle | undefined {
  if (primary.closed) return undefined
  const arcs = [primary]
  for (const entity of others) {
    if (!(entity instanceof AcDbArc)) continue
    if (entity === primary) continue
    if (entity.closed) continue
    if (acdbAreConcentricArcs(primary, entity, tol)) arcs.push(entity)
  }
  if (arcs.length < 2) return undefined
  return acdbMergeConcentricArcs(arcs, primary, tol)
}

/**
 * Joins contiguous coplanar lines, arcs and open polylines that share
 * endpoints with `primary` into one LWPOLYLINE. Non-touching candidates are
 * ignored. Returns `undefined` when nothing can be chained onto `primary`.
 */
export function acdbJoinToPolyline(
  primary: AcDbJoinableCurve,
  others: readonly AcDbEntity[],
  tol: AcGeTol = DEFAULT_TOL
): AcDbPolyline | undefined {
  if (!acdbIsJoinableEntity(primary)) return undefined
  const candidates: AcDbJoinableCurve[] = [primary]
  for (const entity of others) {
    if (entity === primary) continue
    if (!acdbIsJoinableEntity(entity)) continue
    candidates.push(entity)
  }
  if (candidates.length < 2) return undefined

  const chain = acdbBuildEndpointChain(candidates, primary, tol)
  if (!chain || chain.length < 2) return undefined
  if (!acdbAreCoplanarJoinables(chain, tol)) return undefined
  return acdbAssemblePolyline(chain, primary, tol)
}

/**
 * AutoCAD-style multi-select JOIN over a set of entities with no designated
 * source object. Produces one result per mergeable group:
 * - collinear lines → line
 * - concentric arcs → arc / circle
 * - contiguous mixed curves → polyline
 *
 * Sources that cannot join remain unconsumed.
 */
export function acdbJoinAllEntities(
  entities: readonly AcDbEntity[],
  tol: AcGeTol = DEFAULT_TOL
): AcDbJoinAllResult {
  const groups: AcDbJoinGroup[] = []
  const remaining = new Set<AcDbEntity>()
  for (const entity of entities) {
    if (acdbIsJoinableEntity(entity)) remaining.add(entity)
  }

  const pushGroup = (result: AcDbEntity, sources: AcDbEntity[]) => {
    groups.push({ result, sources })
    for (const source of sources) remaining.delete(source)
  }

  // Phase 1: collinear line groups (gaps allowed).
  const lines = [...remaining].filter(
    (e): e is AcDbLine => e instanceof AcDbLine
  )
  const lineGroups = acdbGroupCollinearLines(lines, tol)
  for (const group of lineGroups) {
    if (group.length < 2) continue
    const merged = acdbMergeCollinearLines(group, group[0], tol)
    if (!merged) continue
    pushGroup(merged, group)
  }

  // Phase 2: concentric arc groups (gaps allowed).
  const arcs = [...remaining].filter(
    (e): e is AcDbArc => e instanceof AcDbArc && !e.closed
  )
  const arcGroups = acdbGroupConcentricArcs(arcs, tol)
  for (const group of arcGroups) {
    if (group.length < 2) continue
    const merged = acdbMergeConcentricArcs(group, group[0], tol)
    if (!merged) continue
    pushGroup(merged, group)
  }

  // Phase 3: endpoint-connected chains among leftover joinables → polylines.
  const leftover = [...remaining].filter(acdbIsJoinableEntity)
  const used = new Set<AcDbJoinableCurve>()
  for (const seed of leftover) {
    if (used.has(seed)) continue
    const pool = leftover.filter(e => !used.has(e))
    const chain = acdbBuildEndpointChain(pool, seed, tol)
    if (!chain || chain.length < 2) continue
    if (!acdbAreCoplanarJoinables(chain, tol)) continue
    const pline = acdbAssemblePolyline(chain, chain[0], tol)
    if (!pline) continue
    for (const entity of chain) used.add(entity)
    pushGroup(pline, chain)
  }

  return {
    groups,
    consumed: groups.flatMap(group => group.sources)
  }
}

function acdbAreCollinearLines(
  a: AcDbLine,
  b: AcDbLine,
  tol: AcGeTol
): boolean {
  const a0 = a.startPoint
  const a1 = a.endPoint
  const dir = new AcGeVector3d().subVectors(a1, a0)
  const len = dir.length()
  if (len <= tol.equalPointTol) return false
  dir.multiplyScalar(1 / len)

  const bDir = new AcGeVector3d().subVectors(b.endPoint, b.startPoint)
  const bLen = bDir.length()
  if (bLen <= tol.equalPointTol) return false
  bDir.multiplyScalar(1 / bLen)
  if (!acdbEqualUnitVector(dir, bDir, tol) && !acdbEqualUnitVector(dir, bDir.clone().negate(), tol)) {
    return false
  }

  return (
    acdbPointOnInfiniteLine(b.startPoint, a0, dir, tol) &&
    acdbPointOnInfiniteLine(b.endPoint, a0, dir, tol)
  )
}

function acdbPointOnInfiniteLine(
  point: AcGePoint3dLike,
  origin: AcGePoint3dLike,
  unitDir: AcGeVector3d,
  tol: AcGeTol
): boolean {
  const rel = new AcGeVector3d().subVectors(point, origin)
  const proj = unitDir.clone().multiplyScalar(rel.dot(unitDir))
  const perp = rel.sub(proj)
  return perp.length() <= tol.equalPointTol
}

function acdbMergeCollinearLines(
  lines: readonly AcDbLine[],
  primary: AcDbLine,
  tol: AcGeTol
): AcDbLine | undefined {
  const origin = primary.startPoint
  const dir = new AcGeVector3d().subVectors(primary.endPoint, origin)
  const len = dir.length()
  if (len <= tol.equalPointTol) return undefined
  dir.multiplyScalar(1 / len)

  let minT = Infinity
  let maxT = -Infinity
  let minPoint = origin.clone()
  let maxPoint = origin.clone()
  for (const line of lines) {
    for (const p of [line.startPoint, line.endPoint]) {
      const t = new AcGeVector3d().subVectors(p, origin).dot(dir)
      if (t < minT) {
        minT = t
        minPoint = p.clone()
      }
      if (t > maxT) {
        maxT = t
        maxPoint = p.clone()
      }
    }
  }
  if (maxT - minT <= tol.equalPointTol) return undefined

  const result = new AcDbLine(minPoint, maxPoint)
  result.setPropertiesFrom(primary)
  if (primary.thickness !== 0) result.thickness = primary.thickness
  result.normal = primary.normal
  return result
}

function acdbGroupCollinearLines(
  lines: readonly AcDbLine[],
  tol: AcGeTol
): AcDbLine[][] {
  const groups: AcDbLine[][] = []
  const assigned = new Set<AcDbLine>()
  for (const line of lines) {
    if (assigned.has(line)) continue
    const group: AcDbLine[] = []
    const queue: AcDbLine[] = [line]
    assigned.add(line)
    while (queue.length > 0) {
      const current = queue.pop()!
      group.push(current)
      for (const other of lines) {
        if (assigned.has(other)) continue
        if (acdbAreCollinearLines(current, other, tol)) {
          assigned.add(other)
          queue.push(other)
        }
      }
    }
    groups.push(group)
  }
  return groups
}

function acdbAreConcentricArcs(
  a: AcDbArc,
  b: AcDbArc,
  tol: AcGeTol
): boolean {
  if (!tol.equalPoint3d(a.center, b.center)) return false
  if (Math.abs(a.radius - b.radius) > tol.equalPointTol) return false
  const n0 = new AcGeVector3d(a.normal).normalize()
  const n1 = new AcGeVector3d(b.normal).normalize()
  return (
    acdbEqualUnitVector(n0, n1, tol) ||
    acdbEqualUnitVector(n0, n1.clone().negate(), tol)
  )
}

function acdbGroupConcentricArcs(
  arcs: readonly AcDbArc[],
  tol: AcGeTol
): AcDbArc[][] {
  const groups: AcDbArc[][] = []
  const assigned = new Set<AcDbArc>()
  for (const arc of arcs) {
    if (assigned.has(arc)) continue
    const group: AcDbArc[] = []
    const queue: AcDbArc[] = [arc]
    assigned.add(arc)
    while (queue.length > 0) {
      const current = queue.pop()!
      group.push(current)
      for (const other of arcs) {
        if (assigned.has(other)) continue
        if (acdbAreConcentricArcs(current, other, tol)) {
          assigned.add(other)
          queue.push(other)
        }
      }
    }
    groups.push(group)
  }
  return groups
}

function acdbArcSweep(arc: AcDbArc): number {
  const sweep = AcGeMathUtil.normalizeAngle(arc.endAngle - arc.startAngle)
  return sweep <= FLOAT_TOL ? TAU : sweep
}

function acdbCcwDelta(from: number, to: number): number {
  return AcGeMathUtil.normalizeAngle(to - from)
}

function acdbMergeConcentricArcs(
  arcs: readonly AcDbArc[],
  primary: AcDbArc,
  _tol: AcGeTol
): AcDbArc | AcDbCircle | undefined {
  const origin = AcGeMathUtil.normalizeAngle(primary.startAngle)
  let coverEnd = acdbArcSweep(primary)

  for (const arc of arcs) {
    if (arc === primary) continue
    const relStart = acdbCcwDelta(origin, arc.startAngle)
    const relEnd = relStart + acdbArcSweep(arc)
    if (relEnd > coverEnd) coverEnd = relEnd
  }

  if (coverEnd >= TAU - FLOAT_TOL) {
    const circle = new AcDbCircle(
      primary.center,
      primary.radius,
      primary.normal
    )
    circle.setPropertiesFrom(primary)
    if (primary.thickness !== 0) circle.thickness = primary.thickness
    return circle
  }

  const result = new AcDbArc(
    primary.center,
    primary.radius,
    origin,
    AcGeMathUtil.normalizeAngle(origin + coverEnd),
    primary.normal
  )
  result.setPropertiesFrom(primary)
  if (primary.thickness !== 0) result.thickness = primary.thickness
  return result
}

function acdbEqualUnitVector(
  a: AcGeVector3d,
  b: AcGeVector3d,
  tol: AcGeTol
): boolean {
  return new AcGeVector3d().subVectors(a, b).length() <= tol.equalVectorTol
}

function acdbJoinPlaneNormal(
  entity: AcDbJoinableCurve
): AcGeVector3d {
  if (entity instanceof AcDbLine) return new AcGeVector3d(entity.normal)
  if (entity instanceof AcDbArc) return new AcGeVector3d(entity.normal)
  return new AcGeVector3d(entity.normal)
}

function acdbAreCoplanarJoinables(
  entities: readonly AcDbJoinableCurve[],
  tol: AcGeTol
): boolean {
  if (entities.length === 0) return true
  const ref = acdbJoinPlaneNormal(entities[0]).normalize()
  const refPoint = acdbJoinEndpointsOf(entities[0]).start
  for (let i = 1; i < entities.length; i++) {
    const n = acdbJoinPlaneNormal(entities[i]).normalize()
    if (
      !acdbEqualUnitVector(ref, n, tol) &&
      !acdbEqualUnitVector(ref, n.clone().negate(), tol)
    ) {
      return false
    }
    // All endpoints must lie on the same plane (refPoint, ref).
    for (const p of [
      acdbJoinEndpointsOf(entities[i]).start,
      acdbJoinEndpointsOf(entities[i]).end
    ]) {
      const rel = new AcGeVector3d().subVectors(p, refPoint)
      if (Math.abs(rel.dot(ref)) > tol.equalPointTol) return false
    }
  }
  return true
}

/**
 * Walks from `seed` along shared endpoints, forming a linear chain (no
 * branches). Returns ordered entities in traversal order, or `undefined` when
 * a branch (Y junction) is found.
 */
function acdbBuildEndpointChain(
  pool: readonly AcDbJoinableCurve[],
  seed: AcDbJoinableCurve,
  tol: AcGeTol
): AcDbJoinableCurve[] | undefined {
  if (pool.length < 2) return undefined

  type Node = { entity: AcDbJoinableCurve; reversed: boolean }
  const endpoints = new Map<AcDbJoinableCurve, AcDbJoinEndpoints>()
  for (const entity of pool) {
    endpoints.set(entity, acdbJoinEndpointsOf(entity))
  }

  const adjacency = new Map<AcDbJoinableCurve, AcDbJoinableCurve[]>()
  for (const entity of pool) adjacency.set(entity, [])

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i]
      const b = pool[j]
      const ea = endpoints.get(a)!
      const eb = endpoints.get(b)!
      if (
        tol.equalPoint3d(ea.start, eb.start) ||
        tol.equalPoint3d(ea.start, eb.end) ||
        tol.equalPoint3d(ea.end, eb.start) ||
        tol.equalPoint3d(ea.end, eb.end)
      ) {
        adjacency.get(a)!.push(b)
        adjacency.get(b)!.push(a)
      }
    }
  }

  // Prefer an endpoint of the connected component that contains seed.
  const component = new Set<AcDbJoinableCurve>()
  const stack = [seed]
  while (stack.length > 0) {
    const cur = stack.pop()!
    if (component.has(cur)) continue
    component.add(cur)
    for (const n of adjacency.get(cur) ?? []) stack.push(n)
  }
  if (component.size < 2) return undefined

  // Y junction within this component — AutoCAD does not join into a branched
  // polyline. Unrelated branches elsewhere in `pool` must not block this chain.
  for (const entity of component) {
    if ((adjacency.get(entity)?.length ?? 0) > 2) {
      return undefined
    }
  }

  let start = seed
  for (const entity of component) {
    if ((adjacency.get(entity)?.length ?? 0) <= 1) {
      start = entity
      break
    }
  }

  const ordered: Node[] = []
  const visited = new Set<AcDbJoinableCurve>()
  let current: AcDbJoinableCurve | undefined = start
  let previous: AcDbJoinableCurve | undefined
  let freeEnd = endpoints.get(start)!.start

  // Orient start so we leave through the end that has a neighbor (if any).
  const startNeighbors = (adjacency.get(start) ?? []).filter(n =>
    component.has(n)
  )
  if (startNeighbors.length === 1) {
    const neighbor = startNeighbors[0]
    const es = endpoints.get(start)!
    const en = endpoints.get(neighbor)!
    if (
      tol.equalPoint3d(es.start, en.start) ||
      tol.equalPoint3d(es.start, en.end)
    ) {
      ordered.push({ entity: start, reversed: true })
      freeEnd = es.start
    } else {
      ordered.push({ entity: start, reversed: false })
      freeEnd = es.end
    }
  } else {
    ordered.push({ entity: start, reversed: false })
    freeEnd = endpoints.get(start)!.end
  }
  visited.add(start)
  previous = start
  current = startNeighbors[0]

  while (current && !visited.has(current)) {
    const ends = endpoints.get(current)!
    let reversed = false
    if (tol.equalPoint3d(freeEnd, ends.start)) {
      reversed = false
      freeEnd = ends.end
    } else if (tol.equalPoint3d(freeEnd, ends.end)) {
      reversed = true
      freeEnd = ends.start
    } else {
      return undefined
    }
    ordered.push({ entity: current, reversed })
    visited.add(current)
    const neighbors = adjacency.get(current) ?? []
    let next: AcDbJoinableCurve | undefined
    for (const n of neighbors) {
      if (component.has(n) && n !== previous && !visited.has(n)) {
        next = n
        break
      }
    }
    previous = current
    current = next
  }

  if (ordered.length < 2) return undefined
  // Store orientation on a weak side channel via a parallel array rebuilt below.
  return acdbApplyChainOrientation(ordered)
}

function acdbApplyChainOrientation(
  nodes: { entity: AcDbJoinableCurve; reversed: boolean }[]
): AcDbJoinableCurve[] {
  // Attach reverse flags via a module-level WeakMap for assemble.
  for (const node of nodes) {
    joinChainReversed.set(node.entity, node.reversed)
  }
  return nodes.map(n => n.entity)
}

const joinChainReversed = new WeakMap<AcDbJoinableCurve, boolean>()

function acdbAssemblePolyline(
  chain: readonly AcDbJoinableCurve[],
  primary: AcDbJoinableCurve,
  tol: AcGeTol
): AcDbPolyline | undefined {
  const normal = acdbJoinPlaneNormal(primary).normalize()
  const pline = new AcDbPolyline()
  pline.normal = normal

  const firstEnds = acdbJoinEndpointsOf(chain[0])
  const firstReversed = joinChainReversed.get(chain[0]) === true
  const firstStart = firstReversed ? firstEnds.end : firstEnds.start
  const firstOcs = acgeTransformWcsPointToOcs(firstStart, normal)
  pline.elevation = firstOcs.z
  pline.addVertexAt(0, new AcGePoint2d(firstOcs.x, firstOcs.y), 0)

  let vertexIndex = 1
  for (const entity of chain) {
    const reversed = joinChainReversed.get(entity) === true
    const appended = acdbAppendJoinableToPolyline(
      pline,
      entity,
      reversed,
      normal,
      vertexIndex
    )
    if (appended == null) return undefined
    vertexIndex = appended
  }

  if (pline.numberOfVertices < 2) return undefined

  const start = pline.getPoint3dAt(0)
  const end = pline.getPoint3dAt(pline.numberOfVertices - 1)
  if (tol.equalPoint3d(start, end) && pline.numberOfVertices > 2) {
    // Drop duplicated closing vertex and mark closed.
    pline.removeVertexAt(pline.numberOfVertices - 1)
    pline.closed = true
  }

  pline.setPropertiesFrom(primary)
  if (primary instanceof AcDbLine && primary.thickness !== 0) {
    pline.thickness = primary.thickness
  } else if (primary instanceof AcDbArc && primary.thickness !== 0) {
    pline.thickness = primary.thickness
  } else if (primary instanceof AcDbPolyline && primary.thickness !== 0) {
    pline.thickness = primary.thickness
  }
  return pline
}

function acdbAppendJoinableToPolyline(
  pline: AcDbPolyline,
  entity: AcDbJoinableCurve,
  reversed: boolean,
  normal: AcGeVector3d,
  vertexIndex: number
): number | undefined {
  if (entity instanceof AcDbLine) {
    const end = reversed ? entity.startPoint : entity.endPoint
    const ocs = acgeTransformWcsPointToOcs(end, normal)
    // Bulge of the previous vertex stays 0 (straight).
    pline.addVertexAt(vertexIndex, new AcGePoint2d(ocs.x, ocs.y), 0)
    return vertexIndex + 1
  }

  if (entity instanceof AcDbArc) {
    const sweep = acdbArcSweep(entity)
    const bulge = Math.tan(sweep / 4) * (reversed ? -1 : 1)
    const end = reversed ? entity.startPoint : entity.endPoint
    // Set bulge on the vertex that starts this segment (last existing).
    const prev = pline.getPoint2dAt(vertexIndex - 1)
    const prevBulge = bulge
    // Rebuild last vertex with bulge: remove and re-add.
    pline.removeVertexAt(vertexIndex - 1)
    pline.addVertexAt(vertexIndex - 1, prev, prevBulge)
    const ocs = acgeTransformWcsPointToOcs(end, normal)
    pline.addVertexAt(vertexIndex, new AcGePoint2d(ocs.x, ocs.y), 0)
    return vertexIndex + 1
  }

  // Polyline: append via WCS→result OCS so differing elevations still work.
  const count = entity.numberOfVertices
  if (count < 2) return undefined

  const toResultOcs = (index: number) => {
    const wcs = entity.getPoint3dAt(index)
    const ocs = acgeTransformWcsPointToOcs(wcs, normal)
    return new AcGePoint2d(ocs.x, ocs.y)
  }

  if (!reversed) {
    for (let i = 0; i < count - 1; i++) {
      const bulge = entity.getBulgeAt(i)
      if (i === 0) {
        const prev = pline.getPoint2dAt(vertexIndex - 1)
        pline.removeVertexAt(vertexIndex - 1)
        pline.addVertexAt(vertexIndex - 1, prev, bulge)
      } else {
        pline.addVertexAt(vertexIndex, toResultOcs(i), bulge)
        vertexIndex++
      }
    }
    pline.addVertexAt(vertexIndex, toResultOcs(count - 1), 0)
    return vertexIndex + 1
  }

  // Reversed: walk backward; segment i-1→i becomes i→i-1 with negated bulge.
  for (let i = count - 1; i > 0; i--) {
    const bulge = -entity.getBulgeAt(i - 1)
    if (i === count - 1) {
      const prev = pline.getPoint2dAt(vertexIndex - 1)
      pline.removeVertexAt(vertexIndex - 1)
      pline.addVertexAt(vertexIndex - 1, prev, bulge)
    } else {
      pline.addVertexAt(vertexIndex, toResultOcs(i), bulge)
      vertexIndex++
    }
  }
  pline.addVertexAt(vertexIndex, toResultOcs(0), 0)
  return vertexIndex + 1
}
