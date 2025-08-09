import {
  AcGeBox3d,
  AcGePoint3d,
  AcGeVector3d
} from '@mlightcad/geometry-engine'
import { AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbCurve } from './AcDbCurve'

/**
 * Represents a ray entity in AutoCAD.
 * 
 * A ray is a 3D geometric object that extends infinitely in one direction from a base point.
 * Rays are commonly used for construction lines, reference lines, and temporary geometry.
 * Unlike lines, rays have no end point and extend to infinity.
 * 
 * @example
 * ```typescript
 * // Create a ray from origin in the positive X direction
 * const ray = new AcDbRay();
 * ray.basePoint = new AcGePoint3d(0, 0, 0);
 * ray.unitDir = new AcGeVector3d(1, 0, 0);
 * 
 * // Access ray properties
 * console.log(`Base point: ${ray.basePoint}`);
 * console.log(`Unit direction: ${ray.unitDir}`);
 * ```
 */
export class AcDbRay extends AcDbCurve {
  /** The base point of the ray */
  private _basePoint: AcGePoint3d
  /** The unit direction vector of the ray */
  private _unitDir: AcGeVector3d

  /**
   * Creates a new ray entity.
   * 
   * This constructor initializes a ray with default values.
   * The base point is at the origin and the unit direction is undefined.
   * 
   * @example
   * ```typescript
   * const ray = new AcDbRay();
   * ray.basePoint = new AcGePoint3d(5, 10, 0);
   * ray.unitDir = new AcGeVector3d(0, 1, 0); // Positive Y direction
   * ```
   */
  constructor() {
    super()
    this._basePoint = new AcGePoint3d()
    this._unitDir = new AcGeVector3d()
  }

  /**
   * Gets the base point of this ray.
   * 
   * The base point is the starting point from which the ray extends infinitely.
   * 
   * @returns The base point as a 3D point
   * 
   * @example
   * ```typescript
   * const basePoint = ray.basePoint;
   * console.log(`Ray base point: ${basePoint.x}, ${basePoint.y}, ${basePoint.z}`);
   * ```
   */
  get basePoint() {
    return this._basePoint
  }

  /**
   * Sets the base point of this ray.
   * 
   * @param value - The new base point
   * 
   * @example
   * ```typescript
   * ray.basePoint = new AcGePoint3d(10, 20, 0);
   * ```
   */
  set basePoint(value: AcGePoint3d) {
    this._basePoint.copy(value)
  }

  /**
   * Gets the unit direction vector of this ray.
   * 
   * The unit direction vector defines the direction in which the ray extends
   * infinitely from the base point.
   * 
   * @returns The unit direction vector
   * 
   * @example
   * ```typescript
   * const unitDir = ray.unitDir;
   * console.log(`Ray direction: ${unitDir.x}, ${unitDir.y}, ${unitDir.z}`);
   * ```
   */
  get unitDir() {
    return this._unitDir
  }

  /**
   * Sets the unit direction vector of this ray.
   * 
   * @param value - The new unit direction vector
   * 
   * @example
   * ```typescript
   * ray.unitDir = new AcGeVector3d(0, 0, 1); // Positive Z direction
   * ```
   */
  set unitDir(value: AcGePoint3d) {
    this._unitDir.copy(value)
  }

  /**
   * Gets whether this ray is closed.
   * 
   * Rays are always open entities, so this always returns false.
   * 
   * @returns Always false for rays
   */
  get closed(): boolean {
    return false
  }

  /**
   * Gets the geometric extents (bounding box) of this ray.
   * 
   * Since rays extend infinitely, this method returns a bounding box that
   * encompasses a finite portion of the ray for practical purposes.
   * 
   * @returns The bounding box that encompasses a portion of the ray
   * 
   * @example
   * ```typescript
   * const extents = ray.geometricExtents;
   * console.log(`Ray bounds: ${extents.minPoint} to ${extents.maxPoint}`);
   * ```
   */
  get geometricExtents(): AcGeBox3d {
    const extents = new AcGeBox3d()
    extents.expandByPoint(
      this._unitDir.clone().multiplyScalar(10).add(this._basePoint)
    )
    extents.expandByPoint(
      this._unitDir.clone().multiplyScalar(-10).add(this._basePoint)
    )
    return extents
  }

  /**
   * Gets the grip points for this ray.
   * 
   * Grip points are control points that can be used to modify the ray.
   * For a ray, the grip point is the base point.
   * 
   * @returns Array of grip points (base point)
   * 
   * @example
   * ```typescript
   * const gripPoints = ray.subGetGripPoints();
   * // gripPoints contains: [basePoint]
   * ```
   */
  subGetGripPoints() {
    const gripPoints = new Array<AcGePoint3d>()
    gripPoints.push(this.basePoint)
    return gripPoints
  }

  /**
   * Draws this ray using the specified renderer.
   * 
   * This method renders the ray as a line segment extending from the base point
   * in the direction of the unit vector. For practical purposes, the ray is
   * drawn with a finite length.
   * 
   * @param renderer - The renderer to use for drawing
   * @returns The rendered ray entity, or undefined if drawing failed
   * 
   * @example
   * ```typescript
   * const renderedRay = ray.draw(renderer);
   * ```
   */
  draw(renderer: AcGiRenderer) {
    const points: AcGePoint3d[] = []
    points.push(this.basePoint)
    points.push(
      this._unitDir.clone().multiplyScalar(1000000).add(this._basePoint)
    )
    return renderer.lines(points, this.lineStyle)
  }
}
