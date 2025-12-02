import {
  AcGeBox3d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGePointLike,
} from '@mlightcad/geometry-engine'

import { AcDbDimension } from './AcDbDimension'

/**
 * Represents an aligned dimension entity in AutoCAD.
 *
 * An aligned dimension measures the distance between two points located anywhere in space.
 * The dimension's normal vector must be perpendicular to the line between the two points.
 * The two selected points are also used as the definition points for the start of the
 * two dimension extension lines.
 *
 * Aligned dimensions are commonly used to measure distances that are not parallel to
 * the X or Y axes, providing accurate measurements regardless of the orientation.
 *
 * @example
 * ```typescript
 * // Create an aligned dimension
 * const alignedDim = new AcDbAlignedDimension(
 *   new AcGePoint3d(0, 0, 0),    // First extension line point
 *   new AcGePoint3d(10, 5, 0),   // Second extension line point
 *   new AcGePoint3d(5, 2.5, 0),  // Dimension line point
 *   "10.0",                      // Dimension text
 *   "Standard"                   // Dimension style
 * );
 *
 * // Access dimension properties
 * console.log(`Dimension line point: ${alignedDim.dimLinePoint}`);
 * console.log(`Extension line 1 point: ${alignedDim.xLine1Point}`);
 * console.log(`Extension line 2 point: ${alignedDim.xLine2Point}`);
 * ```
 */
export class AcDbAlignedDimension extends AcDbDimension {
  /** The entity type name */
  static override typeName: string = 'AlignedDimension'

  /** The definition point that specifies where the dimension line will be */
  private _dimLinePoint: AcGePoint3d
  /** The start point for the first extension line */
  private _xLine1Point: AcGePoint3d
  /** The start point for the second extension line */
  private _xLine2Point: AcGePoint3d
  /** The extension line obliquing angle in radians */
  private _oblique: number
  /** The dimension's rotation angle in radians */
  private _rotation: number

  /**
   * Creates a new aligned dimension entity.
   *
   * This constructor initializes an aligned dimension using the specified points.
   * The extension line obliquing angle is set to 0.0 by default.
   *
   * @param xLine1Point - Start point (in WCS coordinates) of first extension line
   * @param xLine2Point - Start point (in WCS coordinates) of second extension line
   * @param dimLinePoint - Point (in WCS coordinates) on dimension line itself
   * @param dimText - Text string to use as the dimension annotation (optional)
   * @param dimStyle - String name of dimension style table record to use (optional)
   *
   * @example
   * ```typescript
   * // Create an aligned dimension with default text and style
   * const alignedDim = new AcDbAlignedDimension(
   *   new AcGePoint3d(0, 0, 0),
   *   new AcGePoint3d(10, 5, 0),
   *   new AcGePoint3d(5, 2.5, 0)
   * );
   *
   * // Create an aligned dimension with custom text and style
   * const alignedDim2 = new AcDbAlignedDimension(
   *   new AcGePoint3d(0, 0, 0),
   *   new AcGePoint3d(15, 10, 0),
   *   new AcGePoint3d(7.5, 5, 0),
   *   "15.0",
   *   "Architectural"
   * );
   * ```
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
   * Gets the definition point that specifies where the dimension line will be.
   *
   * This point will be somewhere on the dimension line and determines the position
   * of the dimension text and arrows.
   *
   * @returns The dimension line point in WCS coordinates
   *
   * @example
   * ```typescript
   * const dimLinePoint = alignedDim.dimLinePoint;
   * console.log(`Dimension line point: ${dimLinePoint.x}, ${dimLinePoint.y}, ${dimLinePoint.z}`);
   * ```
   */
  get dimLinePoint() {
    return this._dimLinePoint
  }

  /**
   * Sets the definition point that specifies where the dimension line will be.
   *
   * @param value - The new dimension line point
   *
   * @example
   * ```typescript
   * alignedDim.dimLinePoint = new AcGePoint3d(5, 2.5, 0);
   * ```
   */
  set dimLinePoint(value: AcGePoint3dLike) {
    this._dimLinePoint.copy(value)
  }

  /**
   * Gets the start point for the first extension line of the dimension.
   *
   * @returns The first extension line point in WCS coordinates
   *
   * @example
   * ```typescript
   * const xLine1Point = alignedDim.xLine1Point;
   * console.log(`Extension line 1 point: ${xLine1Point.x}, ${xLine1Point.y}, ${xLine1Point.z}`);
   * ```
   */
  get xLine1Point() {
    return this._xLine1Point
  }

  /**
   * Sets the start point for the first extension line of the dimension.
   *
   * @param value - The new first extension line point
   *
   * @example
   * ```typescript
   * alignedDim.xLine1Point = new AcGePoint3d(0, 0, 0);
   * ```
   */
  set xLine1Point(value: AcGePoint3dLike) {
    this._xLine1Point.copy(value)
  }

  /**
   * Gets the start point for the second extension line of the dimension.
   *
   * @returns The second extension line point in WCS coordinates
   *
   * @example
   * ```typescript
   * const xLine2Point = alignedDim.xLine2Point;
   * console.log(`Extension line 2 point: ${xLine2Point.x}, ${xLine2Point.y}, ${xLine2Point.z}`);
   * ```
   */
  get xLine2Point() {
    return this._xLine2Point
  }

  /**
   * Sets the start point for the second extension line of the dimension.
   *
   * @param value - The new second extension line point
   *
   * @example
   * ```typescript
   * alignedDim.xLine2Point = new AcGePoint3d(10, 5, 0);
   * ```
   */
  set xLine2Point(value: AcGePoint3dLike) {
    this._xLine2Point.copy(value)
  }

  /**
   * Gets the dimension's rotation angle.
   *
   * @returns The rotation angle in radians
   *
   * @example
   * ```typescript
   * const rotation = alignedDim.rotation;
   * console.log(`Rotation: ${rotation} radians (${rotation * 180 / Math.PI} degrees)`);
   * ```
   */
  get rotation() {
    return this._rotation
  }

  /**
   * Sets the dimension's rotation angle.
   *
   * @param value - The new rotation angle in radians
   *
   * @example
   * ```typescript
   * alignedDim.rotation = Math.PI / 4; // 45 degrees
   * ```
   */
  set rotation(value: number) {
    this._rotation = value
  }

  /**
   * Gets the extension line obliquing angle.
   *
   * @returns The obliquing angle in radians
   *
   * @example
   * ```typescript
   * const oblique = alignedDim.oblique;
   * console.log(`Oblique angle: ${oblique} radians`);
   * ```
   */
  get oblique() {
    return this._oblique
  }

  /**
   * Sets the extension line obliquing angle.
   *
   * @param value - The new obliquing angle in radians
   *
   * @example
   * ```typescript
   * alignedDim.oblique = Math.PI / 6; // 30 degrees
   * ```
   */
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
}
