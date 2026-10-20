import { defaults } from '@mlightcad/common'
import {
  AcGiBaseLineStyle,
  AcGiLineTypePatternElement
} from '@mlightcad/graphic-interface'

import { AcDbDxfFiler } from '../base/AcDbDxfFiler'
import {
  AcDbSymbolTableRecord,
  AcDbSymbolTableRecordAttrs
} from './AcDbSymbolTableRecord'

export interface AcDbLinetypePreviewSvgOptions {
  /**
   * Width of preview SVG.
   * @default 220
   */
  width?: number
  /**
   * Height of preview SVG.
   * @default 36
   */
  height?: number
  /**
   * Left/right horizontal padding in pixels.
   * @default 8
   */
  padding?: number
  /**
   * Stroke width in pixels.
   * @default 2
   */
  strokeWidth?: number
  /**
   * Stroke color.
   * @default 'currentColor'
   */
  stroke?: string
  /**
   * Fill color for embedded text. Defaults to {@link stroke}.
   */
  textFill?: string
  /**
   * Font family for embedded text.
   * @default 'sans-serif'
   */
  fontFamily?: string
  /**
   * How many pattern cycles to display in preview width.
   * @default 4
   */
  repeats?: number
}

/** DXF group 74 bit: absolute rotation (else relative to line tangent). */
const COMPLEX_LTYPE_ABSOLUTE_ROTATION = 1
/** DXF group 74 bit: embedded text. */
const COMPLEX_LTYPE_TEXT = 2
/** DXF group 74 bit: embedded shape. */
const COMPLEX_LTYPE_SHAPE = 4

/**
 * Interface defining the attributes for linetype table records.
 *
 * Merges {@link AcDbSymbolTableRecordAttrs} with {@link AcGiBaseLineStyle} fields
 * (excluding the duplicate `name` property).
 */
export interface AcDbLinetypeTableRecordAttrs
  extends AcDbSymbolTableRecordAttrs,
    Omit<AcGiBaseLineStyle, 'name'> {}

/**
 * Represents a record in the line type table within the AutoCAD drawing database.
 *
 * Each line type table record contains the information necessary to define a specific line type,
 * including its pattern, description, and rendering characteristics. Line types define how lines
 * are drawn, including patterns of dashes, dots, and spaces.
 *
 * Within the line type table record, the dashes (line segments that make up characteristics of the
 * linetype) are stored in a list with an index that is zero based. If the linetype is complex, then
 * embedded shapes or text strings are stored in the list at the same index as the dash that preceded
 * them in the linetype definition. So there will always be a dashLength for any valid index in the
 * list, even if there is a shape or text string sharing the same index. When the linetype is elaborated,
 * a shape's insertion point will coincide with the end of the dash that it shares an index with.
 */
export class AcDbLinetypeTableRecord extends AcDbSymbolTableRecord<AcDbLinetypeTableRecordAttrs> {
  /**
   * Creates a new line type table record.
   *
   * @param attrs - Input attribute values for this linetype table record
   * @param defaultAttrs - Default values for attributes of this linetype table record
   *
   * @example
   * ```typescript
   * const record = new AcDbLinetypeTableRecord({
   *   name: 'DASHED',
   *   description: 'Dashed',
   *   totalPatternLength: 1,
   *   pattern: [{ elementLength: 0.5, elementTypeFlag: 0 }]
   * });
   * ```
   */
  constructor(
    attrs?: Partial<AcDbLinetypeTableRecordAttrs>,
    defaultAttrs?: Partial<AcDbLinetypeTableRecordAttrs>
  ) {
    attrs = attrs || {}
    defaults(attrs, {
      standardFlag: 0,
      description: '',
      totalPatternLength: 0
    })
    super(attrs, defaultAttrs)
  }

  /**
   * Gets the number of dash elements in the line type pattern.
   *
   * This value represents the total count of dashes, spaces, dots, and other pattern elements
   * that make up the line type. It corresponds to DXF group code 73 in the AutoCAD file format.
   *
   * @returns The number of pattern elements in the line type
   */
  get numDashes() {
    const pattern = this.getAttrWithoutException('pattern')
    return pattern ? pattern.length : 0
  }

  /**
   * Gets the total pattern length in AutoCAD drawing units.
   *
   * The pattern length represents the total length of all dashes and spaces when the line type
   * scale is 1.0. This value is used to calculate how the pattern repeats along a line.
   *
   * Note: Embedded shapes or text strings do not add to the pattern length because they are
   * overlaid and do not interrupt the actual dash pattern.
   *
   * @returns The total length of the line type pattern in drawing units
   */
  get patternLength() {
    return this.getAttr('totalPatternLength')
  }

  /**
   * Gets the description or comments associated with this line type.
   *
   * This property provides additional information about the line type, such as its intended
   * use or any special characteristics.
   *
   * @returns The description text for the line type
   */
  get comments() {
    return this.getAttr('description')
  }

  /**
   * Gets the line type style object used by the renderer.
   *
   * Returns a snapshot assembled from stored attributes. Mutating the returned object
   * does not update this table record; use the dedicated setters instead.
   *
   * @returns The line type style object assembled from stored attributes
   */
  get linetype(): AcGiBaseLineStyle {
    return {
      name: this.name,
      standardFlag: this.getAttr('standardFlag'),
      description: this.getAttr('description'),
      totalPatternLength: this.getAttr('totalPatternLength'),
      pattern: this.getAttrWithoutException('pattern')
    }
  }

  /**
   * Gets the length of a specific dash element in the line type pattern.
   *
   * Each dash element in the pattern has a specific length that determines how it appears
   * when the line type is rendered. Positive values represent visible dashes, while negative
   * values represent spaces (pen up).
   *
   * @param index - Zero-based index of the dash element. Must be greater than or equal to zero,
   *                but less than the value of property 'numDashes'
   * @returns The length of the specified dash element in drawing units
   * @throws {Error} When the index is out of range
   */
  dashLengthAt(index: number) {
    if (index < 0 || index >= this.numDashes) {
      throw new Error(
        'Index must be greater than or equal to zero, but less than the value of property "numDashes".'
      )
    }
    return this.getAttr('pattern')![index].elementLength
  }

  /**
   * Converts this linetype preview to an SVG string.
   *
   * The preview is rendered as a horizontal line centered in the SVG viewport.
   * Positive pattern elements are drawn as visible strokes, negative elements
   * are treated as gaps, and zero-length elements are rendered as dots.
   * Embedded TEXT elements (DXF group 74 bit 2) are drawn as SVG `<text>`
   * glyphs centered in their pen-up slot (including adjacent simple gaps).
   * Text slots are widened when needed so labels stay readable and do not
   * collide with neighboring dashes.
   *
   * @param options - Preview rendering options
   * @returns SVG string for linetype preview
   */
  toPreviewSvgString(options?: AcDbLinetypePreviewSvgOptions) {
    const width = Math.max(options?.width ?? 220, 1)
    const height = Math.max(options?.height ?? 36, 1)
    const padding = Math.min(
      Math.max(options?.padding ?? 8, 0),
      Math.floor(width / 2)
    )
    const strokeWidth = Math.max(options?.strokeWidth ?? 2, 0.5)
    const strokeRaw = options?.stroke ?? 'currentColor'
    const stroke = this.escapeSvgAttribute(strokeRaw)
    // Escape from the raw default so textFill is not double-escaped when it
    // inherits a stroke value that already needed entity encoding.
    const textFill = this.escapeSvgAttribute(options?.textFill ?? strokeRaw)
    const fontFamily = this.escapeSvgAttribute(
      options?.fontFamily ?? 'sans-serif'
    )
    const y = height / 2
    const startX = padding
    const endX = Math.max(width - padding, startX + 1)
    const previewWidth = endX - startX
    const pattern = this.getAttrWithoutException('pattern') ?? []

    if (
      pattern.length === 0 ||
      this.patternLength <= 0 ||
      !pattern.some(
        (item: AcGiLineTypePatternElement) => item.elementLength !== 0
      )
    ) {
      return this.buildSvgString({
        width,
        height,
        stroke,
        strokeWidth,
        textFill,
        fontFamily,
        lineSegments: [[startX, endX]],
        dots: [],
        texts: [],
        y
      })
    }

    const hasText = pattern.some(
      (item: AcGiLineTypePatternElement) =>
        this.isComplexPatternElement(item) &&
        (item.elementTypeFlag & COMPLEX_LTYPE_TEXT) !== 0
    )
    // Text linetypes need fewer cycles so labels stay legible in a narrow strip.
    const repeats = Math.max(
      options?.repeats ?? (hasText ? 2 : 4),
      1
    )
    const fontSize = hasText
      ? Math.min(Math.max(height * 0.55, Math.min(8, height * 0.85)), height * 0.8)
      : 0
    const textPadPx = Math.max(strokeWidth * 2, 4)
    const segments = this.buildPreviewSegments(pattern, fontSize, textPadPx)
    const baseUnitToPx = previewWidth / (this.patternLength * repeats)
    const minSegmentPx = 0.5
    const dotStep = Math.max(strokeWidth * 2, 2)

    const rawLengths = segments.map(seg => {
      if (seg.kind === 'dot') return dotStep
      if (seg.kind === 'text') {
        return Math.max(seg.units * baseUnitToPx, seg.minPx)
      }
      return Math.max(seg.units * baseUnitToPx, seg.kind === 'dash' ? minSegmentPx : 0)
    })
    const rawCyclePx = rawLengths.reduce((sum, len) => sum + len, 0)
    const fit =
      rawCyclePx > 0 ? previewWidth / (rawCyclePx * repeats) : 1
    const segLengths = rawLengths.map(len => len * fit)

    const lineSegments: Array<[number, number]> = []
    const dots: number[] = []
    const texts: Array<{
      x: number
      y: number
      text: string
      fontSize: number
      rotationDeg: number
    }> = []
    let currentX = startX

    while (currentX < endX - 1e-6) {
      for (let i = 0; i < segments.length; i++) {
        if (currentX >= endX) break
        const seg = segments[i]
        const segPx = segLengths[i]
        const nextX = Math.min(currentX + segPx, endX)

        if (seg.kind === 'dash' && nextX > currentX) {
          lineSegments.push([currentX, nextX])
        } else if (seg.kind === 'dot') {
          dots.push(currentX)
        } else if (seg.kind === 'text' && seg.label.trim().length > 0) {
          const midX = (currentX + nextX) * 0.5
          texts.push({
            x: midX,
            y,
            text: seg.label,
            fontSize: Math.min(seg.fontSize * fit, height * 0.8),
            rotationDeg: seg.rotationDeg
          })
        }

        currentX = nextX
      }
      // Avoid a tight infinite loop on zero-length cycles.
      if (rawCyclePx <= 0) break
    }

    return this.buildSvgString({
      width,
      height,
      stroke,
      strokeWidth,
      textFill,
      fontFamily,
      lineSegments,
      dots,
      texts,
      y
    })
  }

  /**
   * Builds a flattened preview segment list. Adjacent simple gaps around an
   * embedded TEXT element are merged into one text slot so the label sits in
   * the full pen-up region between dashes (AutoCAD-style).
   */
  private buildPreviewSegments(
    pattern: AcGiLineTypePatternElement[],
    fontSize: number,
    textPadPx: number
  ): Array<
    | { kind: 'dash'; units: number }
    | { kind: 'gap'; units: number }
    | { kind: 'dot' }
    | {
        kind: 'text'
        units: number
        minPx: number
        label: string
        fontSize: number
        rotationDeg: number
      }
  > {
    const segments: Array<
      | { kind: 'dash'; units: number }
      | { kind: 'gap'; units: number }
      | { kind: 'dot' }
      | {
          kind: 'text'
          units: number
          minPx: number
          label: string
          fontSize: number
          rotationDeg: number
        }
    > = []
    const absorbed = new Set<number>()

    for (let index = 0; index < pattern.length; index++) {
      if (absorbed.has(index)) continue
      const item = pattern[index]

      if (this.isComplexPatternElement(item)) {
        // Fold trailing simple gaps already emitted back into this text slot.
        let beforeUnits = 0
        while (segments.length > 0 && segments[segments.length - 1].kind === 'gap') {
          const prev = segments.pop() as { kind: 'gap'; units: number }
          beforeUnits += prev.units
        }

        let slotUnits = beforeUnits + Math.abs(item.elementLength)
        for (let j = index + 1; j < pattern.length; j++) {
          const next = pattern[j]
          if (this.isComplexPatternElement(next)) break
          if (next.elementLength >= 0) break
          slotUnits += Math.abs(next.elementLength)
          absorbed.add(j)
        }

        const isText =
          (item.elementTypeFlag & COMPLEX_LTYPE_TEXT) !== 0
        const label = isText ? this.resolveEmbeddedText(item.text) : ''
        if (isText && label.trim().length > 0) {
          const minPx =
            this.estimateTextWidthPx(label, fontSize) + textPadPx
          segments.push({
            kind: 'text',
            units: Math.max(slotUnits, 1e-6),
            minPx,
            label,
            fontSize,
            rotationDeg: this.previewTextRotationDeg(item)
          })
        } else if (slotUnits > 0) {
          segments.push({ kind: 'gap', units: slotUnits })
        }
        continue
      }

      if (item.elementLength === 0) {
        segments.push({ kind: 'dot' })
      } else if (item.elementLength > 0) {
        segments.push({ kind: 'dash', units: item.elementLength })
      } else {
        segments.push({ kind: 'gap', units: Math.abs(item.elementLength) })
      }
    }

    return segments
  }

  /**
   * Approximate advance width for preview layout (sans-serif metrics).
   */
  private estimateTextWidthPx(text: string, fontSize: number) {
    let units = 0
    for (const ch of text) {
      // Digits / caps are wider; spaces and punctuation are narrower.
      if (ch === ' ') units += 0.33
      else if (/[iIlj1.'|]/.test(ch)) units += 0.35
      else if (/[mwMW@%]/.test(ch)) units += 0.85
      else units += 0.62
    }
    return Math.max(units * fontSize, fontSize * 0.5)
  }

  /**
   * True when a pattern element is a real embedded TEXT or SHAPE (same rules
   * as cad-viewer's {@code isComplexPatternElement}).
   */
  private isComplexPatternElement(element: AcGiLineTypePatternElement): boolean {
    const flag = element.elementTypeFlag ?? 0
    if ((flag & COMPLEX_LTYPE_TEXT) !== 0) {
      return (element.text ?? '').length > 0
    }
    if ((flag & COMPLEX_LTYPE_SHAPE) !== 0) {
      return element.shapeNumber != null && element.shapeNumber !== 0
    }
    return false
  }

  /**
   * Resolves the label for an embedded TEXT dash. Non-blank {@code text} wins;
   * otherwise falls back to the linetype description prefix (LibreDWG may store
   * a single space when the real label lives in the description).
   * AutoCAD `%%` escapes (e.g. `%%34` → `"`, `%%c`/`%%d`/`%%p`) are decoded.
   */
  private resolveEmbeddedText(elementText: string | undefined) {
    const raw = elementText ?? ''
    if (raw.trim().length > 0) {
      return this.decodeAutoCadTextEscapes(raw)
    }
    const desc = (this.comments ?? '').trim()
    if (!desc) {
      return this.decodeAutoCadTextEscapes(raw)
    }
    // e.g. `6" VCP C700  - 6" VCP C700 - 6" V`
    const first = desc.split(/\s+-\s+/)[0]?.trim()
    if (first && first !== desc) {
      return this.decodeAutoCadTextEscapes(first)
    }
    // e.g. `Gas line ----GAS----GAS----`
    const fromDashes = desc.match(/-{2,}\s*([^-]+?)\s*-{2,}/)
    if (fromDashes?.[1]?.trim()) {
      return this.decodeAutoCadTextEscapes(fromDashes[1].trim())
    }
    // Prefer the short table name over a long free-form description.
    const name = (this.name ?? '').trim()
    if (name && desc.length > name.length + 2) {
      return this.decodeAutoCadTextEscapes(name)
    }
    return this.decodeAutoCadTextEscapes(first || raw)
  }

  /**
   * Decodes AutoCAD TEXT/MTEXT `%%` special-character codes used in complex
   * linetype labels.
   *
   * - `%%c` / `%%C` → diameter Ø
   * - `%%d` / `%%D` → degree °
   * - `%%p` / `%%P` → plus/minus ±
   * - `%%nnn` → Latin-1 / ASCII character with code `nnn` (e.g. `%%34` → `"`)
   * - `%%%%` → literal `%`
   */
  private decodeAutoCadTextEscapes(value: string) {
    return value.replace(/%%(\d{1,3}|[cCdDpP%])/g, (_match, code: string) => {
      if (code === '%') return '%'
      if (code === 'c' || code === 'C') return 'Ø'
      if (code === 'd' || code === 'D') return '°'
      if (code === 'p' || code === 'P') return '±'
      const n = Number.parseInt(code, 10)
      if (Number.isFinite(n) && n >= 0 && n <= 255) {
        return String.fromCharCode(n)
      }
      return `%%${code}`
    })
  }

  /**
   * Rotation in degrees for a horizontal preview. Relative rotation uses
   * upright (AutoCAD U) behaviour so labels stay readable.
   */
  private previewTextRotationDeg(element: AcGiLineTypePatternElement) {
    const rotation = element.rotation ?? 0
    const flag = element.elementTypeFlag ?? 0
    let angle =
      (flag & COMPLEX_LTYPE_ABSOLUTE_ROTATION) !== 0
        ? rotation
        : this.uprightLinetypeAngle(rotation)
    return (angle * 180) / Math.PI
  }

  /**
   * Keeps relative linetype text readable: flip 180° when it would be upside-down.
   */
  private uprightLinetypeAngle(angle: number) {
    const twoPi = Math.PI * 2
    let a = ((angle + Math.PI) % twoPi + twoPi) % twoPi - Math.PI
    if (a > Math.PI / 2 || a < -Math.PI / 2) {
      a += Math.PI
      if (a > Math.PI) {
        a -= twoPi
      }
    }
    return a
  }

  private buildSvgString(input: {
    width: number
    height: number
    stroke: string
    strokeWidth: number
    textFill: string
    fontFamily: string
    lineSegments: Array<[number, number]>
    dots: number[]
    texts: Array<{
      x: number
      y: number
      text: string
      fontSize: number
      rotationDeg: number
    }>
    y: number
  }) {
    const {
      width,
      height,
      stroke,
      strokeWidth,
      textFill,
      fontFamily,
      lineSegments,
      dots,
      texts,
      y
    } = input
    const lines = lineSegments
      .map(
        ([x1, x2]) =>
          `<line x1="${x1.toFixed(2)}" y1="${y.toFixed(2)}" x2="${x2.toFixed(
            2
          )}" y2="${y.toFixed(2)}" stroke="${stroke}" stroke-width="${strokeWidth.toFixed(
            2
          )}" stroke-linecap="round" />`
      )
      .join('')
    const circles = dots
      .map(
        x =>
          `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(
            2
          )}" r="${(strokeWidth / 2).toFixed(2)}" fill="${stroke}" />`
      )
      .join('')
    const textNodes = texts
      .map(item => {
        const transform =
          Math.abs(item.rotationDeg) > 1e-6
            ? ` transform="rotate(${item.rotationDeg.toFixed(2)} ${item.x.toFixed(
                2
              )} ${item.y.toFixed(2)})"`
            : ''
        return `<text x="${item.x.toFixed(2)}" y="${item.y.toFixed(
          2
        )}" fill="${textFill}" font-family="${fontFamily}" font-size="${item.fontSize.toFixed(
          2
        )}" text-anchor="middle" dominant-baseline="middle"${transform}>${this.escapeSvgText(
          item.text
        )}</text>`
      })
      .join('')

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${this.escapeSvgAttribute(this.name)} linetype preview">${lines}${circles}${textNodes}</svg>`
  }

  private escapeSvgAttribute(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, '&#39;')
  }

  private escapeSvgText(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  /**
   * Writes DXF fields for this object.
   *
   * @param filer - DXF output writer.
   * @returns The instance (for chaining).
   */
  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbLinetypeTableRecord')
    filer.writeString(2, this.name)
    filer.writeInt16(70, this.getAttr('standardFlag'))
    filer.writeString(3, this.comments)
    filer.writeInt16(72, 65)
    filer.writeInt16(73, this.numDashes)
    filer.writeDouble(40, this.patternLength)
    for (const item of this.getAttrWithoutException('pattern') ?? []) {
      filer.writeDouble(49, item.elementLength)
      filer.writeInt16(74, item.elementTypeFlag)
      if (item.elementTypeFlag !== 0) {
        if (item.shapeNumber != null) {
          filer.writeInt16(75, item.shapeNumber)
        }
        if (item.styleObjectId) {
          filer.writeObjectId(340, item.styleObjectId)
        }
        if (item.scale != null) {
          filer.writeDouble(46, item.scale)
        }
        if (item.rotation != null) {
          filer.writeDouble(50, item.rotation)
        }
        if (item.offsetX != null) {
          filer.writeDouble(44, item.offsetX)
        }
        if (item.offsetY != null) {
          filer.writeDouble(45, item.offsetY)
        }
        if (item.text) {
          filer.writeString(9, item.text)
        }
      }
    }
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    filer.atSubclassData('AcDbSymbolTableRecord')
    filer.atSubclassData('AcDbLinetypeTableRecord')

    const pattern: AcGiLineTypePatternElement[] = []

    while (!filer.atEndOfObject && !filer.atEof && !filer.atExtendedData) {
      const item = filer.readItem()
      if (!item) break
      const code = Number(item.code)
      if (code === 100) {
        filer.pushBackItem(item)
        break
      }
      switch (code) {
        case 2:
          this.name = String(item.value)
          break
        case 70:
          this.setAttr('standardFlag', Number(item.value))
          break
        case 3:
          this.setAttr('description', String(item.value))
          break
        case 72:
          // Alignment code (always 65 / 'A') — ignored on read.
          break
        case 73:
          // Dash count — derived from pattern; ignored on read.
          break
        case 40:
          this.setAttr('totalPatternLength', Number(item.value))
          break
        case 49:
          pattern.push({
            elementLength: Number(item.value),
            elementTypeFlag: 0
          })
          break
        case 74:
          if (pattern.length > 0) {
            pattern[pattern.length - 1].elementTypeFlag = Number(item.value)
          }
          break
        case 75:
          if (pattern.length > 0) {
            pattern[pattern.length - 1].shapeNumber = Number(item.value)
          }
          break
        case 340:
          if (pattern.length > 0) {
            pattern[pattern.length - 1].styleObjectId = String(item.value)
          }
          break
        case 46:
          if (pattern.length > 0) {
            pattern[pattern.length - 1].scale = Number(item.value)
          }
          break
        case 50:
          if (pattern.length > 0) {
            pattern[pattern.length - 1].rotation = Number(item.value)
          }
          break
        case 44:
          if (pattern.length > 0) {
            pattern[pattern.length - 1].offsetX = Number(item.value)
          }
          break
        case 45:
          if (pattern.length > 0) {
            pattern[pattern.length - 1].offsetY = Number(item.value)
          }
          break
        case 9:
          if (pattern.length > 0) {
            pattern[pattern.length - 1].text = String(item.value)
          }
          break
        default:
          break
      }
    }

    this.setAttr('pattern', pattern)
    return this
  }
}

