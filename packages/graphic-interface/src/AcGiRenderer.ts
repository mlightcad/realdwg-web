import {
  AcGeArea2d,
  AcGeCircArc3d,
  AcGeEllipseArc3d,
  AcGePoint3d,
  AcGePoint3dLike
} from '@mlightcad/geometry-engine'

import { AcGiEntity } from './AcGiEntity'
import { AcGiHatchStyle } from './AcGiHatchStyle'
import { AcGiImageStyle } from './AcGiImageStyle'
import { AcGiLineStyle } from './AcGiLineStyle'
import { AcGiPointStyle } from './AcGiPointStyle'
import { AcGiMTextData, AcGiTextStyle } from './AcGiTextStyle'

/**
 * Font mappings.
 * - The key is the original font name
 * - The value is the mapped font name
 */
export type AcGiFontMapping = Record<string, string>

export interface AcGiRenderer<T extends AcGiEntity = AcGiEntity> {
  /**
   * JavaScript (and WebGL) use 64‑bit floating point numbers for CPU-side calculations,
   * but GPU shaders typically use 32‑bit floats. A 32-bit float has ~7.2 decimal digits
   * of precision. If passing 64-bit floating vertices data to GPU directly, it will
   * destroy number preciesion.
   *
   * So we adopt a simpler but effective version of the “origin-shift” idea. Recompute
   * geometry using re-centered coordinates and apply offset to its position. The base
   * point is extractly offset value.
   *
   * Get the rendering base point.
   * @returns Return the rendering base point.
   */
  get basePoint(): AcGePoint3d | undefined
  set basePoint(value: AcGePoint3d | undefined)

  /**
   * Create one group
   * @param entities Input entities to group together
   * @returns Return created group
   */
  group(entities: T[]): T

  /**
   * Draw a point.
   * @param point Input point to draw
   * @param style Input point style applied to point
   * @returns Return an object which can be added to scene
   */
  point(point: AcGePoint3d, style: AcGiPointStyle): T

  /**
   * Draw a circular arc or full circle.
   * @param arc Input circular arc to draw
   * @param style Input line style applied to circular arc
   * @returns Return an object which can be added to scene
   */
  circularArc(arc: AcGeCircArc3d, style: AcGiLineStyle): T

  /**
   * Draw an elliptical arc or full ellipse.
   * @param ellipseArc Input elliptical arc to draw
   * @param style Input line style applied to elliptical arc
   * @returns Return an object which can be added to scene
   */
  ellipticalArc(ellipseArc: AcGeEllipseArc3d, style: AcGiLineStyle): T

  /**
   * Draw lines using gl.LINE_STRIP.
   * @param points Input a point array which contains all line vertices
   * @param style Input line style applied to lines
   * @returns Return an object which can be added to scene
   */
  lines(points: AcGePoint3dLike[], style: AcGiLineStyle): T

  /**
   * Draw lines using gl.LINES.
   * @param array Must be a `TypedArray`. Used to instantiate the buffer. This array should have
   * `itemSize * numVertices` elements, where numVertices is the number of vertices.
   * @param itemSize The number of values of the {@link array} that should be associated with a
   * particular vertex. If the vertex is one 2d point, then itemSize should be `2`. If the vertex
   * is one 3d point, then itemSize should be `3`.
   * @param indices Index buffer.
   * @param style Input line style applied to line segments
   * @returns Return an object which can be added to scene
   */
  lineSegments(
    array: Float32Array,
    itemSize: number,
    indices: Uint16Array,
    style: AcGiLineStyle
  ): T

  /**
   * Draw one area
   * @param area Input area to draw
   * @param style Input hatch style applied to the area
   * @returns Return an object which can be added to scene
   */
  area(area: AcGeArea2d, style: AcGiHatchStyle): T

  /**
   * Draw multiple line texts
   * @param mtext Input multiple line text data to draw
   * @param style Input text style applied to the text string
   * @param delay The flag to delay creating one rendered entity and just create one dummy
   * entity. Renderer can delay heavy calculation operation to avoid blocking UI when this
   * flag is true.
   * @returns Return an object which can be added to scene
   */
  mtext(mtext: AcGiMTextData, style: AcGiTextStyle, delay?: boolean): T

  /**
   * Draw image
   * @param blob Input Blob instance of one image file
   * @param style Input image style
   * @returns Return an object which can be added to scene
   */
  image(blob: Blob, style: AcGiImageStyle): T

  /**
   * Set font mapping
   * @param Input font mapping to set
   */
  setFontMapping(mapping: AcGiFontMapping): void
}
