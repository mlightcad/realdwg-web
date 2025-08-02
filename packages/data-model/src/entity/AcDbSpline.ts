import { AcCmErrors } from '@mlightcad/common'
import {
  AcGeKnotParameterizationType,
  AcGePointLike,
  AcGeSpline3d
} from '@mlightcad/geometry-engine'
import { AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbCurve } from './AcDbCurve'

/**
 * The class represents the spline entity in AutoCAD.
 */
export class AcDbSpline extends AcDbCurve {
  private _geo: AcGeSpline3d

  /**
   * Construct an instance of the spline entity.
   * @param controlPoints Input an array of control points (in WCS coordinates) of the spline
   * @param knots Input an array of numbers that specifies the knot values of the spline
   * @param weights Input an array of doubles that specifies the weights at each control point.
   * Default weight of 1 if weights are not provided
   * @param closed Whether the spline should be closed. Default is false
   */
  constructor(
    controlPoints: AcGePointLike[],
    knots: number[],
    weights?: number[],
    closed?: boolean
  )
  /**
   * Construct an instance of the spline entity.
   * @param fitPoints Input an array of points (in WCS coordinates) through which to fit the curve
   * @param knotParam Input knot parameterization which define the knot values
   * @param closed Whether the spline should be closed. Default is false
   */
  constructor(
    fitPoints: AcGePointLike[],
    knotParam: AcGeKnotParameterizationType,
    closed?: boolean
  )
  constructor(a?: unknown, b?: unknown, c?: unknown, d?: unknown) {
    super()
    const argsLength =
      +(a !== undefined) +
      +(b !== undefined) +
      +(c !== undefined) +
      +(d !== undefined)

    if (argsLength < 2 || argsLength > 4) {
      throw AcCmErrors.ILLEGAL_PARAMETERS
    }

    // Determine if this is the fitPoints constructor (2 or 3 args, second arg is not an array)
    const isFitPointsConstructor = argsLength <= 3 && !Array.isArray(b)

    if (isFitPointsConstructor) {
      this._geo = new AcGeSpline3d(
        a as AcGePointLike[],
        b as AcGeKnotParameterizationType,
        c as boolean
      )
    } else {
      this._geo = new AcGeSpline3d(
        a as AcGePointLike[],
        b as number[],
        c as number[] | undefined,
        d as boolean
      )
    }
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
  set closed(value: boolean) {
    this._geo.closed = value
  }

  /**
   * @inheritdoc
   */
  draw(renderer: AcGiRenderer) {
    const points = this._geo.getPoints(100)
    return renderer.lines(points, this.lineStyle)
  }
}
