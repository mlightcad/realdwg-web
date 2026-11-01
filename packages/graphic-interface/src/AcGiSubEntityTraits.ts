import { AcCmColor, AcCmTransparency } from '@mlightcad/common'

import { AcGiHatchStyle } from './AcGiHatchStyle.js'
import { AcGiLineStyle } from './AcGiLineStyle.js'
import { AcGiLineWeight } from './AcGiLineWeight.js'

/**
 * Trait settings for a sub‑entity in AutoCAD graphics (corresponding to AcGiSubEntityTraits).
 * These properties define visual attributes like color, line style, layer, thickness, etc.
 */
export interface AcGiSubEntityTraits {
  /**
   * Resolved semantic color of the sub-entity.
   *
   * Use {@link AcGiContext.resolveSubEntityTraitsRgb} with {@link AcGiRenderer.context}
   * to obtain the pixel RGB value at draw time (including ACI 7 foreground handling).
   */
  color: AcCmColor

  /**
   * Line type (pattern) used for drawing edges / curves of the entity.
   * Corresponds to AutoCAD's `AcGiLineStyle` (or linetypeTableRecord).
   */
  lineType: AcGiLineStyle

  /**
   * Scale factor applied to the lineType.
   * Changes how dense or stretched the pattern appears. (Equivalent to
   * AutoCAD's "Linetype Scale" / ltScale).
   */
  lineTypeScale: number

  /**
   * Lineweight for the entity's drawing (i.e. the visual thickness of lines).
   * Typically corresponds to one of AutoCAD's predefined lineweights.
   */
  lineWeight: AcGiLineWeight

  /**
   * Fill type / hatch style for the entity (if applicable).
   * Corresponds to AutoCAD's `AcGiHatchStyle`. For example, controlling whether
   * the sub‑entity is filled or only outlined.
   */
  fillType: AcGiHatchStyle

  /**
   * Transparency of the entity.
   * A numeric value controlling how transparent (or opaque) the entity is when rendered.
   */
  transparency: AcCmTransparency

  /**
   * Thickness (extrusion) of the entity along the positive Z axis in WCS units.
   * Only affects certain primitive types (e.g. polylines, arcs, circles, SHX‑text),
   * similarly to AutoCAD's "thickness" property.
   */
  thickness: number

  /**
   * The name of the layer on which the entity resides.
   * Corresponds to AutoCAD layer name (i.e. current layer in drawing).
   */
  layer: string

  /**
   * Explicit render-order tier used when different primitive types
   * share the same Z plane.
   *
   * Lower values render earlier. The default `0` matches normal
   * linework / text. Solid hatches use `-1` so they stay below
   * outlines and text, while wide polylines keep `0` because they
   * are visually linework even though they are rasterized as meshes.
   */
  drawOrder: number

  /**
   * When true, solid fills use the current canvas / layout background
   * colour and track theme flips, ignoring {@link color}.
   *
   * Used by wipeouts so the masked area matches the paper rather than
   * the entity's ACI colour (which is typically ACI 7 / black on a light
   * background).
   */
  isBackgroundFill?: boolean

  /**
   * Whether the entity's *own* colour was ByLayer before {@link color} was
   * resolved against the layer table.
   *
   * {@link color} is stored pre-resolved, so ByLayer content on an ACI-7 layer
   * becomes an absolute ACI 7 and is indistinguishable from an explicitly
   * authored ACI 7. Renderers need the original provenance to decide whether a
   * layer-0 block entity inherits the INSERT layer's colour: a ByLayer colour
   * must inherit, an explicit ACI 7 must stay white/black.
   *
   * `undefined` means "unknown" (foreign traits, legacy call sites); consumers
   * must then fall back to inspecting {@link color}.
   */
  isColorByLayer?: boolean
}
