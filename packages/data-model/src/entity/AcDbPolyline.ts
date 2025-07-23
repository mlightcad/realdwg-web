import {
  AcGeBox3d,
  AcGePoint2d,
  AcGePoint3d,
  AcGePolyline2d,
  AcGePolyline2dVertex
} from '@mlightcad/geometry-engine'
import { AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbCurve } from './AcDbCurve'

/**
 * The class represents one vertex of the polyline entity in AutoCAD.
 */
interface AcDbPolylineVertex extends AcGePolyline2dVertex {
  startWidth?: number
  endWidth?: number
}

/**
 * The class represents the polyline entity in AutoCAD. A lightweight polyline has:
 * - Straight line segments
 * - Bulge (arc segments)
 * - Constant and variable width
 * - Thickness
 */
export class AcDbPolyline extends AcDbCurve {
  private _elevation: number
  private _geo: AcGePolyline2d<AcDbPolylineVertex>

  /**
   * Create one empty polyline
   */
  constructor() {
    super()
    this._elevation = 0
    this._geo = new AcGePolyline2d()
  }

  /**
   * The number of vertices in the polyline
   */
  get numberOfVertices(): number {
    return this._geo.numberOfVertices
  }

  /**
   * The distance of the polyline's plane from the WCS origin.
   */
  get elevation(): number {
    return this._elevation
  }
  set elevation(value: number) {
    this._elevation = value
  }

  /**
   * The flag to indicate whether the polyline is closed (that is, there is a segment drawn from the
   * last vertex to the first) if 'value' is true. Set the polyline to be open (no segment between
   * the last and first vertices) if 'value' is false.
   */
  get closed(): boolean {
    return this._geo.closed
  }
  set closed(value: boolean) {
    this._geo.closed = value
  }

  /**
   * This function adds a vertex to the polyline. If index is 0, the vertex will become the first
   * vertex of the polyline. If index is the value returned by AcDbPolyline.numberOfVertices,
   * then the vertex will become the last vertex of the polyline. Otherwise the vertex will be
   * added just before the index vertex.
   *
   * @param index Input index (0 based) before which to insert the vertex
   * @param pt Input vertex location point
   * @param bulge Input bulge value for vertex
   * @param startWidth Input start width for vertex
   * @param endWidth Input end width for vertex
   */
  addVertexAt(
    index: number,
    pt: AcGePoint2d,
    bulge: number = 0,
    startWidth: number = -1,
    endWidth: number = -1
  ) {
    const newStartWidth = startWidth < 0 ? undefined : startWidth
    const newEndWidth = endWidth < 0 ? undefined : endWidth
    const vertex: AcDbPolylineVertex = {
      x: pt.x,
      y: pt.y,
      bulge: bulge,
      startWidth: newStartWidth,
      endWidth: newEndWidth
    }
    this._geo.addVertexAt(index, vertex)
  }

  /**
   * Get the 2D location of the vertex index in the polyline's own object coordinate system (OCS).
   *
   * @param index Input index (0 based) of the vertex
   */
  getPoint2dAt(index: number): AcGePoint2d {
    return this._geo.getPointAt(index)
  }

  /**
   * Get the 3D location of the vertex index in World Coordinates.
   *
   * @param index Input index (0 based) of the vertex
   */
  getPoint3dAt(index: number): AcGePoint3d {
    const vertex = this.getPoint2dAt(index)
    return new AcGePoint3d(vertex.x, vertex.y, this._elevation)
  }

  /**
   * @inheritdoc
   */
  get geometricExtents(): AcGeBox3d {
    const box = this._geo.box
    return new AcGeBox3d(
      { x: box.min.x, y: box.min.y, z: this._elevation },
      { x: box.max.x, y: box.max.y, z: this._elevation }
    )
  }

  /**
   * @inheritdoc
   */
  subGetGripPoints() {
    const gripPoints = new Array<AcGePoint3d>()
    for (let index = 0; index < this.numberOfVertices; ++index) {
      gripPoints.push(this.getPoint3dAt(index))
    }
    return gripPoints
  }

  /**
   * @inheritdoc
   */
  draw(renderer: AcGiRenderer) {
    const points: AcGePoint3d[] = []
    const tmp = this._geo.getPoints(100)
    tmp.forEach(point =>
      points.push(new AcGePoint3d().set(point.x, point.y, this.elevation))
    )
    return renderer.lines(points, this.lineStyle)
  }
}
