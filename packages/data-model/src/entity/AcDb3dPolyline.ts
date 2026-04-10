import {
  AcGeBox3d,
  AcGeMatrix3d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGePolyline2d,
  AcGePolyline2dVertex
} from '@mlightcad/geometry-engine'
import { AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbDxfFiler } from '../base'
import { AcDbOsnapMode } from '../misc'
import { AcDbCurve } from './AcDbCurve'
import { AcDbEntityProperties } from './AcDbEntityProperties'

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

  override get dxfTypeName() {
    return 'POLYLINE'
  }

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

  get numberOfVertices() {
    return this._geo.numberOfVertices
  }

  getPointAt(index: number) {
    const vertex = this._geo.vertices[index] as AcGePolyline2dVertex &
      AcGePoint3dLike
    return new AcGePoint3d(vertex.x, vertex.y, vertex.z || 0)
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
    const points = this._geo.vertices.map(
      vertex =>
        new AcGePoint3d(vertex.x, vertex.y, (vertex as AcGePoint3dLike).z || 0)
    )
    return new AcGeBox3d().setFromPoints(points)
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
    for (let i = 0; i < this._geo.numberOfVertices; ++i) {
      const temp = this._geo.getPointAt(i)
      gripPoints.push(new AcGePoint3d(temp.x, temp.y, 0))
    }
    return gripPoints
  }

  /**
   * Gets the object snap points for this polyline.
   *
   * Object snap points are precise points that can be used for positioning
   * when drawing or editing. This method provides snap points based on the
   * specified snap mode.
   *
   * @param osnapMode - The object snap mode
   * @param _pickPoint - The point where the user picked
   * @param _lastPoint - The last point
   * @param snapPoints - Array to populate with snap points
   */
  subGetOsnapPoints(
    osnapMode: AcDbOsnapMode,
    _pickPoint: AcGePoint3dLike,
    _lastPoint: AcGePoint3dLike,
    snapPoints: AcGePoint3dLike[]
  ) {
    switch (osnapMode) {
      case AcDbOsnapMode.EndPoint:
        {
          for (let i = 0; i < this._geo.numberOfVertices; ++i) {
            snapPoints.push(this.getPointAt(i))
          }
        }
        break
      default:
        break
    }
  }

  /**
   * Transforms this 3D polyline by the specified matrix.
   */
  transformBy(matrix: AcGeMatrix3d) {
    this._geo.vertices.forEach(vertex => {
      const transformedPoint = new AcGePoint3d(
        vertex.x,
        vertex.y,
        (vertex as AcGePoint3dLike).z || 0
      ).applyMatrix4(matrix)
      vertex.x = transformedPoint.x
      vertex.y = transformedPoint.y
      ;(vertex as AcGePoint3dLike).z = transformedPoint.z
    })
    ;(
      this._geo as AcGePolyline2d<AcGePolyline2dVertex> & {
        _boundingBoxNeedsUpdate: boolean
      }
    )._boundingBoxNeedsUpdate = true
    return this
  }

  /**
   * Returns the full property definition for this polyline entity, including
   * general group and geometry group.
   *
   * The geometry group exposes properties via {@link AcDbPropertyAccessor} so
   * the property palette can update the polyline in real-time.
   *
   * Each property is an {@link AcDbEntityRuntimeProperty}.
   */
  get properties(): AcDbEntityProperties {
    return {
      type: this.type,
      groups: [
        this.getGeneralProperties(),
        {
          groupName: 'geometry',
          properties: [
            {
              name: 'vertices',
              type: 'array',
              editable: false,
              itemSchema: {
                properties: [
                  {
                    name: 'x',
                    type: 'float',
                    editable: true
                  },
                  {
                    name: 'y',
                    type: 'float',
                    editable: true
                  },
                  {
                    name: 'z',
                    type: 'float',
                    editable: true
                  }
                ]
              },
              accessor: {
                get: () => this._geo.vertices
              }
            },
            {
              name: 'length',
              type: 'float',
              editable: false,
              accessor: {
                get: () => this._geo.length
              }
            }
          ]
        },
        {
          groupName: 'others',
          properties: [
            {
              name: 'closed',
              type: 'float',
              editable: true,
              accessor: {
                get: () => this.closed,
                set: (v: boolean) => {
                  this.closed = v
                }
              }
            }
          ]
        }
      ]
    }
  }

  /**
   * Draws this polyline using the specified renderer.
   *
   * @param renderer - The renderer to use for drawing
   * @returns The rendered polyline entity, or undefined if drawing failed
   */
  subWorldDraw(renderer: AcGiRenderer) {
    const points = this._geo.vertices.map(
      vertex =>
        new AcGePoint3d(vertex.x, vertex.y, (vertex as AcGePoint3dLike).z || 0)
    )
    return renderer.lines(points)
  }

  /**
   * Writes the DXF record for the polyline, plus VERTEX/SEQEND records.
   *
   * The extra records are required by the legacy POLYLINE entity format.
   *
   * @param filer - DXF output writer.
   * @param allXdata - When true, emits all XData attached to this entity.
   * @returns The entity instance (for chaining).
   */
  /**
   * Writes this object to the DXF output.
   *
   * @param filer - DXF output writer.
   * @param allXdata - When true, emits all XData attached to this object.
   * @returns The instance (for chaining).
   */
  override dxfOut(filer: AcDbDxfFiler, allXdata = false) {
    super.dxfOut(filer, allXdata)
    for (let i = 0; i < this.numberOfVertices; ++i) {
      const point = this.getPointAt(i)
      filer.writeStart('VERTEX')
      filer.writeHandle(5, this.database.generateHandle())
      filer.writeObjectId(330, this.objectId)
      filer.writeSubclassMarker('AcDbEntity')
      filer.writeSubclassMarker('AcDbVertex')
      filer.writeSubclassMarker('AcDb3dPolylineVertex')
      filer.writePoint3d(10, {
        x: point.x,
        y: point.y,
        z: point.z
      })
      filer.writeInt16(70, 32)
    }
    filer.writeStart('SEQEND')
    filer.writeHandle(5, this.database.generateHandle())
    filer.writeObjectId(330, this.objectId)
    filer.writeSubclassMarker('AcDbEntity')
    return this
  }

  /**
   * Writes the POLYLINE entity fields (header) for a 3D polyline.
   *
   * @param filer - DXF output writer.
   * @returns The entity instance (for chaining).
   */
  /**
   * Writes DXF fields for this object.
   *
   * @param filer - DXF output writer.
   * @returns The instance (for chaining).
   */
  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDb3dPolyline')
    let flag = this.closed ? 1 : 0
    flag |= 8
    if (this.polyType === AcDbPoly3dType.QuadSplinePoly) flag |= 16
    if (this.polyType === AcDbPoly3dType.CubicSplinePoly) flag |= 32
    filer.writeInt16(66, this.numberOfVertices > 0 ? 1 : 0)
    filer.writeInt16(70, flag)
    return this
  }
}
