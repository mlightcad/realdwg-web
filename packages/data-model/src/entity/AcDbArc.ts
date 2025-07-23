import {
  AcGeCircArc3d,
  AcGeMatrix3d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGeVector3d
} from '@mlightcad/geometry-engine'
import { AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbCurve } from './AcDbCurve'

/**
 * The class represents the arc entity in AutoCAD.
 */
export class AcDbArc extends AcDbCurve {
  private _geo: AcGeCircArc3d

  /**
   * This constructor creates an arc using the values passed in. 'center' must be in WCS coordinates.
   *
   * @param center Input center point of the arc
   * @param radius Input radius of the arc
   * @param startAngle Input starting angle in radians of the arc
   * @param endAngle Input ending angle in radians of the arc
   */
  constructor(
    center: AcGePoint3dLike,
    radius: number,
    startAngle: number,
    endAngle: number
  ) {
    super()
    this._geo = new AcGeCircArc3d(
      center,
      radius,
      startAngle,
      endAngle,
      AcGeVector3d.Z_AXIS,
      AcGeVector3d.X_AXIS
    )
  }

  /**
   * Center point of circular arc
   */
  get center(): AcGePoint3d {
    return this._geo.center
  }
  set center(value: AcGePoint3dLike) {
    this._geo.center = value
  }

  /**
   * Radius of circular arc
   */
  get radius(): number {
    return this._geo.radius
  }
  set radius(value: number) {
    this._geo.radius = value
  }

  /**
   * Start angle in radians of circular arc
   */
  get startAngle(): number {
    return this._geo.startAngle
  }
  set startAngle(value: number) {
    this._geo.startAngle = value
  }

  /**
   * End angle in radians of circular arc
   */
  get endAngle(): number {
    return this._geo.endAngle
  }
  set endAngle(value: number) {
    this._geo.endAngle = value
  }

  /**
   * Start point of circular arc
   */
  get startPoint(): AcGePoint3d {
    return this._geo.startPoint
  }

  /**
   * Get end point of circular arc
   */
  get endPoint(): AcGePoint3d {
    return this._geo.endPoint
  }

  /**
   * @inheritdoc
   */
  get geometricExtents() {
    return this._geo.box
  }

  /**
   * @inheritdoc
   */
  get closed(): boolean {
    return this._geo.closed
  }

  /**
   * @inheritdoc
   */
  subGetGripPoints() {
    const gripPoints = new Array<AcGePoint3d>()
    gripPoints.push(this.center)
    gripPoints.push(this.startPoint)
    gripPoints.push(this.endPoint)
    return gripPoints
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
    return renderer.circularArc(this._geo, this.lineStyle)
  }
}
