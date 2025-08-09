import {
  AcGeBox3d,
  AcGeMatrix3d,
  AcGePoint3d,
  AcGePointLike
} from '@mlightcad/geometry-engine'
import { AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbEntity } from './AcDbEntity'

/**
 * Represents a point entity in AutoCAD.
 * 
 * A point is a 0-dimensional geometric object defined by its position in 3D space.
 * Points are fundamental drawing entities that can be used to mark specific
 * locations in drawings or as reference points for other entities.
 * 
 * @example
 * ```typescript
 * // Create a point at the origin
 * const point = new AcDbPoint();
 * point.position = new AcGePoint3d(0, 0, 0);
 * 
 * // Create a point at a specific location
 * const point2 = new AcDbPoint();
 * point2.position = new AcGePoint3d(10, 20, 5);
 * 
 * // Access point properties
 * console.log(`Point position: ${point.position}`);
 * ```
 */
export class AcDbPoint extends AcDbEntity {
  /** The underlying geometric point object */
  private _geo: AcGePoint3d

  /**
   * Creates a new point entity.
   * 
   * This constructor initializes a point object at the origin (0,0,0).
   * The position can be set after creation using the position property.
   * 
   * @example
   * ```typescript
   * const point = new AcDbPoint();
   * point.position = new AcGePoint3d(5, 10, 0);
   * ```
   */
  constructor() {
    super()
    this._geo = new AcGePoint3d()
  }

  /**
   * Gets the position of this point in WCS coordinates.
   * 
   * @returns The position as a 3D point
   * 
   * @example
   * ```typescript
   * const position = point.position;
   * console.log(`Point at: ${position.x}, ${position.y}, ${position.z}`);
   * ```
   */
  get position(): AcGePoint3d {
    return this._geo
  }

  /**
   * Sets the position of this point in WCS coordinates.
   * 
   * @param value - The new position
   * 
   * @example
   * ```typescript
   * point.position = new AcGePoint3d(15, 25, 0);
   * ```
   */
  set position(value: AcGePointLike) {
    this._geo.set(value.x, value.y, value.z || 0)
  }

  /**
   * Gets the geometric extents (bounding box) of this point.
   * 
   * For a point, the bounding box is a minimal box that contains just the point.
   * 
   * @returns The bounding box that encompasses the point
   * 
   * @example
   * ```typescript
   * const extents = point.geometricExtents;
   * console.log(`Point bounds: ${extents.minPoint} to ${extents.maxPoint}`);
   * ```
   */
  get geometricExtents(): AcGeBox3d {
    return new AcGeBox3d().expandByPoint(this._geo)
  }

  /**
   * Transforms this point by the specified matrix.
   * 
   * This method applies a geometric transformation to the point, updating
   * its position according to the transformation matrix.
   * 
   * @param matrix - The transformation matrix to apply
   * @returns This point after transformation
   * 
   * @example
   * ```typescript
   * const translationMatrix = AcGeMatrix3d.translation(10, 0, 0);
   * point.transformBy(translationMatrix);
   * // Point is now translated 10 units in the X direction
   * ```
   */
  transformBy(matrix: AcGeMatrix3d) {
    this._geo.applyMatrix3d(matrix)
    return this
  }

  /**
   * Draws this point using the specified renderer.
   * 
   * This method renders the point using the point's current style properties,
   * including the display mode and size from the database.
   * 
   * @param renderer - The renderer to use for drawing
   * @returns The rendered point entity, or undefined if drawing failed
   * 
   * @example
   * ```typescript
   * const renderedPoint = point.draw(renderer);
   * ```
   */
  draw(renderer: AcGiRenderer) {
    return renderer.point(this._geo, {
      displayMode: this.database.pdmode,
      displaySize: this.database.pdsize,
      color: this.rgbColor
    })
  }
}
