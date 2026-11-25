import {
  AcGeArea2d,
  AcGePolyline2d,
  AcGeVector3dLike
} from '@mlightcad/geometry-engine'
import { AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbDxfFiler } from '../base/AcDbDxfFiler.js'
import { AcDbEntityProperties } from './AcDbEntityProperties.js'
import { acdbMoveStretchPointsViaGrips } from './AcDbGripHelpers.js'
import { AcDbRasterImage } from './AcDbRasterImage.js'

/**
 * Entity that creates a blank area in the drawing.
 *
 * The AcDbWipeout entity creates a blank area that covers other entities
 * in the drawing. It's commonly used to hide parts of the drawing or
 * create clean areas for annotations. The wipeout area is defined by
 * a boundary path and is rendered as a solid fill in the current
 * canvas / layout background colour (matching AutoCAD).
 *
 * @example
 * ```typescript
 * const wipeout = new AcDbWipeout();
 * // Set up boundary path and other properties
 * wipeout.draw(renderer);
 * ```
 */
export class AcDbWipeout extends AcDbRasterImage {
  /** The entity type name */
  static override typeName: string = 'Wipeout'

  override get dxfTypeName() {
    return 'WIPEOUT'
  }

  /**
   * Same as {@link AcDbRasterImage.properties} without the image group:
   * brightness, contrast, fade and the image display flags have no effect on
   * a wipeout mask.
   */
  override get properties(): AcDbEntityProperties {
    const properties = this.getImageProperties()
    return {
      type: properties.type,
      groups: properties.groups.filter(group => group.groupName !== 'image')
    }
  }

  /**
   * Wipeouts stretch via boundary vertices (unlike IMAGE insertion-only).
   */
  override subGetStretchPoints() {
    return this.subGetGripPoints()
  }

  override subMoveStretchPointsAt(indices: number[], offset: AcGeVector3dLike) {
    return acdbMoveStretchPointsViaGrips(this, indices, offset)
  }

  /**
   * Draws the wipeout entity.
   *
   * This method creates a solid background-coloured area based on the
   * boundary path of the wipeout entity. The area covers all entities
   * behind it (by draw order), effectively "wiping out" that portion of
   * the drawing.
   *
   * @param renderer - The renderer to use for drawing
   * @returns The rendered entity or undefined if rendering fails
   */
  subWorldDraw(renderer: AcGiRenderer) {
    const traits = renderer.subEntityTraits
    // AutoCAD paints wipeouts with the layout background, not the entity
    // colour. Flag the fill so renderers track MODELBKCOLOR / PAPERBKCOLOR
    // (and theme flips) instead of resolving ACI / ByLayer to black/white.
    traits.isBackgroundFill = true
    // A wipeout is always a solid mask. Traits are shared across entities,
    // so without this the pattern of the last hatch drawn leaks in: the
    // viewer drew the wipeout as background-coloured hatch lines that did
    // not mask, and PDF export tessellated a dense pattern across the whole
    // wipeout (hundreds of thousands of strokes per wipeout).
    traits.fillType = {
      solidFill: true,
      patternAngle: 0,
      definitionLines: []
    }
    const points = this.boundaryPath()
    const area = new AcGeArea2d()
    area.add(new AcGePolyline2d(points))
    return renderer.area(area)
  }

  /**
   * Writes DXF fields for this object.
   *
   * @param filer - DXF output writer.
   * @returns The instance (for chaining).
   */
  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    // WIPEOUT has the same subclassMarker as its parent
    return this
  }
}
