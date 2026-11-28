/**
 * Default line type used when no specific line type is specified.
 *
 * This constant represents the "Continuous" line type, which is the
 * standard solid line type used in AutoCAD drawings.
 */
export const DEFAULT_LINE_TYPE = 'Continuous'

/**
 * Default text style name used when no specific text style is specified.
 *
 * This constant represents the standard text style used in AutoCAD drawings.
 */
export const DEFAULT_TEXT_STYLE = 'Standard'

/**
 * Default multiline style name used when no specific MLINE style is specified.
 *
 * This constant represents the default current style used by the CMLSTYLE
 * system variable for newly created MLINE entities.
 */
export const DEFAULT_MLINE_STYLE = 'Standard'

/**
 * Default multileader style name used when no specific MLEADER style is specified.
 *
 * This constant represents the default current style used by the CMLEADERSTYLE
 * system variable for newly created MLEADER entities.
 */
export const DEFAULT_MLEADER_STYLE = 'Standard'

/**
 * Default hatch pattern name used by AutoCAD for imperial drawings.
 */
export const DEFAULT_HATCH_PATTERN_IMPERIAL = 'ANSI31'

/**
 * Default hatch pattern name used by AutoCAD for metric drawings.
 */
export const DEFAULT_HATCH_PATTERN_METRIC = 'ANGLE'

/**
 * Reserved hatch pattern name used for solid fills.
 */
export const HATCH_PATTERN_SOLID = 'SOLID'

/**
 * Returns true when a hatch pattern name denotes a solid fill.
 *
 * LibreDWG (and some older writers) emit `_SOLID` instead of `SOLID`. Treat
 * both — and any leading-underscore / case variant — as solid so fill is not
 * dropped when `definitionLines` are empty.
 */
export function acdbIsSolidHatchPatternName(
  patternName: string | null | undefined
): boolean {
  if (patternName == null) return false
  const normalized = patternName.trim().toUpperCase().replace(/^_+/, '')
  return normalized === HATCH_PATTERN_SOLID
}

/**
 * Default hatch pattern name used for user-defined hatch patterns in DXF output.
 */
export const HATCH_PATTERN_USER = 'USER'

/**
 * Default gradient hatch name used when a gradient hatch has no explicit name.
 */
export const DEFAULT_GRADIENT_HATCH_NAME = 'LINEAR'

/**
 * Special line type value that indicates the entity should use
 * the line type of its layer.
 *
 * When an entity has this line type, it will inherit the line type
 * from the layer it belongs to.
 */
export const ByLayer = 'ByLayer'

/**
 * Special line type value that indicates the entity should use
 * the line type of its block.
 *
 * When an entity has this line type, it will inherit the line type
 * from the block it belongs to.
 */
export const ByBlock = 'ByBlock'

/**
 * Name of the active viewport table record in AutoCAD.
 *
 * This reserved name identifies the current viewport configuration in the
 * VPORT symbol table.
 */
export const ACTIVE_VPORT_NAME = '*Active'

/**
 * VPORT status-flag bit that enables **UCSFOLLOW** for that viewport
 * (DXF group 70 / AutoCAD “UCS follow”).
 */
export const ACDB_VPORT_UCSFOLLOW_FLAG = 0x8

/**
 * VPORT status-flag bit for UCS icon visibility (**UCSICON** on).
 */
export const ACDB_VPORT_UCSICON_ON_FLAG = 0x20

/**
 * VPORT status-flag bit for displaying the UCS icon at the origin.
 */
export const ACDB_VPORT_UCSICON_ORIGIN_FLAG = 0x40

/**
 * Packs ObjectARX `iconEnabled` / `iconAtOrigin` into the **UCSICON** integer
 * (`0–3`), matching DXF VPORT group 74 bit 0 / bit 1.
 */
export function acdbPackUcsIcon(
  iconEnabled: boolean,
  iconAtOrigin: boolean
): number {
  return (iconEnabled ? 1 : 0) | (iconAtOrigin ? 2 : 0)
}

/**
 * Application ID for MLightCAD used in dictionaries and XData registration.
 */
export const MLIGHTCAD_APPID = 'mlightcad'

/**
 * Built-in AutoCAD application ID used for standard XData registration.
 */
export const ACAD_APPID = 'ACAD'

/**
 * Frozen 2D/3D placeholders when a VPORT table row omits geometry (partial DXF
 * groups, incomplete DWG decode). Used before `AcGePoint2d.copy` / `AcGePoint3d.copy`.
 */
export const VPORT_FALLBACK_CENTER_2D = Object.freeze({ x: 0, y: 0 })
export const VPORT_FALLBACK_LLC = Object.freeze({ x: 0, y: 0 })
export const VPORT_FALLBACK_URC = Object.freeze({ x: 1, y: 1 })
export const VPORT_FALLBACK_VIEW_DIR = Object.freeze({ x: 0, y: 0, z: 1 })
export const VPORT_FALLBACK_VIEW_TARGET = Object.freeze({ x: 0, y: 0, z: 0 })

/** AutoCAD default ACI color index for the GRIPCOLOR system variable. */
export const ACDB_GRIPCOLOR_DEFAULT = 150

/** AutoCAD valid range for the GRIPCOLOR system variable. */
export const ACDB_GRIPCOLOR_MIN = 1
export const ACDB_GRIPCOLOR_MAX = 255

/** AutoCAD default ACI color index for the GRIPHOT system variable. */
export const ACDB_GRIPHOT_DEFAULT = 12

/** AutoCAD valid range for the GRIPHOT system variable. */
export const ACDB_GRIPHOT_MIN = 1
export const ACDB_GRIPHOT_MAX = 255

/** AutoCAD valid range for the GRIPOBJLIMIT system variable. */
export const ACDB_GRIPOBJLIMIT_MIN = 0
export const ACDB_GRIPOBJLIMIT_MAX = 32767

/** AutoCAD valid range for the GRIPS system variable. */
export const ACDB_GRIPS_MIN = 0
export const ACDB_GRIPS_MAX = 2

/** AutoCAD default value for the GRIPSIZE system variable. */
export const ACDB_GRIPSIZE_DEFAULT = 5

/** AutoCAD valid range for the GRIPSIZE system variable. */
export const ACDB_GRIPSIZE_MIN = 1
export const ACDB_GRIPSIZE_MAX = 255

/**
 * COMPAREPROPS bit: include color property changes in drawing comparison.
 *
 * @see https://help.autodesk.com/view/ACD/2025/ENU/?guid=GUID-FC52193A-3801-42D1-B5C3-873B192B36B2
 */
export const ACDB_COMPAREPROPS_COLOR = 1
/** COMPAREPROPS bit: include layer property changes. */
export const ACDB_COMPAREPROPS_LAYER = 2
/** COMPAREPROPS bit: include linetype property changes. */
export const ACDB_COMPAREPROPS_LINETYPE = 4
/** COMPAREPROPS bit: include linetype scale property changes. */
export const ACDB_COMPAREPROPS_LINETYPESCALE = 8
/** COMPAREPROPS bit: include lineweight property changes. */
export const ACDB_COMPAREPROPS_LINEWEIGHT = 16
/** COMPAREPROPS bit: include transparency property changes. */
export const ACDB_COMPAREPROPS_TRANSPARENCY = 32
/** COMPAREPROPS bit: include thickness property changes. */
export const ACDB_COMPAREPROPS_THICKNESS = 64

/** AutoCAD default for COMPAREPROPS: property changes are not compared. */
export const ACDB_COMPAREPROPS_DEFAULT = 0

/** AutoCAD valid range for the COMPAREPROPS bitcode (sum of defined bits). */
export const ACDB_COMPAREPROPS_MIN = 0
export const ACDB_COMPAREPROPS_MAX =
  ACDB_COMPAREPROPS_COLOR |
  ACDB_COMPAREPROPS_LAYER |
  ACDB_COMPAREPROPS_LINETYPE |
  ACDB_COMPAREPROPS_LINETYPESCALE |
  ACDB_COMPAREPROPS_LINEWEIGHT |
  ACDB_COMPAREPROPS_TRANSPARENCY |
  ACDB_COMPAREPROPS_THICKNESS

/** AutoCAD default for COMPAREHATCH: hatch objects are excluded from comparison. */
export const ACDB_COMPAREHATCH_DEFAULT = 0

/** AutoCAD valid range for the COMPAREHATCH system variable. */
export const ACDB_COMPAREHATCH_MIN = 0
export const ACDB_COMPAREHATCH_MAX = 1

/**
 * AutoCAD default for MIRRTEXT: mirrored TEXT/MTEXT stay readable (not truly
 * mirrored).
 */
export const ACDB_MIRRTEXT_DEFAULT = 0

/** AutoCAD valid range for the MIRRTEXT system variable. */
export const ACDB_MIRRTEXT_MIN = 0
export const ACDB_MIRRTEXT_MAX = 1

/**
 * AutoCAD default for TRIMMODE: fillet/chamfer selected edges are trimmed.
 * @see https://help.autodesk.com/view/ACD/2024/ENU/?guid=GUID-3D639DCE-5A01-4C07-899D-0595F8DDEBF7
 */
export const ACDB_TRIMMODE_DEFAULT = 1
export const ACDB_TRIMMODE_MIN = 0
export const ACDB_TRIMMODE_MAX = 1

/** AutoCAD default for CHAMMODE: two chamfer distances. */
export const ACDB_CHAMMODE_DEFAULT = 0
export const ACDB_CHAMMODE_MIN = 0
export const ACDB_CHAMMODE_MAX = 1

/**
 * AutoCAD default for FILLETPOLYARC: fillet arc segments in FILLET Polyline.
 * @see https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-DD802826-BEE4-4B85-9B76-E9A3FBD02E24.htm
 */
export const ACDB_FILLETPOLYARC_DEFAULT = 1
export const ACDB_FILLETPOLYARC_MIN = 0
export const ACDB_FILLETPOLYARC_MAX = 1

/** AutoCAD default for COMMANDPREVIEW: command-result preview on. */
export const ACDB_COMMANDPREVIEW_DEFAULT = 1
export const ACDB_COMMANDPREVIEW_MIN = 0
export const ACDB_COMMANDPREVIEW_MAX = 1

/**
 * AutoCAD default for LAYOUTTAB: Model and layout tabs are displayed.
 *
 * @see https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-Core/files/GUID-C340CB7C-F65B-4603-B8F6-9B1C6B5B5E2A.htm
 */
export const ACDB_LAYOUTTAB_DEFAULT = 1
export const ACDB_LAYOUTTAB_MIN = 0
export const ACDB_LAYOUTTAB_MAX = 1

/**
 * AutoCAD default for HPISLANDDETECTIONMODE: island detection on.
 *
 * @see https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-Core/files/GUID-1595FDAF-AE59-475B-A8DA-D7D754C16501.htm
 */
export const ACDB_HPISLANDDETECTIONMODE_DEFAULT = 1
export const ACDB_HPISLANDDETECTIONMODE_MIN = 0
export const ACDB_HPISLANDDETECTIONMODE_MAX = 1

/**
 * AutoCAD default for HPORIGINMODE: use HPORIGIN as the hatch origin.
 *
 * @see https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-Core/files/GUID-471B755D-69F9-467B-BE6F-103106C1B03A.htm
 */
export const ACDB_HPORIGINMODE_DEFAULT = 0
export const ACDB_HPORIGINMODE_MIN = 0
export const ACDB_HPORIGINMODE_MAX = 5

/**
 * AutoCAD default for HPQUICKPREVIEW: show hatch preview while hovering
 * enclosed areas during HATCH pick-points.
 *
 * @see https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-Core/files/GUID-55E323D8-5BC3-407E-A57C-B18273325604.htm
 */
export const ACDB_HPQUICKPREVIEW_DEFAULT = 1
export const ACDB_HPQUICKPREVIEW_MIN = 0
export const ACDB_HPQUICKPREVIEW_MAX = 1

/**
 * AutoCAD default for HPQUICKPREVTIMEOUT: max seconds to generate a hatch
 * hover preview before cancelling it (valid range 1–300).
 *
 * @see https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-Core/files/GUID-4AB77E71-3EA7-41E7-AE43-EFE547149D4C.htm
 */
export const ACDB_HPQUICKPREVTIMEOUT_DEFAULT = 2
export const ACDB_HPQUICKPREVTIMEOUT_MIN = 1
export const ACDB_HPQUICKPREVTIMEOUT_MAX = 300

/**
 * AutoCAD default for PROJMODE: project to UCS XY for TRIM/EXTEND.
 * @see https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-Core/files/GUID-8735A062-2688-44A7-809A-9883761533F9.htm
 */
export const ACDB_PROJMODE_DEFAULT = 1
export const ACDB_PROJMODE_MIN = 0
export const ACDB_PROJMODE_MAX = 2

/** AutoCAD default for COMPARERCMARGIN: revision-cloud offset of 5. */
export const ACDB_COMPARERCMARGIN_DEFAULT = 5

/** AutoCAD valid range for the COMPARERCMARGIN system variable. */
export const ACDB_COMPARERCMARGIN_MIN = 1
export const ACDB_COMPARERCMARGIN_MAX = 25

/** AutoCAD default for COMPARETEXT: text objects are included in comparison. */
export const ACDB_COMPARETEXT_DEFAULT = 1

/** AutoCAD valid range for the COMPARETEXT system variable. */
export const ACDB_COMPARETEXT_MIN = 0
export const ACDB_COMPARETEXT_MAX = 1

/** AutoCAD default for COMPARETOLERANCE: 6 decimal places. */
export const ACDB_COMPARETOLERANCE_DEFAULT = 6

/** AutoCAD valid range for the COMPARETOLERANCE system variable. */
export const ACDB_COMPARETOLERANCE_MIN = 0
export const ACDB_COMPARETOLERANCE_MAX = 14

/**
 * AutoCAD default for UCSAXISANG: 90° when rotating the UCS about an axis.
 * @see https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-Core/files/GUID-C370B5F1-9A62-4394-9973-939BD2071904.htm
 */
export const ACDB_UCSAXISANG_DEFAULT = 90

/**
 * Discrete angles (degrees) accepted by UCSAXISANG.
 * Includes `22.5`, so the variable is stored as a real, not a truncated int.
 */
export const ACDB_UCSAXISANG_VALUES = Object.freeze([
  5, 10, 15, 18, 22.5, 30, 45, 90, 180
])

/** AutoCAD default for UCSFOLLOW: changing UCS does not change the view. */
export const ACDB_UCSFOLLOW_DEFAULT = 0
export const ACDB_UCSFOLLOW_MIN = 0
export const ACDB_UCSFOLLOW_MAX = 1

/**
 * AutoCAD default for UCSICON: icon on at the UCS origin when possible.
 * @see https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-Core/files/GUID-BCC7DA63-7F74-4F61-8605-E36A010FD33A.htm
 */
export const ACDB_UCSICON_DEFAULT = 3
export const ACDB_UCSICON_MIN = 0
export const ACDB_UCSICON_MAX = 3

/** AutoCAD default for UCSSELECTMODE: UCS icon is grip-selectable. */
export const ACDB_UCSSELECTMODE_DEFAULT = 1
export const ACDB_UCSSELECTMODE_MIN = 0
export const ACDB_UCSSELECTMODE_MAX = 1

/** AutoCAD default for UCSVIEW: save current UCS with named views. */
export const ACDB_UCSVIEW_DEFAULT = 1
export const ACDB_UCSVIEW_MIN = 0
export const ACDB_UCSVIEW_MAX = 1

/**
 * AutoCAD default for UCSVP: UCS is locked / saved with the viewport.
 * @see https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-Core/files/GUID-F71044DB-48DE-4D02-89E4-B1C2BC4C64A0.htm
 */
export const ACDB_UCSVP_DEFAULT = 1
export const ACDB_UCSVP_MIN = 0
export const ACDB_UCSVP_MAX = 1

/** AutoCAD default for WORLDUCS: current UCS matches the WCS. */
export const ACDB_WORLDUCS_DEFAULT = 1
export const ACDB_WORLDUCS_MIN = 0
export const ACDB_WORLDUCS_MAX = 1

/**
 * Whether the given UCS origin / axes coincide with the WCS (**WORLDUCS**).
 */
export function acdbIsWorldUcs(
  org: { x: number; y: number; z: number },
  xDir: { x: number; y: number; z: number },
  yDir: { x: number; y: number; z: number }
): boolean {
  return (
    org.x === 0 &&
    org.y === 0 &&
    org.z === 0 &&
    xDir.x === 1 &&
    xDir.y === 0 &&
    xDir.z === 0 &&
    yDir.x === 0 &&
    yDir.y === 1 &&
    yDir.z === 0
  )
}

/**
 * Truncates a numeric system-variable value to an integer and rejects values
 * outside AutoCAD's documented valid range.
 */
export function acdbCoerceIntegerSysVar(
  displayName: string,
  value: unknown,
  min: number,
  max: number
): number {
  const intVal = Math.trunc(value as number)
  if (!Number.isFinite(intVal) || intVal < min || intVal > max) {
    throw new Error(
      `Invalid ${displayName} value! Valid range is ${min} to ${max}.`
    )
  }
  return intVal
}

/**
 * Accepts only the discrete UCSAXISANG angles documented by AutoCAD.
 */
export function acdbCoerceUcsAxisAngSysVar(value: unknown): number {
  const num = Number(value)
  if (
    !Number.isFinite(num) ||
    !ACDB_UCSAXISANG_VALUES.some(allowed => Object.is(allowed, num))
  ) {
    throw new Error(
      `Invalid UCSAXISANG value! Valid values are ${ACDB_UCSAXISANG_VALUES.join(', ')}.`
    )
  }
  return num
}

/**
 * Returns a truncated integer when it lies in `[min, max]`; otherwise
 * `undefined`. Used when ingesting untrusted drawing data such as DXF HEADER.
 */
export function acdbIntegerSysVarIfInRange(
  value: unknown,
  min: number,
  max: number
): number | undefined {
  const intVal = Math.trunc(value as number)
  if (!Number.isFinite(intVal) || intVal < min || intVal > max) {
    return undefined
  }
  return intVal
}
