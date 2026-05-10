import { AcCmColor } from '@mlightcad/common'

export interface AcDbEntityColorSource {
  color?: number
  colorIndex?: number
  colorName?: string
}

/**
 * Build a fresh AcCmColor instance for an AcDbEntity.
 *
 * We must assign the color through the entity setter rather than mutating
 * `dbEntity.color` in-place because some entities return a cloned color
 * instance from the getter.
 */
export function buildAcDbColor(
  source: AcDbEntityColorSource,
  customizeColorIndex?: (color: AcCmColor) => void
) {
  const color = new AcCmColor()
  if (source.color != null) {
    color.setRGBValue(source.color)
  }
  if (source.colorIndex != null) {
    if (customizeColorIndex) {
      customizeColorIndex(color)
    } else {
      color.colorIndex = source.colorIndex
    }
  }
  if (source.colorName) {
    color.colorName = source.colorName
  }
  return color
}
