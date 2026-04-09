import { AcCmErrors } from '@mlightcad/common'

import {
  AcGeBox3d,
  AcGeMatrix3d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGePointLike
} from '../math'
import { AcGeCurve3d } from './AcGeCurve3d'
import { AcGeKnotParameterizationType, AcGeNurbsCurve } from './AcGeNurbsCurve'

export class AcGeSpline3d extends AcGeCurve3d {
  private _nurbsCurve: AcGeNurbsCurve
  private _fitPoints?: AcGePoint3dLike[]
  private _knotParameterization?: AcGeKnotParameterizationType
  private _controlPoints: AcGePoint3dLike[]
  private _closed: boolean
  private _degree: number
  private _startTangent?: AcGePointLike
  private _endTangent?: AcGePointLike

  constructor(
    controlPoints: AcGePoint3dLike[],
    knots: number[],
    weights?: number[],
    degree?: number,
    closed?: boolean
  )
  constructor(
    fitPoints: AcGePointLike[],
    knotParam: AcGeKnotParameterizationType,
    degree?: number,
    closed?: boolean,
    startTangent?: AcGePointLike,
    endTangent?: AcGePointLike
  )
  constructor(
    a?: unknown,
    b?: unknown,
    c?: unknown,
    d?: unknown,
    e?: unknown,
    f?: unknown
  ) {
    super()
    // Count the number of arguments passed (including undefined)
    const argsLength = arguments.length

    // Default degree is 3
    this._degree = 3
    this._closed = false

    if (!Array.isArray(b)) {
      if (argsLength < 2 || argsLength > 6) {
        throw AcCmErrors.ILLEGAL_PARAMETERS
      }

      // Constructor with fit points
      this._fitPoints = a as AcGePoint3dLike[]
      this._knotParameterization = b as AcGeKnotParameterizationType

      // Handle degree and closed parameters for fit points constructor
      if (argsLength >= 3) {
        this._degree = (c as number) || 3
      }
      const hasClosedArg = typeof d === 'boolean'
      if (argsLength >= 4 && hasClosedArg) {
        this._closed = d as boolean
      }

      if (hasClosedArg) {
        if (argsLength >= 5) {
          this._startTangent = e as AcGePointLike
        }
        if (argsLength >= 6) {
          this._endTangent = f as AcGePointLike
        }
      } else {
        if (argsLength >= 4) {
          this._startTangent = d as AcGePointLike
        }
        if (argsLength >= 5) {
          this._endTangent = e as AcGePointLike
        }
      }

      if (this._closed) {
        this._startTangent = undefined
        this._endTangent = undefined
      }

      // Validate minimum number of fit points for the specified degree
      const tangentCount =
        (this._startTangent ? 1 : 0) + (this._endTangent ? 1 : 0)
      if (this._fitPoints.length + tangentCount < this._degree + 1) {
        throw AcCmErrors.ILLEGAL_PARAMETERS
      }

      if (this._closed) {
        this._nurbsCurve = AcGeNurbsCurve.createClosedCurve(
          this._fitPoints,
          this._degree,
          this._knotParameterization
        )
      } else {
        const points = this.toNurbsPoints(this._fitPoints)
        this._nurbsCurve = AcGeNurbsCurve.byPoints(
          points,
          this._degree,
          this._knotParameterization,
          this._startTangent
            ? this.toNurbsPoint(this._startTangent)
            : undefined,
          this._endTangent ? this.toNurbsPoint(this._endTangent) : undefined
        )
      }
      this._controlPoints = this.toGePoints(
        this._nurbsCurve.controlPoints().map(p => [p.x, p.y, p.z || 0])
      )
    } else {
      if (argsLength < 2 || argsLength > 5) {
        throw AcCmErrors.ILLEGAL_PARAMETERS
      }

      // Constructor with control points
      this._controlPoints = a as AcGePoint3dLike[]

      // Determine if c is weights or degree based on type
      let weights: number[] | undefined
      let degree: number = 3
      let closed: boolean = false

      if (argsLength >= 3) {
        if (Array.isArray(c)) {
          // c is weights array
          weights = c as number[]
          if (argsLength >= 4) {
            degree = (d as number) || 3
          }
          if (argsLength >= 5) {
            closed = e as boolean
          }
        } else if (c !== undefined) {
          // c is degree (not undefined)
          degree = (c as number) || 3
          if (argsLength >= 4) {
            closed = d as boolean
          }
        }
      }

      // Handle case where c is undefined but d might be degree
      if (c === undefined && argsLength >= 4) {
        degree = (d as number) || 3
        if (argsLength >= 5) {
          closed = e as boolean
        }
      }

      this._degree = degree
      this._closed = closed

      // Validate minimum number of control points for the specified degree
      if (this._controlPoints.length < this._degree + 1) {
        throw AcCmErrors.ILLEGAL_PARAMETERS
      }

      this._nurbsCurve = AcGeNurbsCurve.byKnotsControlPointsWeights(
        this._degree,
        b as number[],
        this._controlPoints,
        weights
      )
    }

    // Apply closed state if specified
    // if (this._closed) {
    //   this.buildCurve()
    // }
  }

  /**
   * Build the NURBS curve using stored data
   */
  private buildCurve() {
    if (this._fitPoints && this._knotParameterization) {
      // Build from fit points
      if (this._closed) {
        const newFitPoints = AcGeNurbsCurve.createFitPointsForClosedCurve(
          this._fitPoints
        )
        const points = this.toNurbsPoints(newFitPoints)
        this._nurbsCurve = AcGeNurbsCurve.byPoints(
          points,
          this._degree,
          this._knotParameterization
        )
      } else {
        // Create open curve from fit points
        const points = this.toNurbsPoints(this._fitPoints)
        this._nurbsCurve = AcGeNurbsCurve.byPoints(
          points,
          this._degree,
          this._knotParameterization,
          this._startTangent
            ? this.toNurbsPoint(this._startTangent)
            : undefined,
          this._endTangent ? this.toNurbsPoint(this._endTangent) : undefined
        )
      }
      this._controlPoints = this.toGePoints(
        this._nurbsCurve.controlPoints().map(p => [p.x, p.y, p.z || 0])
      )
    } else if (this._controlPoints) {
      // Build from control points
      if (this._closed) {
        // Create closed curve from control points
        const newFitPoints = AcGeNurbsCurve.createFitPointsForClosedCurve(
          this._controlPoints
        )
        const points = this.toNurbsPoints(newFitPoints)
        this._nurbsCurve = AcGeNurbsCurve.byPoints(
          points,
          this._degree,
          this._knotParameterization
        )
        this._controlPoints = this.toGePoints(
          this._nurbsCurve.controlPoints().map(p => [p.x, p.y, p.z || 0])
        )
      } else {
        // Create open curve from control points
        // Get knots and weights from the current NURBS curve
        const knots = this._nurbsCurve.knots()
        const weights = this._nurbsCurve.weights()
        this._nurbsCurve = AcGeNurbsCurve.byKnotsControlPointsWeights(
          this._degree,
          knots,
          this._controlPoints,
          weights
        )
      }
    }
  }

  /**
   * Set the closed property and rebuild the curve if necessary
   */
  private setClosed(closed: boolean) {
    if (this._closed === closed) {
      return
    }

    this._closed = closed
    this._boundingBoxNeedsUpdate = true
    this.buildCurve()
  }

  /**
   * Degree of the spline to be created.
   */
  get degree() {
    return this._degree
  }

  get knotParameterization() {
    return this._knotParameterization
  }

  get controlPoints() {
    return this._controlPoints.map(point => ({
      x: point.x,
      y: point.y,
      z: point.z || 0
    }))
  }

  get fitPoints() {
    return this._fitPoints?.map(point => ({
      x: point.x,
      y: point.y,
      z: point.z || 0
    }))
  }

  get knots() {
    return [...this._nurbsCurve.knots()]
  }

  get weights() {
    return [...this._nurbsCurve.weights()]
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
      // For the last point, use endParam exactly to avoid floating-point issues
      const t = i === numPoints - 1 ? endParam : startParam + i * step
      const point = curve.point(t)
      points.push(new AcGePoint3d(point[0], point[1], point[2]))
    }
    return points
  }

  getCurvePoints(curve: AcGeNurbsCurve, count: number) {
    const points = []
    const knots = curve.knots() // Get the knot vector from the curve
    const degree = curve.degree()

    // The valid parameter range is between knots[degree] and knots[knots.length - degree - 1]
    const startParam = knots[degree]
    const endParam = knots[knots.length - degree - 1]

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
    this.setClosed(value)
  }

  /**
   * @inheritdoc
   */
  transform(matrix: AcGeMatrix3d) {
    if (this._fitPoints && this._knotParameterization) {
      this._fitPoints = this._fitPoints.map(point =>
        new AcGePoint3d(point).applyMatrix4(matrix)
      )

      if (this._startTangent) {
        this._startTangent = new AcGePoint3d(
          this._startTangent
        ).transformDirection(matrix)
      }
      if (this._endTangent) {
        this._endTangent = new AcGePoint3d(this._endTangent).transformDirection(
          matrix
        )
      }

      this.buildCurve()
    } else {
      const knots = this._nurbsCurve.knots()
      const weights = this._nurbsCurve.weights()

      this._controlPoints = this._controlPoints.map(point =>
        new AcGePoint3d(point).applyMatrix4(matrix)
      )
      this._nurbsCurve = AcGeNurbsCurve.byKnotsControlPointsWeights(
        this._degree,
        knots,
        this._controlPoints,
        weights.length > 0 ? weights : undefined
      )
    }

    this._boundingBoxNeedsUpdate = true
    return this
  }

  /**
   * Convert input points to points in NURBS format
   * @param points Input points to convert
   * @returns Return converted points
   */
  private toNurbsPoints(points: AcGePoint3dLike[]): number[][] {
    const nurbsPoints = new Array(points.length)
    points.forEach((point, index) => {
      nurbsPoints[index] = [point.x, point.y, point.z || 0]
    })
    return nurbsPoints
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

  private toNurbsPoint(point: AcGePointLike): number[] {
    return [point.x, point.y, point.z || 0]
  }

  /**
   * Create a closed spline from fit points using AcGeNurbsCurve.createClosedCurve
   * @param fitPoints - Array of fit points defining the curve
   * @param parameterization - Knot parameterization type for NURBS
   * @param degree - Optional degree of the spline (default: 3)
   * @returns A closed spline
   */
  static createClosedSpline(
    fitPoints: AcGePoint3dLike[],
    parameterization: AcGeKnotParameterizationType = 'Uniform',
    degree: number = 3
  ): AcGeSpline3d {
    if (fitPoints.length < degree + 1) {
      throw new Error(
        `At least ${degree + 1} points are required for a degree ${degree} closed spline`
      )
    }

    // Create spline using the constructor with fit points, degree, and closed=true
    return new AcGeSpline3d(fitPoints, parameterization, degree, true)
  }
}
