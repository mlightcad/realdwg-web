import type { AcGePoint2dLike } from '@mlightcad/geometry-engine'
import type { AcGiHatchPatternLine } from '@mlightcad/graphic-interface'

/** Numeric tolerance of the pattern generation. */
const EPS = 1e-9
/** Upper bound on parallel pattern lines generated per definition line. */
const MAX_PATTERN_LINES = 8000
/** Upper bound on dash periods walked per clipped segment. */
const MAX_DASH_PERIODS = 100000

/** One generated pattern segment; a dot has identical end points. */
export type AcDbHatchPatternSegment = [AcGePoint2dLike, AcGePoint2dLike]

function rotate(x: number, y: number, angle: number): AcGePoint2dLike {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return { x: c * x - s * y, y: c * y + s * x }
}

function pointInEvenOdd(
  x: number,
  y: number,
  loops: readonly (readonly AcGePoint2dLike[])[]
): boolean {
  let inside = false
  for (const loop of loops) {
    const n = loop.length
    if (n < 3) continue
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const yi = loop[i].y
      const yj = loop[j].y
      const xi = loop[i].x
      const xj = loop[j].x
      const intersect =
        yi > y !== yj > y &&
        x < ((xj - xi) * (y - yi)) / (yj - yi + (yj === yi ? EPS : 0)) + xi
      if (intersect) inside = !inside
    }
  }
  return inside
}

function segmentIntersectT(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number
): number | null {
  const rX = bx - ax
  const rY = by - ay
  const sX = dx - cx
  const sY = dy - cy
  const den = rX * sY - rY * sX
  if (Math.abs(den) < EPS) return null
  const t = ((cx - ax) * sY - (cy - ay) * sX) / den
  const u = ((cx - ax) * rY - (cy - ay) * rX) / den
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null
  return Math.min(1, Math.max(0, t))
}

/**
 * Clips segment `a`→`b` against hatch boundary loops with the even-odd rule
 * and returns the parts inside the hatch.
 */
function clipSegmentToLoops(
  a: AcGePoint2dLike,
  b: AcGePoint2dLike,
  loops: readonly (readonly AcGePoint2dLike[])[]
): AcDbHatchPatternSegment[] {
  const ts = [0, 1]
  for (const loop of loops) {
    const n = loop.length
    if (n < 2) continue
    for (let i = 0; i < n; i++) {
      const c = loop[i]
      const d = loop[(i + 1) % n]
      const t = segmentIntersectT(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y)
      if (t != null) ts.push(t)
    }
  }
  ts.sort((p, q) => p - q)
  const unique: number[] = []
  for (const t of ts) {
    if (unique.length === 0 || Math.abs(t - unique[unique.length - 1]) > 1e-8) {
      unique.push(t)
    }
  }
  const out: AcDbHatchPatternSegment[] = []
  for (let i = 0; i + 1 < unique.length; i++) {
    const t0 = unique[i]
    const t1 = unique[i + 1]
    if (t1 - t0 < 1e-8) continue
    const mx = a.x + (b.x - a.x) * (t0 + t1) * 0.5
    const my = a.y + (b.y - a.y) * (t0 + t1) * 0.5
    if (!pointInEvenOdd(mx, my, loops)) continue
    out.push([
      { x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 },
      { x: a.x + (b.x - a.x) * t1, y: a.y + (b.y - a.y) * t1 }
    ])
  }
  return out
}

/**
 * Splits `a`→`b` into the visible dashes of a pattern line. `startPos` is the
 * position of `a` along the pattern line, so dashes stay aligned to the
 * pattern instead of to where the boundary clips it. Zero-length dashes are
 * returned as dots (segments with identical end points).
 */
function dashSegment(
  a: AcGePoint2dLike,
  b: AcGePoint2dLike,
  dashLengths: readonly number[],
  startPos: number
): AcDbHatchPatternSegment[] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (!(len > EPS)) return []
  if (!dashLengths.length) return [[a, b]]
  let patternLen = 0
  for (const value of dashLengths) patternLen += Math.abs(value)
  if (!(patternLen > EPS) || len / patternLen > MAX_DASH_PERIODS) {
    return [[a, b]]
  }
  const ux = dx / len
  const uy = dy / len
  const at = (pos: number): AcGePoint2dLike => ({
    x: a.x + ux * pos,
    y: a.y + uy * pos
  })
  const out: AcDbHatchPatternSegment[] = []
  const phase = ((startPos % patternLen) + patternLen) % patternLen
  for (let period = -phase; period < len - EPS; period += patternLen) {
    let cursor = period
    for (const value of dashLengths) {
      const abs = Math.abs(value)
      if (value > 0) {
        const s0 = Math.max(cursor, 0)
        const s1 = Math.min(cursor + abs, len)
        if (s1 - s0 > EPS) out.push([at(s0), at(s1)])
      } else if (abs < EPS && cursor >= -EPS && cursor <= len + EPS) {
        const p = at(Math.min(Math.max(cursor, 0), len))
        out.push([p, p])
      }
      cursor += abs
    }
  }
  return out
}

/**
 * Generates the line segments of a hatch pattern clipped to its boundary,
 * the geometry AutoCAD EXPLODE turns a pattern hatch into.
 *
 * The layout matches the hatch renderers (pattern line offsets in
 * line-local space, `patternAngle` applied on top of the definition lines),
 * so the exploded lines coincide with the displayed pattern. Boundaries use
 * the even-odd rule.
 *
 * @param loops - Tessellated boundary loops in the hatch plane (OCS).
 * @param definitionLines - Pattern definition lines.
 * @param patternAngle - Extra rotation applied to the definition lines.
 * @returns The pattern segments in the hatch plane; dots are returned as
 *          segments with identical end points.
 */
export function acdbTessellateHatchPattern(
  loops: readonly (readonly AcGePoint2dLike[])[],
  definitionLines: readonly AcGiHatchPatternLine[],
  patternAngle = 0
): AcDbHatchPatternSegment[] {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const loop of loops) {
    for (const p of loop) {
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    }
  }
  if (!Number.isFinite(minX) || definitionLines.length === 0) return []

  const segments: AcDbHatchPatternSegment[] = []
  const pad = Math.max(maxX - minX, maxY - minY, 1) * 2
  for (const line of definitionLines) {
    const angle = (line.angle || 0) + patternAngle
    const base = rotate(line.base?.x ?? 0, line.base?.y ?? 0, patternAngle)
    const offset = rotate(
      line.offset?.x ?? 0,
      line.offset?.y ?? 0,
      -(line.angle || 0)
    )
    const spacing =
      Math.abs(offset.y) > EPS ? offset.y : Math.hypot(offset.x, offset.y)
    if (!(Math.abs(spacing) > EPS)) continue
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    const toLocal = (x: number, y: number) => {
      const dx = x - base.x
      const dy = y - base.y
      return { x: c * dx + s * dy, y: -s * dx + c * dy }
    }
    const toWorld = (x: number, y: number) => ({
      x: base.x + c * x - s * y,
      y: base.y + s * x + c * y
    })
    const corners = [
      toLocal(minX, minY),
      toLocal(maxX, minY),
      toLocal(maxX, maxY),
      toLocal(minX, maxY)
    ]
    let minLX = Infinity
    let maxLX = -Infinity
    let minLY = Infinity
    let maxLY = -Infinity
    for (const p of corners) {
      minLX = Math.min(minLX, p.x)
      maxLX = Math.max(maxLX, p.x)
      minLY = Math.min(minLY, p.y)
      maxLY = Math.max(maxLY, p.y)
    }
    minLX -= pad
    maxLX += pad
    // A negative spacing (offset to the right of the line direction, as in
    // AR-CONC or a mirrored hatch) reverses the line indices of the box.
    const k0 = minLY / spacing
    const k1 = maxLY / spacing
    const startK = Math.floor(Math.min(k0, k1)) - 1
    const endK = Math.ceil(Math.max(k0, k1)) + 1
    if (endK - startK + 1 > MAX_PATTERN_LINES) continue
    const dashes = Array.isArray(line.dashLengths) ? line.dashLengths : []
    for (let k = startK; k <= endK; k++) {
      const y = k * spacing
      const a = toWorld(minLX, y)
      const b = toWorld(maxLX, y)
      // Dash phase follows the shader: localX - localY * offset.x / offset.y
      const shift = Math.abs(offset.y) > EPS ? (y * offset.x) / offset.y : 0
      for (const [ca, cb] of clipSegmentToLoops(a, b, loops)) {
        const startPos = toLocal(ca.x, ca.y).x - shift
        segments.push(...dashSegment(ca, cb, dashes, startPos))
      }
    }
  }
  return segments
}
