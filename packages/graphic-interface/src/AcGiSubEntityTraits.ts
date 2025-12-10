import { AcCmColor } from '@mlightcad/common'

import { AcGiHatchStyle } from './AcGiHatchStyle'
import { AcGiLineStyle } from './AcGiLineStyle'

/**
 * Trait settings for a sub‑entity in AutoCAD graphics (corresponding to AcGiSubEntityTraits).
 * These properties define visual attributes like color, line style, layer, thickness, etc.
 */
export interface AcGiSubEntityTraits {
  /**
   * The RGB color.
   * It resolves layer colors and block colors as needed and converts color index to actual RGB color.
   */
  rgbColor: number

  /**
   * Color of the entity.
   */
  color: AcCmColor

  /**
   * Line type (pattern) used for drawing edges / curves of the entity.
   * Corresponds to AutoCAD’s `AcGiLineStyle` (or linetypeTableRecord). :contentReference[oaicite:1]{index=1}
   */
  lineType: AcGiLineStyle

  /**
   * Scale factor applied to the lineType.
   * Changes how dense or stretched the pattern appears. (Equivalent to AutoCAD’s “Linetype Scale” / ltScale). :contentReference[oaicite:2]{index=2}
   */
  lineTypeScale: number

  /**
   * Lineweight for the entity’s drawing (i.e. the visual thickness of lines).
   * Typically corresponds to one of AutoCAD’s predefined lineweights (e.g. “0.13 mm”, “0.30 mm”, etc.) or “ByLayer/ByBlock”. :contentReference[oaicite:3]{index=3}
   */
  lineWeight: number

  /**
   * Fill type / hatch style for the entity (if applicable).
   * Corresponds to AutoCAD’s `AcGiHatchStyle`. For example, controlling whether the sub‑entity is filled or only outlined. :contentReference[oaicite:4]{index=4}
   */
  fillType: AcGiHatchStyle

  /**
   * Transparency of the entity.
   * A numeric value controlling how transparent (or opaque) the entity is when rendered.
   * In AutoCAD this corresponds to the transparency attribute in SubEntityTraits. :contentReference[oaicite:5]{index=5}
   */
  transparency: number

  /**
   * Thickness (extrusion) of the entity along the positive Z axis in WCS units.
   * Only affects certain primitive types (e.g. polylines, arcs, circles, SHX‑text), similarly to AutoCAD’s “thickness” property. :contentReference[oaicite:6]{index=6}
   */
  thickness: number

  /**
   * The name of the layer on which the entity resides.
   * Corresponds to AutoCAD layer name (i.e. current layer in drawing). :contentReference[oaicite:7]{index=7}
   */
  layer: string
}
