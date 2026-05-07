import { HATCH_PATTERN_SOLID } from '../AcDbConstants'
import type {
  AcDbPatLine,
  AcDbPatPattern,
  AcDbPatPreviewOptions
} from './AcDbPatDefinition'

/**
 * A concrete drawable segment used as an intermediate representation before
 * serializing linework into SVG path commands.
 */
interface AcDbPatSvgSegment {
  /** Segment start X coordinate in renderer space. */
  x1: number
  /** Segment start Y coordinate in renderer space. */
  y1: number
  /** Segment end X coordinate in renderer space. */
  x2: number
  /** Segment end Y coordinate in renderer space. */
  y2: number
}

/**
 * Renders an {@link AcDbPatPattern} into a standalone SVG preview string.
 *
 * The renderer normalizes pattern units to pixels, expands each hatch line
 * family to cover the viewport, resolves dash/gap sequences into explicit
 * segments, and emits a compact `<svg>` document.
 */
export class AcDbPatSvgRenderer {
  /** Numerical tolerance used to avoid division-by-zero and near-zero noise. */
  private static readonly EPSILON = 1e-9

  /**
   * Converts an angle from degrees to radians.
   *
   * @param degrees - Angle in degrees.
   * @returns The same angle expressed in radians.
   */
  private static toRadians(degrees: number) {
    return (degrees * Math.PI) / 180
  }

  /**
   * Clamps a value into an inclusive range.
   *
   * @param value - Source value.
   * @param min - Lower bound (inclusive).
   * @param max - Upper bound (inclusive).
   * @returns `value` projected into `[min, max]`.
   */
  private static clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value))
  }

  /**
   * Checks whether a pattern is the reserved AutoCAD solid-fill pattern.
   *
   * `SOLID` has no PAT line descriptors; its preview is an area fill instead
   * of generated hatch linework.
   *
   * @param pattern - Pattern to inspect.
   * @returns `true` when the pattern name resolves to `SOLID`.
   */
  private static isSolidPattern(pattern: AcDbPatPattern) {
    return pattern.name.trim().toUpperCase() === HATCH_PATTERN_SOLID
  }

  /**
   * Renders an SVG background rectangle.
   *
   * @param width - SVG viewport width in pixels.
   * @param height - SVG viewport height in pixels.
   * @param background - CSS fill for the preview background.
   * @returns SVG `<rect>` markup.
   */
  private static renderBackground(
    width: number,
    height: number,
    background: string
  ) {
    return `<rect x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}" fill="${background}" />`
  }

  /**
   * Estimates a representative unit length for the pattern.
   *
   * The current strategy samples delta vectors and dash lengths, removes
   * near-zero values, and uses the median as a robust scale anchor.
   *
   * @param pattern - Pattern whose geometric magnitudes are sampled.
   * @returns Estimated pattern unit size. Falls back to `1` if no usable
   * samples exist.
   */
  private static estimateUnitScale(pattern: AcDbPatPattern) {
    const samples: number[] = []
    for (const line of pattern.lines) {
      samples.push(Math.abs(line.deltaX), Math.abs(line.deltaY))
      for (const dash of line.dashes) {
        samples.push(Math.abs(dash))
      }
    }
    const filtered = samples.filter(
      sample => sample > AcDbPatSvgRenderer.EPSILON
    )
    if (filtered.length === 0) return 1
    const sorted = filtered.sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)] || 1
  }

  /**
   * Converts a geometric segment into a single SVG `M ... L ...` path command.
   *
   * SVG Y coordinates are inverted to match the pattern coordinate convention.
   *
   * @param segment - Segment to serialize.
   * @returns SVG path fragment for the segment.
   */
  private static segmentToSvgPath(segment: AcDbPatSvgSegment) {
    return `M ${segment.x1.toFixed(2)} ${(-segment.y1).toFixed(2)} L ${segment.x2.toFixed(2)} ${(-segment.y2).toFixed(2)}`
  }

  /**
   * Expands a hatch line and its dash definition into concrete drawable
   * segments within a finite interval.
   *
   * Dash rule:
   * - `> 0`: drawn segment
   * - `< 0`: gap
   * - `= 0`: dot (rendered as a very short segment for visibility)
   *
   * @param line - Hatch line definition containing dash sequence.
   * @param startAlong - Interval start on the line direction axis.
   * @param endAlong - Interval end on the line direction axis.
   * @param originX - Line family origin X coordinate.
   * @param originY - Line family origin Y coordinate.
   * @param dirX - Unit direction vector X component.
   * @param dirY - Unit direction vector Y component.
   * @returns Drawable segments clipped to `[startAlong, endAlong]`.
   */
  private static buildDashSegments(
    line: AcDbPatLine,
    startAlong: number,
    endAlong: number,
    originX: number,
    originY: number,
    dirX: number,
    dirY: number
  ) {
    const dashes = line.dashes
    if (dashes.length === 0) {
      return [
        {
          x1: originX + dirX * startAlong,
          y1: originY + dirY * startAlong,
          x2: originX + dirX * endAlong,
          y2: originY + dirY * endAlong
        }
      ]
    }

    const totalPatternLength = dashes.reduce(
      (sum, value) => sum + Math.abs(value),
      0
    )
    if (totalPatternLength <= AcDbPatSvgRenderer.EPSILON) {
      return [
        {
          x1: originX + dirX * startAlong,
          y1: originY + dirY * startAlong,
          x2: originX + dirX * endAlong,
          y2: originY + dirY * endAlong
        }
      ]
    }

    const segments: AcDbPatSvgSegment[] = []
    const tileCount =
      Math.ceil((endAlong - startAlong) / totalPatternLength) + 2
    let tileStart = startAlong - totalPatternLength

    for (let tileIndex = 0; tileIndex < tileCount; tileIndex++) {
      let cursor = tileStart
      for (const dashValue of dashes) {
        const length = Math.abs(dashValue)
        const nextCursor = cursor + length
        if (dashValue > 0 || dashValue === 0) {
          const drawStart = AcDbPatSvgRenderer.clamp(
            cursor,
            startAlong,
            endAlong
          )
          const drawEnd = AcDbPatSvgRenderer.clamp(
            nextCursor,
            startAlong,
            endAlong
          )
          if (drawEnd > drawStart) {
            segments.push({
              x1: originX + dirX * drawStart,
              y1: originY + dirY * drawStart,
              x2: originX + dirX * drawEnd,
              y2: originY + dirY * drawEnd
            })
          } else if (
            dashValue === 0 &&
            drawStart >= startAlong &&
            drawStart <= endAlong
          ) {
            const dotHalf = 0.35
            segments.push({
              x1: originX + dirX * (drawStart - dotHalf),
              y1: originY + dirY * (drawStart - dotHalf),
              x2: originX + dirX * (drawStart + dotHalf),
              y2: originY + dirY * (drawStart + dotHalf)
            })
          }
        }
        cursor = nextCursor
      }
      tileStart += totalPatternLength
    }

    return segments
  }

  /**
   * Renders one hatch line family (parallel repetitions of the same line rule)
   * into a single SVG `<path>` element.
   *
   * @param line - Hatch line rule to expand.
   * @param maxRadius - Coverage radius used to decide repetition count and
   * drawable extent.
   * @returns SVG `<path>` markup containing all generated segments.
   */
  private static renderFamily(line: AcDbPatLine, maxRadius: number) {
    const angle = AcDbPatSvgRenderer.toRadians(line.angle)
    const dirX = Math.cos(angle)
    const dirY = Math.sin(angle)
    const normalX = -dirY
    const normalY = dirX

    const offsetX = dirX * line.deltaX + normalX * line.deltaY
    const offsetY = dirY * line.deltaX + normalY * line.deltaY
    const offsetLength = Math.hypot(offsetX, offsetY)

    const familyCount =
      offsetLength <= AcDbPatSvgRenderer.EPSILON
        ? 1
        : Math.max(1, Math.ceil((maxRadius * 2) / offsetLength) + 1)
    const half = Math.floor(familyCount / 2)
    const minAlong = -maxRadius * 1.5
    const maxAlong = maxRadius * 1.5
    const paths: string[] = []

    for (let index = -half; index <= half; index++) {
      const familyOriginX = line.originX + offsetX * index
      const familyOriginY = line.originY + offsetY * index
      const segments = AcDbPatSvgRenderer.buildDashSegments(
        line,
        minAlong,
        maxAlong,
        familyOriginX,
        familyOriginY,
        dirX,
        dirY
      )

      for (const segment of segments) {
        paths.push(AcDbPatSvgRenderer.segmentToSvgPath(segment))
      }
    }

    return `<path d="${paths.join(' ')}" fill="none" />`
  }

  /**
   * Renders a PAT pattern preview as a complete SVG document string.
   *
   * The method applies option defaults, computes an automatic unit-to-pixel
   * scale, transforms the pattern to screen space, and combines all line
   * families into one grouped stroke layer over a background rectangle.
   *
   * @param pattern - Pattern definition to render.
   * @param options - Optional preview style and size settings.
   * @returns Standalone SVG markup that can be injected directly into DOM or
   * saved as a `.svg` asset.
   */
  renderPattern(pattern: AcDbPatPattern, options: AcDbPatPreviewOptions = {}) {
    const width = options.width ?? 260
    const height = options.height ?? 160
    const stroke = options.stroke ?? '#1f2937'
    const strokeWidth = options.strokeWidth ?? 1.3
    const background = options.background ?? '#ffffff'
    const viewBox = `${-width / 2} ${-height / 2} ${width} ${height}`

    if (AcDbPatSvgRenderer.isSolidPattern(pattern)) {
      return [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}">`,
        AcDbPatSvgRenderer.renderBackground(width, height, background),
        `<rect x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}" fill="${stroke}" />`,
        '</svg>'
      ].join('')
    }

    const scaleUnit = AcDbPatSvgRenderer.estimateUnitScale(pattern)
    const baseScale = Math.min(width, height) * 0.18
    const unitToPixel =
      baseScale / Math.max(scaleUnit, AcDbPatSvgRenderer.EPSILON)

    const scaledPattern: AcDbPatPattern = {
      ...pattern,
      lines: pattern.lines.map(line => ({
        ...line,
        originX: line.originX * unitToPixel,
        originY: line.originY * unitToPixel,
        deltaX: line.deltaX * unitToPixel,
        deltaY: line.deltaY * unitToPixel,
        dashes: line.dashes.map(dash => dash * unitToPixel)
      }))
    }

    const maxRadius = Math.hypot(width, height) * 0.75
    const content = scaledPattern.lines
      .map(line => AcDbPatSvgRenderer.renderFamily(line, maxRadius))
      .join('')

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}">`,
      AcDbPatSvgRenderer.renderBackground(width, height, background),
      `<g stroke="${stroke}" stroke-width="${strokeWidth.toFixed(2)}" stroke-linecap="round">`,
      content,
      '</g>',
      '</svg>'
    ].join('')
  }
}
