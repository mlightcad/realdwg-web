import {
  AcGeBox3d,
  AcGePoint3d,
  AcGePointLike
} from '@mlightcad/geometry-engine'

import { AcDbDimension } from './AcDbDimension'

/**
 * This represents the angular dimension defined by three points.
 */
export class AcDb3PointAngularDimension extends AcDbDimension {
  private _arcPoint: AcGePoint3d
  private _centerPoint: AcGePoint3d
  private _xLine1Point: AcGePoint3d
  private _xLine2Point: AcGePoint3d

  /**
   * Create one instance of this class.
   * @param centerPoint Input the center of the arc being dimensioned
   * @param xLine1Point Input the first extension line end point
   * @param xLine2Point Input the second extension line end point
   * @param arcPoint Input point on arc being dimensioned
   * @param dimText Input dimension text to use instead of calculated value
   * @param dimStyle Input string name of dimension style table record to use
   */
  constructor(
    centerPoint: AcGePointLike,
    xLine1Point: AcGePointLike,
    xLine2Point: AcGePointLike,
    arcPoint: AcGePointLike,
    dimText: string | null = null,
    dimStyle: string | null = null
  ) {
    super()
    this._centerPoint = new AcGePoint3d().copy(centerPoint)
    this._xLine1Point = new AcGePoint3d().copy(xLine1Point)
    this._xLine2Point = new AcGePoint3d().copy(xLine2Point)
    this._arcPoint = new AcGePoint3d().copy(arcPoint)

    this.dimensionText = dimText
    // TODO: Set it to the current default dimStyle within the AutoCAD editor if dimStyle is null
    this.dimensionStyleName = dimStyle
  }

  /**
   * A point on the arc length dimension's dimension arc.
   */
  get arcPoint() {
    return this._arcPoint
  }
  set arcPoint(value: AcGePoint3d) {
    this._arcPoint.copy(value)
  }

  /**
   * The center point of the arc dimensioned by the arc length dimension.
   */
  get centerPoint() {
    return this._centerPoint
  }
  set centerPoint(value: AcGePoint3d) {
    this._centerPoint.copy(value)
  }

  /**
   * The start point for the first extension line of the dimension.
   */
  get xLine1Point() {
    return this._xLine1Point
  }
  set xLine1Point(value: AcGePoint3d) {
    this._xLine1Point.copy(value)
  }

  /**
   * The start point for the second extension line of the dimension.
   */
  get xLine2Point() {
    return this._xLine2Point
  }
  set xLine2Point(value: AcGePoint3d) {
    this._xLine2Point.copy(value)
  }

  /**
   * @inheritdoc
   */
  get geometricExtents() {
    // TODO: Finish it
    return new AcGeBox3d()
  }
}
