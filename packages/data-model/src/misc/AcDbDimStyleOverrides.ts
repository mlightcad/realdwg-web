import { AcDbDxfCode } from '../base/AcDbDxfCode.js'
import type { AcDbObject } from '../base/AcDbObject.js'
import { AcDbResultBuffer } from '../base/AcDbResultBuffer.js'
import type { AcDbBlockTableRecord } from '../database/AcDbBlockTableRecord.js'
import type { AcDbDatabase } from '../database/AcDbDatabase.js'
import { AcDbDimStyleTableRecord } from '../database/AcDbDimStyleTableRecord.js'
import type { AcDbTextStyleTableRecord } from '../database/AcDbTextStyleTableRecord.js'

/** Registered application name that carries the `DSTYLE` override block. */
export const ACDB_DSTYLE_XDATA_APP = 'ACAD'

/** Marker string that opens the `DSTYLE` subsection inside the `ACAD` XData. */
export const ACDB_DSTYLE_XDATA_MARKER = 'DSTYLE'

/**
 * One per-entity dimension style override.
 *
 * `code` is the **DIMSTYLE table record group code** of the overridden variable
 * (not an XData group code). For example `41` is DIMASZ and `341` is DIMLDRBLK.
 */
export interface AcDbDimStyleOverride {
  /** DIMSTYLE table group code of the overridden variable. */
  code: number
  /** Override value exactly as stored in XData (number, string or handle). */
  value: number | string
}

/**
 * Resolves a DIMSTYLE group code to the {@link AcDbDimStyleTableRecord}
 * property name that carries the same variable.
 *
 * The table below mirrors the DIMSTYLE group codes documented by the DXF
 * reference ("DIMSTYLE group codes"). Codes missing from the table are not
 * supported as overrides and are ignored by {@link acdbApplyDimStyleOverrides}.
 */
const DIMSTYLE_CODE_TO_PROPERTY: Readonly<Record<number, string>> = {
  // Text content / placement
  3: 'dimpost',
  4: 'dimapost',
  40: 'dimscale',
  // Sizes, gaps and extension line geometry
  41: 'dimasz',
  42: 'dimexo',
  43: 'dimdli',
  44: 'dimexe',
  45: 'dimrnd',
  46: 'dimdle',
  47: 'dimtp',
  48: 'dimtm',
  140: 'dimtxt',
  141: 'dimcen',
  142: 'dimtsz',
  143: 'dimaltf',
  144: 'dimlfac',
  145: 'dimtvp',
  146: 'dimtfac',
  147: 'dimgap',
  148: 'dimaltrnd',
  // Flags
  70: 'dimtfillclr',
  69: 'dimtfill',
  71: 'dimtol',
  72: 'dimlim',
  73: 'dimtih',
  74: 'dimtoh',
  75: 'dimse1',
  76: 'dimse2',
  77: 'dimtad',
  78: 'dimzin',
  79: 'dimazin',
  170: 'dimalt',
  171: 'dimaltd',
  172: 'dimtofl',
  173: 'dimsah',
  174: 'dimtix',
  175: 'dimsoxd',
  // Colors
  176: 'dimclrd',
  177: 'dimclre',
  178: 'dimclrt',
  // Units and formatting
  179: 'dimadec',
  270: 'dimunit',
  271: 'dimdec',
  272: 'dimtdec',
  273: 'dimaltu',
  274: 'dimalttd',
  275: 'dimaunit',
  276: 'dimfrac',
  277: 'dimlunit',
  278: 'dimdsep',
  279: 'dimtmove',
  280: 'dimjust',
  281: 'dimsd1',
  282: 'dimsd2',
  283: 'dimtolj',
  284: 'dimtzin',
  285: 'dimaltz',
  286: 'dimalttz',
  287: 'dimfit',
  288: 'dimupt',
  289: 'dimatfit',
  294: 'dimtxtdirection',
  295: 'dimtxtdirection',
  // Referenced table records (handles, resolved to names)
  340: 'dimtxsty',
  341: 'dimldrblk',
  342: 'dimblk',
  343: 'dimblk1',
  344: 'dimblk2',
  // Lineweights
  371: 'dimlwd',
  372: 'dimlwe'
}

/**
 * Group codes whose value is a table/block handle rather than a plain value.
 *
 * Their XData value is stored as a 1005 handle and must be resolved to the
 * referenced object's name before it can be written onto a style record.
 */
const HANDLE_REFERENCE_CODES = new Set([340, 341, 342, 343, 344])

/** Returns the DIMSTYLE property name for a group code, if supported. */
export function acdbDimStylePropertyForCode(code: number): string | undefined {
  return DIMSTYLE_CODE_TO_PROPERTY[code]
}

/**
 * Reads the raw `ACAD`/`DSTYLE` overrides attached to an entity.
 *
 * Dimensions, leaders and tolerance entities store per-entity dimension
 * variable overrides as XData under the `ACAD` AppId:
 *
 * ```text
 * 1001 ACAD
 * 1000 DSTYLE
 * 1002 {
 * 1070 <dimstyle group code> <typed value>   // repeated
 * 1002 }
 * ```
 *
 * Handle-valued overrides (340–344) keep their raw handle string here; use
 * {@link acdbResolveDimStyleOverrides} to turn them into record names.
 *
 * The read path is allocation-free on the compact import form: it never
 * materializes the XData result buffer.
 *
 * @param object - Entity that may carry `ACAD`/`DSTYLE` XData
 * @returns Overrides in the order they appear; empty when absent
 */
export function acdbReadDimStyleOverrides(
  object: AcDbObject
): AcDbDimStyleOverride[] {
  const values = Array.from(object.iterateXData(ACDB_DSTYLE_XDATA_APP))
  const markerIndex = values.findIndex(
    item =>
      Number(item.code) === AcDbDxfCode.ExtendedDataAsciiString &&
      String(item.value) === ACDB_DSTYLE_XDATA_MARKER
  )
  if (markerIndex < 0) return []

  const overrides: AcDbDimStyleOverride[] = []
  let insideBlock = false
  let pendingCode: number | undefined

  for (let i = markerIndex + 1; i < values.length; i++) {
    const item = values[i]
    const code = Number(item.code)

    if (code === AcDbDxfCode.ExtendedDataControlString) {
      const control = String(item.value)
      if (control === '{') {
        if (insideBlock) break // Only one brace pair is valid.
        insideBlock = true
        continue
      }
      // `}` closes the DSTYLE subsection (or any nested control string).
      break
    }
    if (!insideBlock) continue

    if (pendingCode === undefined) {
      // The code of a pair is always an XData 1070.
      if (code === AcDbDxfCode.ExtendedDataInteger16) {
        pendingCode = Number(item.value)
      }
      continue
    }

    const value = acdbOverrideValueFromXData(code, item.value)
    if (value !== undefined) {
      overrides.push({ code: pendingCode, value })
    }
    pendingCode = undefined
  }

  return overrides
}

function acdbOverrideValueFromXData(
  code: number,
  value: unknown
): number | string | undefined {
  switch (code) {
    case AcDbDxfCode.ExtendedDataReal:
    case AcDbDxfCode.ExtendedDataDist:
    case AcDbDxfCode.ExtendedDataScale:
    case AcDbDxfCode.ExtendedDataInteger16:
    case AcDbDxfCode.ExtendedDataInteger32:
      return Number(value)
    case AcDbDxfCode.ExtendedDataAsciiString:
      return String(value)
    case AcDbDxfCode.ExtendedDataHandle:
      return String(value)
    default:
      // Points / binary / layer references are not valid dimvar values.
      return undefined
  }
}

/** Arrow-block override codes; an empty name means the closed-filled arrow. */
const ARROW_BLOCK_CODES = new Set([341, 342, 343, 344])

/**
 * DIMSTYLE variables whose value is text rather than a number.
 *
 * Every other supported variable is numeric, so a value that arrives in the
 * "wrong" group code only has to be converted back to the property type.
 */
const STRING_DIMSTYLE_PROPERTIES = new Set([
  'dimpost',
  'dimapost',
  'dimdsep',
  'dimtxsty',
  'dimldrblk',
  'dimblk',
  'dimblk1',
  'dimblk2'
])

/**
 * Converts one override value to the runtime type of the overridden property.
 *
 * DSTYLE stores each variable with the group code that variable uses on the
 * wire, so text-valued variables still arrive as numbers: DIMDSEP (a single
 * character) is written as its ASCII code (`1070 . 44`). Assigning that number
 * to the string property would make `String.prototype.replace` splice the raw
 * code into the measurement — `"10.00".replace('.', 44)` yields `"104400"` —
 * so the value is converted back to the character first. This mirrors how
 * {@link AcDbDimStyleTableRecord.dxfInFields} decodes group code 278.
 *
 * @param property - {@link AcDbDimStyleTableRecord} property being written
 * @param value - Raw value from XData
 * @returns Value coerced to the property's type
 */
function acdbCoerceOverrideValue(
  property: string,
  value: number | string
): number | string {
  if (STRING_DIMSTYLE_PROPERTIES.has(property)) {
    if (typeof value === 'string') return value
    // '.' is DIMDSEP's default and AutoCAD's fallback for a bad value.
    return Number.isFinite(value) ? String.fromCharCode(Math.trunc(value)) : '.'
  }
  if (typeof value === 'string') {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : value
  }
  return value
}

/**
 * Resolves handle-valued overrides (DIMTXSTY / DIMLDRBLK / DIMBLK*) to names.
 *
 * AutoCAD only records an override when the entity value differs from the
 * style, so the very common `(1070 . 341) (1005 . 0)` is meaningful: it clears
 * DIMLDRBLK and the leader therefore uses the standard closed-filled arrow
 * instead of the block referenced by the style. A zero arrow handle is turned
 * into an empty name (satisfying that), while DIMTXSTY = 0 is ignored because an
 * empty text style would leave the dimension text without a style at all.
 *
 * @param overrides - Raw overrides from {@link acdbReadDimStyleOverrides}
 * @param database - Database used to look up the referenced records
 * @returns Overrides with record names substituted for handles
 */
export function acdbResolveDimStyleOverrides(
  overrides: readonly AcDbDimStyleOverride[],
  database?: AcDbDatabase
): AcDbDimStyleOverride[] {
  const resolved: AcDbDimStyleOverride[] = []
  for (const override of overrides) {
    if (!HANDLE_REFERENCE_CODES.has(override.code)) {
      resolved.push(override)
      continue
    }

    const handle = String(override.value).trim().toUpperCase()
    const cleared = !handle || handle === '0'

    if (override.code === 340) {
      // DIMTXSTY: a missing target keeps the style's text style.
      if (cleared || !database) continue
      const style = database.getObjectById(handle)
      const name = (style as AcDbTextStyleTableRecord | undefined)?.name
      if (name) resolved.push({ code: override.code, value: name })
      continue
    }

    if (cleared || !database) {
      if (ARROW_BLOCK_CODES.has(override.code)) {
        resolved.push({ code: override.code, value: '' })
      }
      continue
    }

    const block = database.getObjectById(handle)
    const name = (block as AcDbBlockTableRecord | undefined)?.name
    resolved.push({ code: override.code, value: name ?? '' })
  }
  return resolved
}

/**
 * Builds a style record that reflects the entity's overrides on top of the
 * referenced dimension style.
 *
 * The returned record is a detached `AcDbDimStyleTableRecord` — mutating it
 * never touches the table record in the drawing, and the caller must not add it
 * to the table. Only resolved overrides (see
 * {@link acdbResolveDimStyleOverrides}) are applied; unsupported group codes
 * are ignored so a newer drawing cannot corrupt rendering.
 *
 * @param base - Style referenced by the entity (may be undefined)
 * @param overrides - Resolved overrides, in XData order
 * @returns Effective style for drawing this entity
 */
export function acdbApplyDimStyleOverrides(
  base: AcDbDimStyleTableRecord | undefined,
  overrides: readonly AcDbDimStyleOverride[]
): AcDbDimStyleTableRecord {
  const style = base?.clonePreservingIdentity() ?? new AcDbDimStyleTableRecord()
  // A detached clone keeps the base handle; dropping it keeps the effective
  // style from ever colliding with the real table record in the handle index.
  style.objectId = ''

  for (const override of overrides) {
    const property = DIMSTYLE_CODE_TO_PROPERTY[override.code]
    if (!property) continue
    // Group 70 is ambiguous in DIMSTYLE records (standard flags vs
    // DIMTFILLCLR); as an override it always means DIMTFILLCLR.
    if (!(property in style)) continue
    // Write through the attribute container. The public property setters call
    // `assertOpenForWrite`, and an effective style must never require a
    // transaction on the referenced table record.
    style.attrs.set(
      property,
      acdbCoerceOverrideValue(property, override.value) as never
    )
  }
  return style
}

/**
 * Convenience wrapper: reads, resolves and applies the overrides of `object`.
 *
 * Returns `base` itself when the entity carries no usable override, so callers
 * on the hot draw path do not pay for a clone per entity per frame.
 *
 * @param object - Entity whose `ACAD`/`DSTYLE` XData is inspected
 * @param base - Style referenced by the entity
 * @param database - Database used to resolve handle-valued overrides
 */
export function acdbResolveEffectiveDimStyle(
  object: AcDbObject,
  base: AcDbDimStyleTableRecord | undefined,
  database?: AcDbDatabase
): AcDbDimStyleTableRecord | undefined {
  const raw = acdbReadDimStyleOverrides(object)
  if (raw.length === 0) return base
  const resolved = acdbResolveDimStyleOverrides(raw, database)
  if (resolved.length === 0) return base
  return acdbApplyDimStyleOverrides(base, resolved)
}

/**
 * Writes the `ACAD`/`DSTYLE` override subsection back onto `object`.
 *
 * Mirror of {@link acdbReadDimStyleOverrides}: any existing `DSTYLE` subsection
 * is replaced while the rest of the `ACAD` XData is preserved, because AutoCAD
 * stores all `ACAD` data (overrides included) in a single result buffer per
 * application. Passing an empty list removes only the override subsection.
 *
 * @param object - Entity receiving the overrides
 * @param overrides - Overrides to store; values may be numbers, strings or
 *   handle strings for the 340–344 group codes
 */
export function acdbWriteDimStyleOverrides(
  object: AcDbObject,
  overrides: readonly AcDbDimStyleOverride[]
): void {
  const kept = Array.from(object.iterateXData(ACDB_DSTYLE_XDATA_APP)).filter(
    item => Number(item.code) !== AcDbDxfCode.ExtendedDataRegAppName
  )
  const preserved = acdbStripDimStyleOverrideSection(kept)

  const values: Array<{ code: AcDbDxfCode; value: unknown }> = [
    {
      code: AcDbDxfCode.ExtendedDataRegAppName,
      value: ACDB_DSTYLE_XDATA_APP
    },
    ...preserved.map(item => ({ code: item.code, value: item.value }))
  ]

  if (overrides.length > 0) {
    values.push({
      code: AcDbDxfCode.ExtendedDataAsciiString,
      value: ACDB_DSTYLE_XDATA_MARKER
    })
    values.push({
      code: AcDbDxfCode.ExtendedDataControlString,
      value: '{'
    })
    for (const override of overrides) {
      values.push({
        code: AcDbDxfCode.ExtendedDataInteger16,
        value: override.code
      })
      values.push(acdbXDataForOverrideValue(override))
    }
    values.push({
      code: AcDbDxfCode.ExtendedDataControlString,
      value: '}'
    })
  }

  object.setXData(new AcDbResultBuffer(values as never) as AcDbResultBuffer)
}

function acdbStripDimStyleOverrideSection<
  T extends { code: AcDbDxfCode; value: unknown }
>(items: readonly T[]): T[] {
  const markerIndex = items.findIndex(
    item =>
      Number(item.code) === AcDbDxfCode.ExtendedDataAsciiString &&
      String(item.value) === ACDB_DSTYLE_XDATA_MARKER
  )
  if (markerIndex < 0) return items.slice()

  let depth = 0
  let opened = false
  let end = markerIndex + 1
  for (; end < items.length; end++) {
    const item = items[end]
    if (Number(item.code) !== AcDbDxfCode.ExtendedDataControlString) continue
    if (String(item.value) === '{') {
      opened = true
      depth++
    } else if (opened && --depth <= 0) {
      end++
      break
    }
  }
  return [...items.slice(0, markerIndex), ...items.slice(end)]
}

function acdbXDataForOverrideValue(override: AcDbDimStyleOverride): {
  code: AcDbDxfCode
  value: unknown
} {
  if (HANDLE_REFERENCE_CODES.has(override.code)) {
    // An empty arrow name means "no arrow block": AutoCAD stores that as the
    // null handle `0`, not as an empty 1005 string.
    const handle = String(override.value)
    return {
      code: AcDbDxfCode.ExtendedDataHandle,
      value: handle ? handle : '0'
    }
  }
  if (typeof override.value === 'string') {
    return {
      code: AcDbDxfCode.ExtendedDataAsciiString,
      value: override.value
    }
  }
  // Real vs. integer is decided by the variable, not the JS number type: every
  // real-valued dimvar must be written as 1040 or AutoCAD rejects the entity.
  if (acdbIsIntegerDimStyleCode(override.code)) {
    return {
      code: AcDbDxfCode.ExtendedDataInteger16,
      value: Math.trunc(override.value)
    }
  }
  return { code: AcDbDxfCode.ExtendedDataReal, value: override.value }
}

/** DIMSTYLE group codes whose value is an integer rather than a real. */
const INTEGER_DIMSTYLE_CODES = new Set([
  69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 170, 171, 172, 173, 174, 175, 176,
  177, 178, 179, 270, 271, 272, 273, 274, 275, 276, 277, 278, 279, 280, 281,
  282, 283, 284, 285, 286, 287, 288, 289, 294, 295, 371, 372
])

/** True when the DIMSTYLE variable of `code` is an integer value. */
export function acdbIsIntegerDimStyleCode(code: number): boolean {
  return INTEGER_DIMSTYLE_CODES.has(code)
}

/** Default style used when an entity references a missing dimension style. */
export const ACDB_DEFAULT_DIM_STYLE = AcDbDimStyleTableRecord.DEFAULT_DIM_VALUES
