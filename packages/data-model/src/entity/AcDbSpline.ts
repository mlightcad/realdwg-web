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
   */
  constructor(
    controlPoints: AcGePointLike[],
    knots: number[],
    weights?: number[]
  )
  /**
   * Construct an instance of the spline entity.
   * @param fitPoints Input an array of points (in WCS coordinates) through which to fit the curve
   * @param knotParam Input knot parameterization which define the knot values
   */
  constructor(
    fitPoints: AcGePointLike[],
    knotParam: AcGeKnotParameterizationType
  )
  constructor(a?: unknown, b?: unknown, c?: unknown) {
    super()
    const argsLength =
      +(a !== undefined) + +(b !== undefined) + +(c !== undefined)

    if (argsLength != 2 && argsLength != 3) {
      throw AcCmErrors.ILLEGAL_PARAMETERS
    }
    if (argsLength == 2 && !Array.isArray(b)) {
      this._geo = new AcGeSpline3d(
        a as AcGePointLike[],
        b as AcGeKnotParameterizationType
      )
    } else {
      this._geo = new AcGeSpline3d(
        a as AcGePointLike[],
        b as number[],
        c as number[] | undefined
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
