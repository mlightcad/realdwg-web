import {
  acgeGetOcsReferenceVector,
  AcGePoint3d,
  AcGePoint3dLike,
  acgeTransformOcsPointToWcs,
  AcGeVector3d,
  AcGeVector3dLike
} from '@mlightcad/geometry-engine'

import { AcDbArc } from './AcDbArc.js'
import { AcDbCurve } from './AcDbCurve.js'
import { AcDbLine } from './AcDbLine.js'

/** Tolerance below which a polyline segment is considered zero length. */
const SEGMENT_EPSILON = 1e-10
/** Bulge magnitude below which a polyline segment is treated as straight. */
const BULGE_EPSILON = 1e-12

/**
 * One vertex of a planar bulge path, in OCS.
 */
export interface AcDbBulgePathVertex {
  /** OCS X coordinate */
  x: number
  /** OCS Y coordinate */
  y: number
  /**
   * Bulge of the segment that starts at this vertex: `tan(θ / 4)` where `θ`
   * is the included angle, positive for a counter-clockwise arc.
   */
  bulge?: number
}

/**
 * Options of {@link acdbExplodeBulgePath}.
 */
export interface AcDbExplodeBulgePathOptions {
  /** Whether the path has a closing segment from the last to the first vertex. */
  closed: boolean
  /** Elevation of the path plane along `normal`. */
  elevation: number
  /** Plane normal (extrusion direction) of the path. */
  normal: AcGeVector3dLike
  /** Thickness copied to every generated line / arc. Defaults to `0`. */
  thickness?: number
}

/**
 * Breaks a planar bulge path (the geometry of LWPOLYLINE and 2D POLYLINE) into
 * one {@link AcDbLine} or {@link AcDbArc} per segment, the way AutoCAD
 * EXPLODE does. Segment widths are not represented: AutoCAD discards them as
 * well.
 *
 * Zero-length segments are skipped. The generated entities are in WCS, share
 * the plane normal of the path and carry no entity properties; callers copy
 * those with {@link AcDbEntity.setPropertiesFrom}.
 *
 * @param vertices - Path vertices in OCS.
 * @param options - Plane and closure of the path.
 * @returns The generated lines and arcs, in path order.
 */
export function acdbExplodeBulgePath(
  vertices: readonly AcDbBulgePathVertex[],
  options: AcDbExplodeBulgePathOptions
): AcDbCurve[] {
  const count = vertices.length
  if (count < 2) return []

  const { closed, elevation, normal } = options
  const thickness = options.thickness ?? 0
  const toWcs = (x: number, y: number) =>
    acgeTransformOcsPointToWcs({ x, y, z: elevation }, normal)

  const result: AcDbCurve[] = []
  const segmentCount = closed ? count : count - 1
  for (let i = 0; i < segmentCount; i++) {
    const p0 = vertices[i]
    const p1 = vertices[(i + 1) % count]
    const dx = p1.x - p0.x
    const dy = p1.y - p0.y
    const chord = Math.hypot(dx, dy)
    if (chord <= SEGMENT_EPSILON) continue

    const bulge = p0.bulge ?? 0
    if (Math.abs(bulge) <= BULGE_EPSILON) {
      const line = new AcDbLine(toWcs(p0.x, p0.y), toWcs(p1.x, p1.y))
      if (thickness !== 0) {
        line.thickness = thickness
        line.normal = normal
      }
      result.push(line)
      continue
    }

    // Signed distance from the chord midpoint to the arc center, measured
    // along the left normal of the chord: (c / 2) * (1 - b²) / (2b). A
    // positive bulge (counter-clockwise arc) puts the center on the left.
    const offset = (chord / 2) * ((1 - bulge * bulge) / (2 * bulge))
    const cx = (p0.x + p1.x) / 2 - (dy / chord) * offset
    const cy = (p0.y + p1.y) / 2 + (dx / chord) * offset
    const radius = Math.hypot(p0.x - cx, p0.y - cy)
    const angle0 = Math.atan2(p0.y - cy, p0.x - cx)
    const angle1 = Math.atan2(p1.y - cy, p1.x - cx)
    // AcDbArc always runs counter-clockwise about its normal, so a clockwise
    // (negative bulge) segment is stored from its end vertex to its start.
    const [startAngle, endAngle] =
      bulge > 0 ? [angle0, angle1] : [angle1, angle0]
    const arc = new AcDbArc(toWcs(cx, cy), radius, startAngle, endAngle, normal)
    if (thickness !== 0) arc.thickness = thickness
    result.push(arc)
  }
  return result
}

/**
 * Breaks a 3D vertex path into one {@link AcDbLine} per non-degenerate
 * segment, the way AutoCAD EXPLODE handles 3D polylines.
 *
 * @param points - Path vertices in WCS.
 * @param closed - Whether the path has a closing segment.
 * @returns The generated lines, in path order.
 */
export function acdbExplodePointPath(
  points: readonly AcGePoint3dLike[],
  closed: boolean
): AcDbLine[] {
  const count = points.length
  if (count < 2) return []
  const result: AcDbLine[] = []
  const segmentCount = closed ? count : count - 1
  for (let i = 0; i < segmentCount; i++) {
    const p0 = points[i]
    const p1 = points[(i + 1) % count]
    const length = Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z)
    if (length <= SEGMENT_EPSILON) continue
    result.push(new AcDbLine(new AcGePoint3d(p0), new AcGePoint3d(p1)))
  }
  return result
}

/**
 * Returns the two in-plane axes (OCS X and Y) of the plane with `normal`,
 * following the AutoCAD arbitrary axis algorithm.
 *
 * @param normal - Plane normal.
 * @returns The OCS X and Y axes as unit vectors.
 */
export function acdbGetOcsAxes(normal: AcGeVector3dLike): {
  xAxis: AcGeVector3d
  yAxis: AcGeVector3d
} {
  const n = new AcGeVector3d(normal.x, normal.y, normal.z).normalize()
  const xAxis = acgeGetOcsReferenceVector(n)
  const yAxis = new AcGeVector3d().crossVectors(n, xAxis).normalize()
  return { xAxis, yAxis }
}

/** MTEXT formatting codes that take no argument. */
const MTEXT_FLAG_CODES = 'LlOoKk'

/**
 * Converts MTEXT contents into plain-text paragraphs, the text that remains
 * when AutoCAD EXPLODE turns multiline text into single-line text.
 *
 * Paragraph breaks (`\P`) and column breaks (`\N`) start a new paragraph,
 * formatting codes (`\F`, `\H`, `\C`, `\L`, ...) and grouping braces are
 * dropped, escaped characters (`\\`, `\{`, `\}`), non-breaking spaces
 * (`\~`) and Unicode escapes (`\U+XXXX`) are decoded, and stacked fractions
 * (`\S1^2;`) are written inline as `1/2`.
 *
 * @param contents - Raw MTEXT contents.
 * @returns The plain-text paragraphs, in order.
 */
export function acdbMTextToPlainParagraphs(contents: string): string[] {
  let out = ''
  let i = 0
  const n = contents.length
  const skipToSemicolon = (from: number) => {
    const end = contents.indexOf(';', from)
    return end < 0 ? n : end + 1
  }
  while (i < n) {
    const c = contents[i]
    if (c === '{' || c === '}') {
      i++
      continue
    }
    if (c !== '\\' || i + 1 >= n) {
      out += c
      i++
      continue
    }
    const code = contents[i + 1]
    if (code === 'P' || code === 'N') {
      out += '\n'
      i += 2
    } else if (code === '~') {
      out += ' '
      i += 2
    } else if (code === '\\' || code === '{' || code === '}') {
      out += code
      i += 2
    } else if (MTEXT_FLAG_CODES.includes(code)) {
      i += 2
    } else if (
      (code === 'U' || code === 'u') &&
      contents[i + 2] === '+' &&
      /^[0-9a-fA-F]{4}/.test(contents.slice(i + 3, i + 7))
    ) {
      out += String.fromCharCode(parseInt(contents.slice(i + 3, i + 7), 16))
      i += 7
    } else if (code === 'S') {
      const end = skipToSemicolon(i + 2)
      const stacked = contents.slice(
        i + 2,
        contents[end - 1] === ';' ? end - 1 : end
      )
      out += stacked.replace(/[\^#]/g, '/')
      i = end
    } else if (/[A-Za-z]/.test(code)) {
      i = skipToSemicolon(i + 2)
    } else {
      out += code
      i += 2
    }
  }
  return out.split(/\r\n|\r|\n/g)
}

/**
 * Estimates the advance width of one character for line wrapping.
 *
 * Full-width (CJK) characters are about as wide as the text height, other
 * characters are estimated at 0.6 × height, slightly narrow on purpose so
 * that estimated wrapping does not break lines AutoCAD keeps whole.
 */
function estimateCharWidth(ch: string, height: number): number {
  const code = ch.codePointAt(0) ?? 0
  return code >= 0x2e80 ? height : height * 0.6
}

/**
 * Wraps one plain-text paragraph to the given width, breaking at spaces (or
 * anywhere between full-width characters), the way MTEXT word wrap lays out
 * a paragraph. Character widths are estimated, so the line breaks
 * approximate the ones AutoCAD computes from the actual font.
 *
 * @param paragraph - Plain-text paragraph.
 * @param width - Wrapping width; `0` or less disables wrapping.
 * @param height - Text height.
 * @returns The wrapped lines (at least one, possibly empty).
 */
export function acdbWrapPlainParagraph(
  paragraph: string,
  width: number,
  height: number
): string[] {
  if (!(width > 0) || !(height > 0)) return [paragraph]
  // Tokens: runs of non-space latin characters, single full-width chars and
  // single spaces.
  const tokens = paragraph.match(/[⺀-￿]|\s|[^\s⺀-￿]+/g)
  if (!tokens) return [paragraph]

  const lines: string[] = []
  let line = ''
  let lineWidth = 0
  const measure = (text: string) => {
    let w = 0
    for (const ch of text) w += estimateCharWidth(ch, height)
    return w
  }
  for (const token of tokens) {
    const tokenWidth = measure(token)
    if (/^\s$/.test(token)) {
      if (line) {
        line += token
        lineWidth += tokenWidth
      }
      continue
    }
    if (line && lineWidth + tokenWidth > width) {
      lines.push(line.trimEnd())
      line = ''
      lineWidth = 0
    }
    line += token
    lineWidth += tokenWidth
  }
  lines.push(line.trimEnd())
  return lines
}
