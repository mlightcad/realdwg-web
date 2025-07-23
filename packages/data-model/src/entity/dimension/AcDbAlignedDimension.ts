import {
  AcGeBox3d,
  AcGeLine3d,
  AcGePoint3d,
  AcGePointLike,
  AcGeVector3d
} from '@mlightcad/geometry-engine'

import { AcDbDimension } from './AcDbDimension'

/**
 * This class represents the dimension type that dimensions the distance between two points located anywhere
 * in space. The dimension's normal vector must be perpendicular to the line between the two points. The two
 * selected points are also used as the definition points for the start of the two dimension extension lines.
 */
export class AcDbAlignedDimension extends AcDbDimension {
  private _dimLinePoint: AcGePoint3d
  private _xLine1Point: AcGePoint3d
  private _xLine2Point: AcGePoint3d
  private _oblique: number
  private _rotation: number

  /**
   * This constructor uses the parameters passed in to initialize the dimension. In addition, the extension
   * line obliquing angle is set to 0.0.
   * - If dimStyle is left as null, then the current default dimStyle within the AutoCAD editor is used.
   * @param xLine1Point Input start point (in WCS coordinates) of first extension line
   * @param xLine2Point Input start point (in WCS coordinates) of second extension line
   * @param dimLinePoint Input point (in WCS coordinates) on dimension line itself
   * @param dimText Input text string to use as the dimension annotation
   * @param dimStyle Input string name of dimension style table record to use
   */
  constructor(
    xLine1Point: AcGePointLike,
    xLine2Point: AcGePointLike,
    dimLinePoint: AcGePointLike,
    dimText: string | null = null,
    dimStyle: string | null = null
  ) {
    super()
    this._dimLinePoint = new AcGePoint3d().copy(dimLinePoint)
    this._xLine1Point = new AcGePoint3d().copy(xLine1Point)
    this._xLine2Point = new AcGePoint3d().copy(xLine2Point)
    this._oblique = 0
    this._rotation = 0

    this.dimensionText = dimText
    // TODO: Set it to the current default dimStyle within the AutoCAD editor if dimStyle is null
    this.dimensionStyleName = dimStyle
  }

  /**
   * The definition point (in WCS coordinates) that specifies where the dimension line will be. This point
   * will be somewhere on the dimension line.
   */
  get dimLinePoint() {
    return this._dimLinePoint
  }
  set dimLinePoint(value: AcGePoint3d) {
    this._dimLinePoint.copy(value)
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
   * The dimension's rotation angle in radians.
   */
  get rotation() {
    return this._rotation
  }
  set rotation(value: number) {
    this._rotation = value
  }

  /**
   * The extension line obliquing angle (in radians) for the dimension.
   */
  get oblique() {
    return this._oblique
  }
  set oblique(value: number) {
    this._oblique = value
  }

  /**
   * @inheritdoc
   */
  get geometricExtents() {
    // TODO: Finish it
    return new AcGeBox3d()
  }

  /**
   * @inheritdoc
   */
  protected get isAppendArrow() {
    return false
  }

  /**
   * Return one array which contains three lines of the alinged dimension.
   * - The first line in the array is dimension line.
   * - The second line and the third line in the array are extension lines.
   * @returns Return three lines of the alinged dimension
   */
  protected calculateLines() {
    const lines: AcGeLine3d[] = []

    const extensionLine1 = this.createExtensionLine(this._xLine1Point)
    const extensionLine2 = this.createExtensionLine(this._xLine2Point)

    const intersectionPoint1 = this.findIntersectionPoint(
      extensionLine1,
      this._dimLinePoint
    )
    const intersectionPoint2 = this.findIntersectionPoint(
      extensionLine2,
      this._dimLinePoint
    )
    const dimensionLine = new AcGeLine3d(intersectionPoint1, intersectionPoint2)
    lines.push(dimensionLine)

    // Create the first extension line with extension
    extensionLine1.endPoint = intersectionPoint1
    this.adjustExtensionLine(extensionLine1)
    lines.push(extensionLine1)

    // Create the second extension line with extension
    extensionLine2.endPoint = intersectionPoint2
    this.adjustExtensionLine(extensionLine2)
    lines.push(extensionLine2)

    return lines
  }

  private createExtensionLine(point: AcGePoint3d) {
    const angle = this.rotation + Math.PI / 2
    const anotherPoint = this.findPointOnLine2(point, angle, 100)
    return new AcGeLine3d(point, { ...anotherPoint, z: point.z })
  }

  /**
   * Compute the intersection point between a line 'line1' and a line 'line2' that passes through
   * a given point 'p' and is perpendicular to line 'line1'.
   *
   * @param line The 'line1'.
   * @param p The point through which the perpendicular 'line2' passes.
   * @returns Returns the intersection point of 'line1' and 'line2'.
   */
  private findIntersectionPoint(line1: AcGeLine3d, p: AcGeVector3d) {
    const p1 = line1.startPoint
    const p2 = line1.endPoint

    // Direction of line1 (p1 - p2)
    const directionOfLine1 = new AcGeVector3d().subVectors(p2, p1).normalize()

    // Vector from point 'p1' to point 'p3'
    const vectorFromP1ToP3 = new AcGeVector3d().subVectors(p, p1)

    // Project vectorAP onto directionL to get the projection vector
    const projectionLength = vectorFromP1ToP3.dot(directionOfLine1)
    const projectionVector = new AcGeVector3d()
      .copy(directionOfLine1)
      .multiplyScalar(projectionLength)

    // Intersection point is the point on line L at the projection
    const intersection = new AcGeVector3d().addVectors(p1, projectionVector)

    return intersection
  }
}
