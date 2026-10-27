import {
  AcGeLine3d,
  AcGeMatrix3d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGePointLike,
  AcGeVector3d,
  AcGeVector3dLike
} from '@mlightcad/geometry-engine'

import { AcDbDxfFiler } from '../../base/index.js'
import { AcDbEntityProperties } from '../AcDbEntityProperties.js'
import {
  acdbArrowScaleFromStyle,
  acdbBuildAnnotationText,
  acdbCreateDimArrowInsert,
  acdbCreateDimLineEntity,
  acdbCreateDimMText,
  acdbCreateEmptyDimBlock,
  acdbEnsureDimArrowBlocks,
  acdbExtendLineByDimDle,
  acdbMidPoint,
  acdbOffsetTextAlongNormal,
  acdbResolveArrowBlockName
} from './AcDbDimBlockBuilder.js'
import { AcDbDimension } from './AcDbDimension.js'

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
    this.calculateRotation()

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
  get dimLinePoint(): AcGePoint3d {
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
  get xLine1Point(): AcGePoint3d {
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
  get xLine2Point(): AcGePoint3d {
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

  override get properties(): AcDbEntityProperties {
    const baseProperties = this.getBaseProperties()
    return {
      type: this.type,
      groups: [
        ...baseProperties.groups,
        {
          groupName: 'geometry',
          properties: [
            ...this.createPoint3dProperties(
              'xLine1Point',
              () => this.xLine1Point
            ),
            ...this.createPoint3dProperties(
              'xLine2Point',
              () => this.xLine2Point
            ),
            ...this.createPoint3dProperties(
              'dimLinePoint',
              () => this.dimLinePoint
            ),
            this.createProperty(
              'rotation',
              'float',
              () => this.rotation,
              (value: number) => {
                this.rotation = value
              }
            ),
            this.createProperty(
              'oblique',
              'float',
              () => this.oblique,
              (value: number) => {
                this.oblique = value
              }
            )
          ]
        }
      ]
    }
  }

  /**
   * @inheritdoc
   */
  protected override collectDimensionDefinitionGripPoints() {
    return [this.xLine1Point, this.xLine2Point, this.dimLinePoint]
  }

  /** @inheritdoc */
  override subMoveGripPointsAt(indices: number[], offset: AcGeVector3dLike) {
    super.subMoveGripPointsAt(indices, offset)
    this.calculateRotation()
    return this
  }

  /**
   * @inheritdoc
   */
  protected override subTransformBy(matrix: AcGeMatrix3d) {
    this._dimLinePoint.applyMatrix4(matrix)
    this._xLine1Point.applyMatrix4(matrix)
    this._xLine2Point.applyMatrix4(matrix)
    this.calculateRotation()
  }

  /**
   * @inheritdoc
   */
  get geometricExtents() {
    return this.getGeometricExtentsFromDimBlockOrPoints([
      this.xLine1Point,
      this.xLine2Point,
      this.dimLinePoint
    ])
  }

  /**
   * @inheritdoc
   */
  protected get isAppendArrow() {
    return false
  }

  createDimBlock(blockName: string) {
    const style = this.dimensionStyle
    acdbEnsureDimArrowBlocks(this.database, style)

    const block = acdbCreateEmptyDimBlock(blockName)
    const lines = this.createLines()
    const dimLine = lines[0]
    // Capture arrow anchors before DIMDLE extends the line past the heads.
    const arrowStart = dimLine.startPoint.clone()
    const arrowEnd = dimLine.endPoint.clone()
    acdbExtendLineByDimDle(dimLine, style, this)

    if (style.dimsd1 === 0 && style.dimsd2 === 0) {
      block.appendEntity(
        acdbCreateDimLineEntity(dimLine.startPoint, dimLine.endPoint, style)
      )
    } else if (style.dimsd1 === 0 || style.dimsd2 === 0) {
      const mid = acdbMidPoint(dimLine.startPoint, dimLine.endPoint)
      if (style.dimsd1 === 0) {
        block.appendEntity(
          acdbCreateDimLineEntity(dimLine.startPoint, mid, style)
        )
      }
      if (style.dimsd2 === 0) {
        block.appendEntity(acdbCreateDimLineEntity(mid, dimLine.endPoint, style))
      }
    }

    if (style.dimse1 === 0 && lines[1]) {
      block.appendEntity(
        acdbCreateDimLineEntity(
          lines[1].startPoint,
          lines[1].endPoint,
          style,
          'extension'
        )
      )
    }
    if (style.dimse2 === 0 && lines[2]) {
      block.appendEntity(
        acdbCreateDimLineEntity(
          lines[2].startPoint,
          lines[2].endPoint,
          style,
          'extension'
        )
      )
    }

    const scale = acdbArrowScaleFromStyle(style, this)
    const arrow1 = acdbResolveArrowBlockName(
      style.dimsah === 0 ? style.dimblk : style.dimblk1
    )
    const arrow2 = acdbResolveArrowBlockName(
      style.dimsah === 0 ? style.dimblk : style.dimblk2
    )
    if (style.dimtsz <= 0) {
      const a1 = acdbCreateDimArrowInsert(
        arrowStart,
        this.rotation + Math.PI,
        scale,
        arrow1
      )
      const a2 = acdbCreateDimArrowInsert(
        arrowEnd,
        this.rotation,
        scale,
        arrow2
      )
      if (a1) block.appendEntity(a1)
      if (a2) block.appendEntity(a2)
    } else {
      // Architectural tick: short oblique strokes at each end
      const tick = acdbCreateDimArrowInsert(
        arrowStart,
        this.rotation + Math.PI / 4,
        scale,
        '_ARCHTICK'
      )
      const tick2 = acdbCreateDimArrowInsert(
        arrowEnd,
        this.rotation + Math.PI / 4,
        scale,
        '_ARCHTICK'
      )
      if (tick) block.appendEntity(tick)
      if (tick2) block.appendEntity(tick2)
    }

    const measured =
      this.measurement ?? this.xLine1Point.distanceTo(this.xLine2Point)
    const contents = acdbBuildAnnotationText(
      measured,
      this.dimensionText,
      style,
      'linear'
    )
    const textPos = acdbOffsetTextAlongNormal(
      acdbMidPoint(dimLine.startPoint, dimLine.endPoint),
      this.rotation,
      style,
      this
    )
    this.textPosition = textPos
    const mtext = acdbCreateDimMText({
      contents,
      position: textPos,
      rotation: this.rotation,
      style,
      entity: this
    })
    if (mtext) block.appendEntity(mtext)

    return block
  }

  /**
   * Return one array which contains three lines of the alinged dimension.
   * - The first line in the array is dimension line.
   * - The second line and the third line in the array are extension lines.
   * @returns Return three lines of the alinged dimension
   */
  protected createLines() {
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

  private calculateRotation() {
    const p1 = this._xLine1Point
    const p2 = this._xLine2Point
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    this._rotation = Math.atan2(dy, dx)
  }

  /**
   * DXF subclass marker written for this dimension subtype.
   */
  protected get dxfSubclassMarker() {
    return 'AcDbAlignedDimension'
  }

  protected override getMeasurementPropertyValue() {
    return this.measurement ?? this.xLine1Point.distanceTo(this.xLine2Point)
  }

  /**
   * Writes DXF fields for this object.
   *
   * @param filer - DXF output writer.
   * @returns The instance (for chaining).
   */
  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker(this.dxfSubclassMarker)
    filer.writePoint3d(13, this.xLine1Point)
    filer.writePoint3d(14, this.xLine2Point)
    filer.writePoint3d(15, this.dimLinePoint)
    filer.writeAngle(50, this.rotation)
    filer.writeAngle(52, this.oblique)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    filer.atSubclassData(this.dxfSubclassMarker)

    let x1 = this.xLine1Point.x
    let y1 = this.xLine1Point.y
    let z1 = this.xLine1Point.z
    let x2 = this.xLine2Point.x
    let y2 = this.xLine2Point.y
    let z2 = this.xLine2Point.z
    let dx = this.dimLinePoint.x
    let dy = this.dimLinePoint.y
    let dz = this.dimLinePoint.z
    let rotDeg = (this.rotation * 180) / Math.PI
    let oblDeg = (this.oblique * 180) / Math.PI
    let ix = this.dimBlockPosition.x
    let iy = this.dimBlockPosition.y
    let iz = this.dimBlockPosition.z
    let hasInsertion = false
    let hasDimLine = false

    while (!filer.atEndOfObject && !filer.atEof && !filer.atExtendedData) {
      const item = filer.readItem()
      if (!item) break
      const code = Number(item.code)
      const n = Number(item.value)
      switch (code) {
        case 12:
          ix = n
          hasInsertion = true
          break
        case 22:
          iy = n
          hasInsertion = true
          break
        case 32:
          iz = n
          hasInsertion = true
          break
        case 13:
          x1 = n
          break
        case 23:
          y1 = n
          break
        case 33:
          z1 = n
          break
        case 14:
          x2 = n
          break
        case 24:
          y2 = n
          break
        case 34:
          z2 = n
          break
        case 15:
          dx = n
          hasDimLine = true
          break
        case 25:
          dy = n
          hasDimLine = true
          break
        case 35:
          dz = n
          hasDimLine = true
          break
        case 50:
          rotDeg = n
          break
        case 52:
          oblDeg = n
          break
        case 100:
          filer.pushBackItem(item)
          this.finishAlignedDxfIn(
            x1,
            y1,
            z1,
            x2,
            y2,
            z2,
            dx,
            dy,
            dz,
            rotDeg,
            oblDeg,
            ix,
            iy,
            iz,
            hasInsertion,
            hasDimLine
          )
          return this
        default:
          break
      }
    }

    this.finishAlignedDxfIn(
      x1,
      y1,
      z1,
      x2,
      y2,
      z2,
      dx,
      dy,
      dz,
      rotDeg,
      oblDeg,
      ix,
      iy,
      iz,
      hasInsertion,
      hasDimLine
    )
    return this
  }

  private finishAlignedDxfIn(
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    dx: number,
    dy: number,
    dz: number,
    rotDeg: number,
    oblDeg: number,
    ix: number,
    iy: number,
    iz: number,
    hasInsertion: boolean,
    hasDimLine: boolean
  ) {
    this.xLine1Point = { x: x1, y: y1, z: z1 }
    this.xLine2Point = { x: x2, y: y2, z: z2 }
    // AutoCAD aligned/rotated dims store the dim-line point as group 10
    // (AcDbDimension definition point). Group 15 is rare.
    if (hasDimLine) {
      this.dimLinePoint = { x: dx, y: dy, z: dz }
    } else {
      this.dimLinePoint = {
        x: this._dxfDefinitionPoint.x,
        y: this._dxfDefinitionPoint.y,
        z: this._dxfDefinitionPoint.z
      }
    }
    this.rotation = (rotDeg * Math.PI) / 180
    this.oblique = (oblDeg * Math.PI) / 180
    // Group 12 in the AcDbDimension section is applied by the base class.
    // Writers that emit it after the typed subclass marker are handled here.
    // A missing group 12 must not fall back to group 10.
    if (hasInsertion) {
      this.dimBlockPosition = { x: ix, y: iy, z: iz }
    }
  }
}
