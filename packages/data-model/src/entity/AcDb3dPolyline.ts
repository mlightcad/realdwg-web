import {
  AcGeBox3d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGePolyline2d,
  AcGePolyline2dVertex
} from '@mlightcad/geometry-engine'
import { AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbCurve } from './AcDbCurve'

/**
 * Represents the spline-fit type for this 3D polyline.
 */
export enum AcDbPoly3dType {
  /**
   * A standard polyline with no spline fitting.
   */
  SimplePoly,
  /**
   * A spline-fit polyline that has a Quadratic B-spline path.
   */
  QuadSplinePoly,
  /**
   * A spline-fit polyline that has a Cubic B-spline path.
   */
  CubicSplinePoly
}

/**
 * Represents a 3d polyline entity in AutoCAD.
 */
export class AcDb3dPolyline extends AcDbCurve {
  /** The entity type name */
  static override typeName: string = '3dPolyline'

  /** The spline-fit type for this 3D polyline */
  private _polyType: AcDbPoly3dType
  /** The underlying geometric polyline object */
  private _geo: AcGePolyline2d<AcGePolyline2dVertex>

  /**
   * Creates a new empty 2d polyline entity.
   */
  constructor(
    type: AcDbPoly3dType,
    vertices: AcGePoint3dLike[],
    closed = false
  ) {
    super()
    this._polyType = type
    this._geo = new AcGePolyline2d(vertices, closed)
  }

  /**
   * Gets the spline-fit type for this 3D polyline.
   *
   * @returns The spline-fit type for this 3D polyline.
   */
  get polyType(): AcDbPoly3dType {
    return this._polyType
  }

  /**
   * Sets the spline-fit type for this 3D polyline.
   *
   * @param value - The spline-fit type for this 3D polyline.
   */
  set polyType(value: AcDbPoly3dType) {
    this._polyType = value
  }

  /**
   * Gets whether this polyline is closed.
   *
   * A closed polyline has a segment drawn from the last vertex to the first vertex,
   * forming a complete loop.
   *
   * @returns True if the polyline is closed, false otherwise
   *
   * @example
   * ```typescript
   * const isClosed = polyline.closed;
   * console.log(`Polyline is closed: ${isClosed}`);
   * ```
   */
  get closed(): boolean {
    return this._geo.closed
  }

  /**
   * Sets whether this polyline is closed.
   *
   * @param value - True to close the polyline, false to open it
   *
   * @example
   * ```typescript
   * polyline.closed = true; // Close the polyline
   * ```
   */
  set closed(value: boolean) {
    this._geo.closed = value
  }

  /**
   * Gets the geometric extents (bounding box) of this polyline.
   *
   * @returns The bounding box that encompasses the entire polyline
   *
   * @example
   * ```typescript
   * const extents = polyline.geometricExtents;
   * console.log(`Polyline bounds: ${extents.minPoint} to ${extents.maxPoint}`);
   * ```
   */
  get geometricExtents(): AcGeBox3d {
    const box = this._geo.box
    // TODO: Set the correct z value for 3d box
    return new AcGeBox3d(
      { x: box.min.x, y: box.min.y, z: 0 },
      { x: box.max.x, y: box.max.y, z: 0 }
    )
  }

  /**
   * Gets the grip points for this polyline.
   *
   * Grip points are control points that can be used to modify the polyline.
   * For a polyline, the grip points are all the vertices.
   *
   * @returns Array of grip points (all vertices)
   */
  subGetGripPoints() {
    const gripPoints = new Array<AcGePoint3d>()
    // TODO: Finish logic to get grip points
    return gripPoints
  }

  /**
   * Draws this polyline using the specified renderer.
   *
   * @param renderer - The renderer to use for drawing
   * @returns The rendered polyline entity, or undefined if drawing failed
   */
  draw(renderer: AcGiRenderer) {
    const points: AcGePoint3d[] = []
    const tmp = this._geo.getPoints(100)
    // TODO: Set the correct z value
    tmp.forEach(point =>
      points.push(new AcGePoint3d().set(point.x, point.y, 0))
    )
    return renderer.lines(points, this.lineStyle)
  }
}
