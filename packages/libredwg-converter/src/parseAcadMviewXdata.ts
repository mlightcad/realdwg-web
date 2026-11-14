/**
 * Camera fields recovered from AutoCAD R11–R14 `ACAD`/`MVIEW` xdata.
 *
 * Pre-R2000 VIEWPORT entities only store the paper-space rectangle in the
 * entity body; view height / DCS center / target / twist live in fixed-order
 * extended data (R14 DXF “VIEWPORT” xdata table).
 */
export interface AcadMviewViewportData {
  viewTarget: { x: number; y: number; z: number }
  viewDirection: { x: number; y: number; z: number }
  twistAngle: number
  viewHeight: number
  viewCenter: { x: number; y: number }
}

/** One LibreDWG xdata entry (`{ code, value }`). */
export interface LibreDwgXDataEntry {
  code?: number
  value?: unknown
}

/** One LibreDWG xdata app block. */
export interface LibreDwgXDataBlock {
  appName?: string
  value?: readonly LibreDwgXDataEntry[]
}

/**
 * Parses LibreDWG `ACAD`/`MVIEW` xdata into viewport view fields.
 *
 * App names may be mojibake (`䍁䑁` for UCS-2 `ACAD`), so recognition keys
 * off the `1000 "MVIEW"` marker rather than the app string alone.
 */
export function parseAcadMviewXdata(
  xdata: LibreDwgXDataBlock | readonly LibreDwgXDataBlock[] | undefined
): AcadMviewViewportData | undefined {
  if (!xdata) return undefined
  const blocks = Array.isArray(xdata) ? xdata : [xdata]

  for (const block of blocks) {
    const entries = block?.value
    if (!entries?.length) continue

    let i = 0
    while (i < entries.length && !isMviewMarker(entries[i])) i++
    if (i >= entries.length) continue
    i++
    // 1002 "{"
    if (!isControl(entries[i], '{')) continue
    i++
    // 1070 version
    if (readNumber(entries[i++]) == null) continue

    const viewTarget = readPoint(entries[i++])
    const viewDirection = readPoint(entries[i++])
    if (!viewTarget || !viewDirection) continue
    const twistAngle = readNumber(entries[i++])
    const viewHeight = readNumber(entries[i++])
    const viewCenterX = readNumber(entries[i++])
    const viewCenterY = readNumber(entries[i++])
    if (
      twistAngle == null ||
      viewHeight == null ||
      viewCenterX == null ||
      viewCenterY == null ||
      !(viewHeight > 0)
    ) {
      continue
    }

    return {
      viewTarget,
      viewDirection,
      twistAngle,
      viewHeight,
      viewCenter: { x: viewCenterX, y: viewCenterY }
    }
  }

  return undefined
}

/** True when entity-body `viewHeight` is still the R13/R14 default. */
export function needsAcadMviewViewportFallback(viewHeight: unknown): boolean {
  return (
    typeof viewHeight !== 'number' ||
    !Number.isFinite(viewHeight) ||
    viewHeight <= 0
  )
}

function isMviewMarker(entry: LibreDwgXDataEntry | undefined): boolean {
  return entry != null && Number(entry.code) === 1000 && entry.value === 'MVIEW'
}

function isControl(
  entry: LibreDwgXDataEntry | undefined,
  value: '{' | '}'
): boolean {
  return entry != null && Number(entry.code) === 1002 && entry.value === value
}

function readPoint(
  entry: LibreDwgXDataEntry | undefined
): { x: number; y: number; z: number } | undefined {
  if (!entry || Number(entry.code) < 1010 || Number(entry.code) > 1013) {
    return undefined
  }
  const value = entry.value
  if (isPointLike(value)) {
    return { x: value.x, y: value.y, z: value.z ?? 0 }
  }
  if (
    Array.isArray(value) &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  ) {
    return {
      x: value[0],
      y: value[1],
      z: typeof value[2] === 'number' ? value[2] : 0
    }
  }
  return undefined
}

function readNumber(entry: LibreDwgXDataEntry | undefined): number | undefined {
  if (!entry) return undefined
  const code = Number(entry.code)
  if (code !== 1040 && code !== 1070 && code !== 1071) return undefined
  return typeof entry.value === 'number' && Number.isFinite(entry.value)
    ? entry.value
    : undefined
}

function isPointLike(
  value: unknown
): value is { x: number; y: number; z?: number } {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { x: unknown }).x === 'number' &&
    typeof (value as { y: unknown }).y === 'number'
  )
}
