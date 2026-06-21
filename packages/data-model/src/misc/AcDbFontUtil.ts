import { DEFAULT_TEXT_STYLE } from './AcDbConstants'

/** Parsed STYLE table entry fields used when collecting fonts before conversion. */
export type AcDbStyleFontSource = {
  name: string
  font?: string
  bigFont?: string
  extendedFont?: string
  standardFlag?: number
}

/** Pattern for inline font overrides in MTEXT formatting codes. */
export const MTEXT_INLINE_FONT_PATTERN = /\\f(.*?)\|/g

/**
 * Normalizes a font file name for font loading: strips the extension and lowercases.
 *
 * @example
 * normalizeFontFileName('Arial.ttf') // 'arial'
 */
export function normalizeFontFileName(
  fontFileName?: string
): string | undefined {
  if (!fontFileName) {
    return undefined
  }
  const lastDotIndex = fontFileName.lastIndexOf('.')
  if (lastDotIndex >= 0) {
    return fontFileName.substring(0, lastDotIndex).toLowerCase()
  }
  return fontFileName.toLowerCase()
}

/** Collects normalized font names from one STYLE table entry. */
export function collectStyleEntryFontNames(
  style: Pick<AcDbStyleFontSource, 'font' | 'bigFont' | 'extendedFont'>
): string[] {
  const fontNames: string[] = []
  for (const fileName of [style.font, style.bigFont, style.extendedFont]) {
    const normalized = normalizeFontFileName(fileName)
    if (normalized) {
      fontNames.push(normalized)
    }
  }
  return fontNames
}

/** Builds a style-name to font-names map from parsed STYLE table entries. */
export function buildStyleFontMap(
  styles: AcDbStyleFontSource[]
): Map<string, string[]> {
  const styleMap = new Map<string, string[]>()
  for (const style of styles) {
    styleMap.set(style.name, collectStyleEntryFontNames(style))
  }
  return styleMap
}

/** Collects shape-definition fonts (STYLE entries with standardFlag bit 0 set). */
export function collectShapeDefinitionFonts(
  styles: Array<Pick<AcDbStyleFontSource, 'font' | 'standardFlag'>>
): string[] {
  const fonts: string[] = []
  for (const style of styles) {
    if (style.standardFlag && style.standardFlag & 1) {
      const normalized = normalizeFontFileName(style.font)
      if (normalized) {
        fonts.push(normalized)
      }
    }
  }
  return fonts
}

/**
 * Resolves font names for a text entity style using the same fallbacks as
 * {@link AcDbTextStyleTable.resolveAt}.
 */
export function resolveStyleFontNames(
  styleName: string | undefined,
  styleMap: Map<string, string[]>,
  textStyleVar: string
): string[] | undefined {
  const candidates: string[] = []
  const addCandidate = (value?: string) => {
    const trimmed = value?.trim()
    if (trimmed && !candidates.includes(trimmed)) {
      candidates.push(trimmed)
    }
  }

  addCandidate(styleName)
  addCandidate(textStyleVar)
  addCandidate(DEFAULT_TEXT_STYLE)
  addCandidate('STANDARD')

  for (const candidate of candidates) {
    const exact = styleMap.get(candidate)
    if (exact) {
      return exact
    }

    const normalizedCandidate = candidate.toUpperCase()
    for (const [key, fontNames] of styleMap) {
      if (key.toUpperCase() === normalizedCandidate) {
        return fontNames
      }
    }
  }

  return styleMap.values().next().value
}

/** Adds resolved style fonts into the target set. */
export function addResolvedStyleFonts(
  styleName: string | undefined,
  styleMap: Map<string, string[]>,
  textStyleVar: string,
  fonts: Set<string>
) {
  const fontNames = resolveStyleFontNames(styleName, styleMap, textStyleVar)
  fontNames?.forEach(name => fonts.add(name))
}

/** Extracts inline MTEXT font overrides from formatting codes. */
export function collectInlineMTextFonts(text: string): string[] {
  const fonts: string[] = []
  for (const match of text.matchAll(MTEXT_INLINE_FONT_PATTERN)) {
    fonts.push(match[1].toLowerCase())
  }
  return fonts
}

/** Adds inline MTEXT font overrides into the target set. */
export function addInlineMTextFonts(text: string, fonts: Set<string>) {
  for (const name of collectInlineMTextFonts(text)) {
    fonts.add(name)
  }
}
