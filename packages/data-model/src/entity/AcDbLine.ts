import {
  AcGeBox3d,
  AcGeLine3d,
  AcGeMatrix3d,
  AcGePoint3d,
  AcGePoint3dLike
} from '@mlightcad/geometry-engine'
import { AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbOsnapMode } from '../misc/AcDbOsnapMode'
import { AcDbCurve } from './AcDbCurve'

/**
 * The class represents the line entity in AutoCAD. A line object is a 3d object
 * that is specified by its start point, endpoint, and normal vector.
 */
export class AcDbLine extends AcDbCurve {
  private _geo: AcGeLine3d
  /**
   * This constructor initializes the line object to use start as the start point, and end
   * as the endpoint. Both points must be in WCS coordinates.
   */
  constructor(start: AcGePoint3dLike, end: AcGePoint3dLike) {
    super()
    this._geo = new AcGeLine3d(start, end)
  }

  /**
   * The starting point of this line.
   */
  get startPoint(): AcGePoint3d {
    return this._geo.startPoint
  }
  set startPoint(value: AcGePoint3dLike) {
    this._geo.startPoint = value
  }

  /**
   * The end point of this line.
   */
  get endPoint(): AcGePoint3d {
    return this._geo.endPoint
  }
  set endPoint(value: AcGePoint3dLike) {
    this._geo.endPoint = value
  }

  /**
   * The middle point of this line.
   */
  get midPoint(): AcGePoint3d {
    return this._geo.midPoint
  }

  /**
   * @inheritdoc
   */
  get geometricExtents(): AcGeBox3d {
    return this._geo.box
  }

  /**
   * @inheritdoc
   */
  get closed(): boolean {
    return false
  }

  /**
   * @inheritdoc
   */
  subGetGripPoints() {
    const gripPoints = new Array<AcGePoint3d>()
    gripPoints.push(this.midPoint)
    gripPoints.push(this.startPoint)
    gripPoints.push(this.endPoint)
    return gripPoints
  }

  /**
   * @inheritdoc
   */
  subGetOsnapPoints(
    osnapMode: AcDbOsnapMode,
    _gsSelectionMark: number,
    pickPoint: AcGePoint3d,
    _lastPoint: AcGePoint3d,
    snapPoints: AcGePoint3d[]
  ) {
    const startPoint = this.startPoint
    const endPoint = this.endPoint

    switch (osnapMode) {
      case AcDbOsnapMode.EndPoint:
        snapPoints.push(startPoint)
        snapPoints.push(endPoint)
        break
      case AcDbOsnapMode.MidPoint:
        snapPoints.push(this.midPoint)
        break
      case AcDbOsnapMode.Nearest:
        // Nearest snap: project the pick point onto the line and return that point
        {
          const projectedPoint = this._geo.project(pickPoint)
          snapPoints.push(projectedPoint)
        }
        break
      case AcDbOsnapMode.Perpendicular:
        // Perpendicular snap: find a perpendicular point from the pick point to the line
        {
          const perpPoint = this._geo.perpPoint(pickPoint)
          snapPoints.push(perpPoint)
        }
        break
      case AcDbOsnapMode.Tangent:
        // Tangent snap: simply return an endpoint (depends on the geometry being connected)
        snapPoints.push(startPoint) // Example: return the start point as a tangent point
        break
      default:
        break
    }
  }

  /**
   * @inheritdoc
   */
  transformBy(matrix: AcGeMatrix3d) {
    this._geo.transform(matrix)
    return this
  }

  /**
   * @inheritdoc
   */
  draw(renderer: AcGiRenderer) {
    const start = this.startPoint
    const end = this.endPoint
    const points = [
      new AcGePoint3d(start.x, start.y, 0),
      new AcGePoint3d(end.x, end.y, 0)
    ]
    return renderer.lines(points, this.lineStyle)
  }
}
