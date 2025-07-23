import { AcCmErrors } from '@mlightcad/common'
import verb from 'verb-nurbs-web'

import {
  AcGeBox3d,
  AcGeMatrix3d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGePointLike
} from '../math'
import { AcGeCurve3d } from './AcGeCurve3d'

export type AcGeKnotParameterizationType = 'Uniform' | 'Chord' | 'SqrtChord'

export class AcGeSpline3d extends AcGeCurve3d {
  private _nurbsCurve: verb.geom.NurbsCurve
  private _fitPoints?: AcGePointLike[]
  private _knotParameterization?: AcGeKnotParameterizationType
  private _controlPoints: AcGePointLike[]
  private _closed: boolean

  constructor(
    controlPoints: AcGePointLike[],
    knots: number[],
    weights?: number[]
  )
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

    // For now, we support 3 degree only
    const degree = 3
    this._closed = false

    if (argsLength == 2 && !Array.isArray(b)) {
      this._fitPoints = a as AcGePointLike[]
      this._knotParameterization = b as AcGeKnotParameterizationType
      const points = this.toVerbPoints(this._fitPoints)
      this._nurbsCurve = verb.geom.NurbsCurve.byPoints(points, degree)
      this._controlPoints = this.toGePoints(this._nurbsCurve.controlPoints())
    } else {
      this._controlPoints = a as AcGePointLike[]
      const points = this.toVerbPoints(this._controlPoints)
      this._nurbsCurve = verb.geom.NurbsCurve.byKnotsControlPointsWeights(
        degree,
        b as verb.core.Data.KnotArray,
        points,
        c as number[] | undefined
      )
    }
  }

  /**
   * Degree of the spline to be created.
   */
  get degree() {
    return this._nurbsCurve.degree()
  }

  get knotParameterization() {
    return this._knotParameterization
  }

  /**
   * The start point of this spline
   */
  get startPoint(): AcGePoint3d {
    const knots = this._nurbsCurve.knots()
    const degree = this._nurbsCurve.degree()
    const startParam = knots[degree]
    const startPoint = this._nurbsCurve.point(startParam)
    return new AcGePoint3d(startPoint[0], startPoint[1], startPoint[2])
  }

  /**
   * The end point of this spline
   */
  get endPoint(): AcGePoint3d {
    const knots = this._nurbsCurve.knots()
    const degree = this._nurbsCurve.degree()
    const endParam = knots[knots.length - degree - 1]
    const endPoint = this._nurbsCurve.point(endParam)
    return new AcGePoint3d(endPoint[0], endPoint[1], endPoint[2])
  }

  /**
   * @inheritdoc
   */
  get length() {
    return this._nurbsCurve.length()
  }

  /**
   * Return the value of the control point at position index in the list of control points.
   * If index is negative or more than the number of control points in the spline, then point
   * is set to the last control point.
   * @param index Input index (0 based) of point to get
   * @returns
   */
  getFitPointAt(index: number): AcGePoint3dLike {
    if (!this._fitPoints) {
      throw new Error('No fit points in this spline')
    }
    const length = this._fitPoints.length
    const newIndex = index < 0 || index >= length ? length - 1 : index
    const point = this._fitPoints[newIndex]
    return { x: point.x, y: point.y, z: point.z || 0 }
  }

  /**
   * Return the value of the control point at position index in the list of control points.
   * If index is negative or more than the number of control points in the spline, then point
   * is set to the last control point.
   * @param index Input index (0 based) of point to get
   * @returns
   */
  getControlPointAt(index: number) {
    const length = this._controlPoints.length
    const newIndex = index < 0 || index >= length ? length - 1 : index
    return this._controlPoints[newIndex]
  }

  /**
   * Divide this spline into the specified nubmer of points
   * those points as an array of points.
   * @param numPoints Input the nubmer of points returned
   * @returns Return an array of point
   */
  getPoints(numPoints: number = 100): AcGePoint3d[] {
    const curve = this._nurbsCurve
    const points: AcGePoint3d[] = []
    // Get the knot vector from the curve
    const knots = curve.knots()

    // The valid parameter range is between knots[degree] and knots[knots.length - degree - 1]
    const degree = this._nurbsCurve.degree()
    const startParam = knots[degree]
    const endParam = knots[knots.length - degree - 1]

    // Adjust step size for correct range
    const step = (endParam - startParam) / (numPoints - 1)
    for (let i = 0; i < numPoints; i++) {
      // Map t to the correct parameter space
      const t = startParam + i * step
      const point = curve.point(t)
      // Sample the curve at the mapped parameter t
      points.push(new AcGePoint3d(point[0], point[1], point[2]))
    }
    return points
  }

  getCurvePoints(curve: verb.geom.NurbsCurve, count: number) {
    const points = []
    const knots = curve.knots() // Get the knot vector from the curve

    // The valid parameter range is between knots[degree] and knots[knots.length - degree - 1]
    const startParam = knots[3]
    const endParam = knots[knots.length - 4]

    const step = (endParam - startParam) / (count - 1) // Adjust step size for correct range

    for (let i = 0; i < count; i++) {
      const t = startParam + i * step // Map t to the correct parameter space
      points.push(curve.point(t)) // Sample the curve at the mapped parameter t
    }

    return points
  }

  /**
   * @inheritdoc
   */
  calculateBoundingBox() {
    const points = this.getPoints(100)
    return new AcGeBox3d().setFromPoints(points)
  }

  get closed() {
    return this._closed
  }
  set closed(value: boolean) {
    this._boundingBoxNeedsUpdate = true
    this._closed = value
  }

  /**
   * @inheritdoc
   */
  transform(_matrix: AcGeMatrix3d) {
    // TODO: Implement this method
    this._boundingBoxNeedsUpdate = true
    return this
  }

  /**
   * Convert input points to points in verb-nurbs-web format
   * @param points Input points to convert
   * @returns Return converted points
   */
  private toVerbPoints(points: AcGePointLike[]): number[][] {
    const verbPoints = new Array(points.length)
    points.forEach((point, index) => {
      verbPoints[index] = [point.x, point.y, point.z || 0]
    })
    return verbPoints
  }

  /**
   * Convert input points to points in geometry engine format
   * @param points Input points to convert
   * @returns Return converted points
   */
  private toGePoints(points: number[][]): AcGePoint3dLike[] {
    const gePoints = new Array<AcGePoint3dLike>(points.length)
    points.forEach((point, index) => {
      gePoints[index] = { x: point[0], y: point[1], z: point[2] }
    })
    return gePoints
  }
}
