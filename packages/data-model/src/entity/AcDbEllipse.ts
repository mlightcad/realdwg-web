import {
  AcGeEllipseArc3d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGePointLike,
  AcGeVector3dLike
} from '@mlightcad/geometry-engine'
import { AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbCurve } from './AcDbCurve'

/**
 * The class represents the ellipse entity in AutoCAD.
 */
export class AcDbEllipse extends AcDbCurve {
  private _geo: AcGeEllipseArc3d
  /**
   * Construct an instance of this class.
   * @param center - Center point of the ellipse.
   * @param normal - Normal vector defining the plane of the ellipse.
   * @param majorAxis Major axis vector (in WCS coordinates) of the ellipse.
   * @param majorAxisRadius - Radius of the major axis of the ellipse.
   * @param minorAxisRadius - Radius of the minor axis of the ellipse.
   * @param startAngle - Start angle of the ellipse arc in radians.
   * @param endAngle - End angle of the ellipse arc in radians.
   */
  constructor(
    center: AcGePointLike,
    normal: AcGeVector3dLike,
    majorAxis: AcGeVector3dLike,
    majorAxisRadius: number,
    minorAxisRadius: number,
    startAngle: number,
    endAngle: number
  ) {
    super()
    this._geo = new AcGeEllipseArc3d(
      center,
      normal,
      majorAxis,
      majorAxisRadius,
      minorAxisRadius,
      startAngle,
      endAngle
    )
  }

  /**
   * Center of ellipse
   */
  get center(): AcGePoint3d {
    return this._geo.center
  }
  set center(value: AcGePoint3dLike) {
    this._geo.center = value
  }

  /**
   * Major axis radius of epllise
   */
  get majorAxisRadius(): number {
    return this._geo.majorAxisRadius
  }
  set majorAxisRadius(value: number) {
    this._geo.majorAxisRadius = value
  }

  /**
   * Minor axis radius of epllise
   */
  get minorAxisRadius(): number {
    return this._geo.minorAxisRadius
  }
  set minorAxisRadius(value: number) {
    this._geo.minorAxisRadius = value
  }

  /**
   * Unit normal vector (in WCS coordinates) of the ellipse.
   */
  get normal() {
    return this._geo.normal
  }
  set normal(value: AcGeVector3dLike) {
    this._geo.normal = value
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
  draw(renderer: AcGiRenderer) {
    return renderer.ellipticalArc(this._geo, this.lineStyle)
  }
}
