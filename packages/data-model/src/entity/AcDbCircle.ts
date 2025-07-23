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
 * The class represents the circle entity in AutoCAD.
 */
export class AcDbCircle extends AcDbCurve {
  private _geo: AcGeCircArc3d

  /**
   * This constructor creates an arc using the values passed in. 'center' must be in WCS coordinates.
   *
   * @param center Input center point of the arc
   * @param radius Input radius of the arc
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
   * Arc's unit normal vector in WCS coordinates.
   */
  get normal() {
    return this._geo.normal
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
