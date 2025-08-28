import {
  AcGeCircArc3d,
  AcGeMatrix3d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGePointLike,
  AcGeVector3d,
  TAU
} from '@mlightcad/geometry-engine'
import { AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbCurve } from './AcDbCurve'

/**
 * Represents a circle entity in AutoCAD.
 *
 * A circle is a 2D geometric object defined by its center point and radius.
 * Circles are closed curves that can be used to create circular shapes
 * in drawings. The circle is always drawn in the plane defined by its normal vector.
 *
 * @example
 * ```typescript
 * // Create a circle with center at (0,0,0) and radius 5
 * const circle = new AcDbCircle(
 *   new AcGePoint3d(0, 0, 0),
 *   5
 * );
 *
 * // Access circle properties
 * console.log(`Center: ${circle.center}`);
 * console.log(`Radius: ${circle.radius}`);
 * console.log(`Normal: ${circle.normal}`);
 * ```
 */
export class AcDbCircle extends AcDbCurve {
  /** The entity type name */
  static override typeName: string = 'Circle'

  /** The underlying geometric circular arc object */
  private _geo: AcGeCircArc3d

  /**
   * Creates a new circle entity.
   *
   * This constructor creates a circle using the specified center point and radius.
   * The center point must be in World Coordinate System (WCS) coordinates.
   * The circle is created as a full circle (0 to 2π radians).
   *
   * @param center - The center point of the circle in WCS coordinates
   * @param radius - The radius of the circle (must be positive)
   * @param normal - The normal vector defining the plane of the circle (defaults to Z-axis)
   *
   * @example
   * ```typescript
   * // Create a circle in the XY plane
   * const circle = new AcDbCircle(
   *   new AcGePoint3d(10, 20, 0),
   *   15
   * );
   *
   * // Create a circle in a different plane
   * const circleInYZ = new AcDbCircle(
   *   new AcGePoint3d(0, 0, 0),
   *   10,
   *   AcGeVector3d.X_AXIS
   * );
   * ```
   */
  constructor(
    center: AcGePointLike,
    radius: number,
    normal: AcGeVector3d = AcGeVector3d.Z_AXIS
  ) {
    super()
    this._geo = new AcGeCircArc3d(
      center,
      radius,
      0,
      TAU,
      normal,
      AcGeVector3d.X_AXIS
    )
  }

  /**
   * Gets the center point of this circle.
   *
   * @returns The center point as a 3D point
   *
   * @example
   * ```typescript
   * const centerPoint = circle.center;
   * console.log(`Circle center: ${centerPoint.x}, ${centerPoint.y}, ${centerPoint.z}`);
   * ```
   */
  get center(): AcGePoint3d {
    return this._geo.center
  }

  /**
   * Sets the center point of this circle.
   *
   * @param value - The new center point
   *
   * @example
   * ```typescript
   * circle.center = new AcGePoint3d(5, 5, 0);
   * ```
   */
  set center(value: AcGePoint3dLike) {
    this._geo.center = value
  }

  /**
   * Gets the radius of this circle.
   *
   * @returns The radius value
   *
   * @example
   * ```typescript
   * const radius = circle.radius;
   * console.log(`Circle radius: ${radius}`);
   * ```
   */
  get radius(): number {
    return this._geo.radius
  }

  /**
   * Sets the radius of this circle.
   *
   * @param value - The new radius value (must be positive)
   *
   * @example
   * ```typescript
   * circle.radius = 25;
   * ```
   */
  set radius(value: number) {
    this._geo.radius = value
  }

  /**
   * Gets the normal vector of this circle.
   *
   * The normal vector defines the plane in which the circle lies.
   *
   * @returns The unit normal vector in WCS coordinates
   *
   * @example
   * ```typescript
   * const normal = circle.normal;
   * console.log(`Circle normal: ${normal.x}, ${normal.y}, ${normal.z}`);
   * ```
   */
  get normal() {
    return this._geo.normal
  }

  /**
   * Gets the geometric extents (bounding box) of this circle.
   *
   * @returns The bounding box that encompasses the entire circle
   *
   * @example
   * ```typescript
   * const extents = circle.geometricExtents;
   * console.log(`Circle bounds: ${extents.minPoint} to ${extents.maxPoint}`);
   * ```
   */
  get geometricExtents() {
    return this._geo.box
  }

  /**
   * Gets whether this circle is closed.
   *
   * Circles are always closed entities, so this always returns true.
   *
   * @returns Always true for circles
   */
  get closed(): boolean {
    return this._geo.closed
  }

  /**
   * Gets the grip points for this circle.
   *
   * Grip points are control points that can be used to modify the circle.
   * For a circle, the grip point is the center point.
   *
   * @returns Array of grip points (center point)
   *
   * @example
   * ```typescript
   * const gripPoints = circle.subGetGripPoints();
   * // gripPoints contains: [center]
   * ```
   */
  subGetGripPoints() {
    const gripPoints = new Array<AcGePoint3d>()
    gripPoints.push(this.center)
    return gripPoints
  }

  /**
   * Transforms this circle by the specified matrix.
   *
   * This method applies a geometric transformation to the circle, updating
   * the center point, radius, and normal vector according to the transformation matrix.
   *
   * @param matrix - The transformation matrix to apply
   * @returns This circle after transformation
   *
   * @example
   * ```typescript
   * const translationMatrix = AcGeMatrix3d.translation(10, 0, 0);
   * circle.transformBy(translationMatrix);
   * // Circle is now translated 10 units in the X direction
   * ```
   */
  transformBy(matrix: AcGeMatrix3d) {
    this._geo.transform(matrix)
    return this
  }

  /**
   * Draws this circle using the specified renderer.
   *
   * This method renders the circle as a circular arc using the circle's
   * current style properties.
   *
   * @param renderer - The renderer to use for drawing
   * @returns The rendered circle entity, or undefined if drawing failed
   *
   * @example
   * ```typescript
   * const renderedCircle = circle.draw(renderer);
   * ```
   */
  draw(renderer: AcGiRenderer) {
    return renderer.circularArc(this._geo, this.lineStyle)
  }
}
