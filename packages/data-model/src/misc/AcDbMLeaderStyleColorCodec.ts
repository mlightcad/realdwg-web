import { AcCmColor, AcCmColorMethod } from '@mlightcad/common'

/**
 * DXF raw-color type flag: inherit color from layer.
 *
 * Stored in the high byte (bits 24-31) of MLEADERSTYLE raw-color int32.
 */
export const RAW_COLOR_TYPE_BY_LAYER = 0xc0

/**
 * DXF raw-color type flag: inherit color from block.
 *
 * Stored in the high byte (bits 24-31) of MLEADERSTYLE raw-color int32.
 */
export const RAW_COLOR_TYPE_BY_BLOCK = 0xc1

/**
 * DXF raw-color type flag: explicit true color.
 *
 * Stored in the high byte (bits 24-31); payload uses low 24 bits as 0xRRGGBB.
 */
export const RAW_COLOR_TYPE_RGB = 0xc2

/**
 * DXF raw-color type flag: AutoCAD Color Index (ACI).
 *
 * Stored in the high byte (bits 24-31); payload uses low 8 bits as ACI index.
 */
export const RAW_COLOR_TYPE_ACI = 0xc3

/**
 * DXF raw-color type flag: window background color.
 *
 * This value appears in some producers; we treat it as a compatible fallback.
 */
export const RAW_COLOR_TYPE_WINDOW_BG = 0xc8

/**
 * Encodes MLEADERSTYLE color (`AcCmColor`) to DXF raw-color int32.
 *
 * Algorithm sources:
 * - AutoCAD DXF MLEADERSTYLE docs (group codes 91/93/94):
 *   https://help.autodesk.com/cloudhelp/2021/ENU/AutoCAD-DXF/files/GUID-0E489B69-17A4-4439-8505-9DCE032100B4.htm
 * - ezdxf reference implementation (`encode_raw_color`):
 *   https://raw.githubusercontent.com/mozman/ezdxf/master/src/ezdxf/colors.py
 */
export function acdbEncodeMLeaderStyleRawColor(color: AcCmColor) {
  if (color.isByBlock) {
    return (RAW_COLOR_TYPE_BY_BLOCK << 24) >> 0
  }
  if (color.isByLayer) {
    return (RAW_COLOR_TYPE_BY_LAYER << 24) >> 0
  }

  const aci = color.colorIndex
  if (aci != null && aci > 0 && aci < 256) {
    return ((RAW_COLOR_TYPE_ACI << 24) | (aci & 0xff)) >> 0
  }

  const rgb = color.RGB
  if (rgb != null) {
    return ((RAW_COLOR_TYPE_RGB << 24) | (rgb & 0xffffff)) >> 0
  }

  // Safe fallback for invalid/empty color state.
  return (RAW_COLOR_TYPE_BY_BLOCK << 24) >> 0
}

/**
 * Decodes MLEADERSTYLE DXF raw-color int32 to `AcCmColor`.
 *
 * Raw-color is a packed 32-bit signed integer:
 * - high byte (bits 24-31): color type flag
 * - low bytes: payload
 *
 * Why values often look negative:
 * - DXF stores this as signed int32; high-byte flags >= 0x80 become negative decimals.
 *
 * Algorithm sources:
 * - AutoCAD DXF MLEADERSTYLE docs (group codes 91/93/94):
 *   https://help.autodesk.com/cloudhelp/2021/ENU/AutoCAD-DXF/files/GUID-0E489B69-17A4-4439-8505-9DCE032100B4.htm
 * - ezdxf reference implementation (`decode_raw_color_int`):
 *   https://raw.githubusercontent.com/mozman/ezdxf/master/src/ezdxf/colors.py
 */
export function acdbDecodeMLeaderStyleRawColor(rawColor: number) {
  const color = new AcCmColor(AcCmColorMethod.ByBlock)
  if (!Number.isFinite(rawColor)) {
    return color
  }
  const flags = (rawColor >>> 24) & 0xff
  switch (flags) {
    case RAW_COLOR_TYPE_BY_LAYER:
      color.setByLayer()
      break
    case RAW_COLOR_TYPE_BY_BLOCK:
    case RAW_COLOR_TYPE_WINDOW_BG:
      color.setByBlock()
      break
    case RAW_COLOR_TYPE_ACI:
      color.colorIndex = rawColor & 0xff
      break
    case RAW_COLOR_TYPE_RGB:
      color.setRGBValue(rawColor & 0xffffff)
      break
    default:
      // Plain ACI from libredwg index-only exports (legacy) and other producers.
      if (rawColor === 256) {
        color.setByLayer()
      } else if (rawColor === 0) {
        color.setByBlock()
      } else if (rawColor > 0 && rawColor < 256) {
        color.colorIndex = rawColor
      }
      break
  }
  return color
}

/**
 * LibreDWG CMC / {@link Dwg_Color}-like object used for DIMCLRD/E/T and similar.
 */
export type AcDbDwgColorLike = {
  index?: number
  rgb?: number
  method?: number
  name?: string
}

/**
 * Decodes a dim-style color field from LibreDWG / DXF.
 *
 * Accepts:
 * - plain ACI `0` / `1..255` / `256`
 * - packed CMC int32 (high byte `0xC0..0xC8`)
 * - LibreDWG CMC objects `{ method, index, rgb }`
 *
 * Invalid values fall back to ByBlock so glyph construction never sees NaN ACI.
 */
export function acdbDecodeDimStyleColor(raw: unknown): AcCmColor {
  if (raw == null) {
    return new AcCmColor(AcCmColorMethod.ByBlock)
  }
  if (typeof raw === 'number') {
    return acdbDecodeMLeaderStyleRawColor(raw)
  }
  if (typeof raw === 'object') {
    const c = raw as AcDbDwgColorLike
    const method =
      c.method != null && c.method !== 0
        ? c.method & 0xff
        : typeof c.rgb === 'number'
          ? (c.rgb >>> 24) & 0xff
          : 0
    if (
      typeof c.rgb === 'number' &&
      Number.isFinite(c.rgb) &&
      method >= RAW_COLOR_TYPE_BY_LAYER &&
      method <= RAW_COLOR_TYPE_WINDOW_BG
    ) {
      // Prefer packed rgb when it already carries the CMC type flag.
      if (((c.rgb >>> 24) & 0xff) === method) {
        return acdbDecodeMLeaderStyleRawColor(c.rgb >> 0)
      }
    }
    if (method === RAW_COLOR_TYPE_BY_LAYER || c.index === 256) {
      const color = new AcCmColor()
      color.setByLayer()
      return color
    }
    if (method === RAW_COLOR_TYPE_BY_BLOCK || c.index === 0) {
      return new AcCmColor(AcCmColorMethod.ByBlock)
    }
    if (method === RAW_COLOR_TYPE_RGB && typeof c.rgb === 'number') {
      const color = new AcCmColor()
      color.setRGBValue(c.rgb & 0xffffff)
      return color
    }
    if (method === RAW_COLOR_TYPE_ACI) {
      const aci =
        typeof c.rgb === 'number' ? c.rgb & 0xff : (c.index ?? 0) & 0xff
      return acdbDecodeMLeaderStyleRawColor(aci)
    }
    if (typeof c.index === 'number' && c.index >= 0 && c.index <= 256) {
      return acdbDecodeMLeaderStyleRawColor(c.index)
    }
    if (typeof c.rgb === 'number' && Number.isFinite(c.rgb)) {
      return acdbDecodeMLeaderStyleRawColor(c.rgb >> 0)
    }
  }
  return new AcCmColor(AcCmColorMethod.ByBlock)
}

/**
 * Normalizes a dim-style color field to a plain number for
 * {@link AcDbDimStyleTableRecord} storage (`0` / `1..255` / `256`, or packed RGB).
 */
export function acdbNormalizeDimStyleColorNumber(raw: unknown): number {
  const color = acdbDecodeDimStyleColor(raw)
  if (color.isByBlock) return 0
  if (color.isByLayer) return 256
  const aci = color.colorIndex
  if (aci != null && aci > 0 && aci < 256) return aci
  const rgb = color.RGB
  if (typeof rgb === 'number') {
    return ((RAW_COLOR_TYPE_RGB << 24) | (rgb & 0xffffff)) >> 0
  }
  return 0
}
