import {
  AcGeMatrix3d,
  AcGePoint3d,
  AcGePoint3dLike
} from '@mlightcad/geometry-engine'

import { AcDbDxfFiler } from '../../base/index.js'
import { AcDbEntityProperties } from '../AcDbEntityProperties.js'
import {
  acdbAngleOfPoints,
  acdbArrowScaleFromStyle,
  acdbBuildAnnotationText,
  acdbCreateDimArcEntity,
  acdbCreateDimArrowInsert,
  acdbCreateDimLineEntity,
  acdbCreateDimMText,
  acdbCreateEmptyDimBlock,
  acdbDimFeatureScale,
  acdbEnsureDimArrowBlocks,
  acdbPointAt,
  acdbResolveAngularSweep,
  acdbResolveArrowBlockName,
  acdbTextHeightFromStyle
} from './AcDbDimBlockBuilder.js'
import { AcDbDimension } from './AcDbDimension.js'

/**
 * Represents an arc length dimension entity in AutoCAD.
 *
 * This dimension type measures the length of an arc by defining the arc's center point,
 * two points that define the arc's extent, and a point on the arc itself. Arc length
 * dimensions are commonly used in mechanical drawings, architectural plans, and other
 * technical documentation where precise arc measurements are required.
 *
 * The dimension displays the actual arc length value and typically includes extension
 * lines, dimension lines, and arrows positioned to clearly indicate the arc being measured.
 */
export class AcDbArcDimension extends AcDbDimension {
  /** The entity type name */
  static override typeName: string = 'ArcDimension'

  private _arcPoint: AcGePoint3d
  private _centerPoint: AcGePoint3d
  private _xLine1Point: AcGePoint3d
  private _xLine2Point: AcGePoint3d

  /**
   * Creates a new arc length dimension.
   *
   * @param centerPoint - The center point of the arc being measured. This defines
   *                      the center of the circle that contains the arc
   * @param xLine1Point - The first extension line end point. This defines one end
   *                      of the arc being measured
   * @param xLine2Point - The second extension line end point. This defines the other
   *                      end of the arc being measured
   * @param arcPoint - A point on the arc that helps define the specific arc segment
   *                   being measured. This point is typically between the two extension
   *                   line points
   * @param dimText - Optional custom dimension text to display instead of the calculated
   *                  arc length value. If null, the calculated length will be displayed
   * @param dimStyle - Optional name of the dimension style table record to use for
   *                   formatting. If null, the current default style will be used
   */
  constructor(
    centerPoint: AcGePoint3dLike,
    xLine1Point: AcGePoint3dLike,
    xLine2Point: AcGePoint3dLike,
    arcPoint: AcGePoint3dLike,
    dimText: string | null = null,
    dimStyle: string | null = null
  ) {
    super()
    this._arcPoint = new AcGePoint3d().copy(arcPoint)
    this._xLine1Point = new AcGePoint3d().copy(xLine1Point)
    this._xLine2Point = new AcGePoint3d().copy(xLine2Point)
    this._centerPoint = new AcGePoint3d().copy(centerPoint)

    this.dimensionText = dimText
    // TODO: Set it to the current default dimStyle within the AutoCAD editor if dimStyle is null
    this.dimensionStyleName = dimStyle
    // DXF group 70 low nibble 8 = arc length.
    this.dimensionType = 8
  }

  /**
   * Gets or sets a point on the arc that helps define the arc segment being measured.
   *
   * This point is typically positioned between the two extension line points and helps
   * determine which arc segment should be measured when multiple arcs could be defined
   * by the same center and end points.
   *
   * @returns The arc point that defines the arc segment
   */
  get arcPoint() {
    return this._arcPoint
  }
  set arcPoint(value: AcGePoint3d) {
    this._arcPoint.copy(value)
  }

  /**
   * Gets or sets the center point of the arc being measured.
   *
   * The center point defines the center of the circle that contains the arc. This point
   * is used to calculate the arc length and position the dimension elements correctly.
   *
   * @returns The center point of the arc
   */
  get centerPoint() {
    return this._centerPoint
  }
  set centerPoint(value: AcGePoint3d) {
    this._centerPoint.copy(value)
  }

  /**
   * Gets or sets the first extension line end point.
   *
   * This point defines one end of the arc being measured. The extension line extends
   * from this point to the arc, helping to clearly identify the starting point of
   * the arc length measurement.
   *
   * @returns The first extension line end point
   */
  get xLine1Point() {
    return this._xLine1Point
  }
  set xLine1Point(value: AcGePoint3d) {
    this._xLine1Point.copy(value)
  }

  /**
   * Gets or sets the second extension line end point.
   *
   * This point defines the other end of the arc being measured. The extension line
   * extends from this point to the arc, helping to clearly identify the ending point
   * of the arc length measurement.
   *
   * @returns The second extension line end point
   */
  get xLine2Point() {
    return this._xLine2Point
  }
  set xLine2Point(value: AcGePoint3d) {
    this._xLine2Point.copy(value)
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
              'centerPoint',
              () => this.centerPoint
            ),
            ...this.createPoint3dProperties(
              'xLine1Point',
              () => this.xLine1Point
            ),
            ...this.createPoint3dProperties(
              'xLine2Point',
              () => this.xLine2Point
            ),
            ...this.createPoint3dProperties('arcPoint', () => this.arcPoint)
          ]
        }
      ]
    }
  }

  /**
   * @inheritdoc
   */
  protected override collectDimensionDefinitionGripPoints() {
    return [this.centerPoint, this.xLine1Point, this.xLine2Point, this.arcPoint]
  }

  /**
   * @inheritdoc
   */
  protected override subTransformBy(matrix: AcGeMatrix3d) {
    this._arcPoint.applyMatrix4(matrix)
    this._centerPoint.applyMatrix4(matrix)
    this._xLine1Point.applyMatrix4(matrix)
    this._xLine2Point.applyMatrix4(matrix)
  }

  /**
   * Gets the geometric extents (bounding box) of this dimension entity.
   *
   * The geometric extents define the minimum bounding box that completely contains
   * the dimension entity, including all its components like extension lines,
   * dimension lines, arrows, and text.
   *
   * @returns A 3D bounding box containing the dimension entity
   * @inheritdoc
   */
  get geometricExtents() {
    return this.getGeometricExtentsFromDimBlockOrPoints([
      this.xLine1Point,
      this.xLine2Point,
      this.centerPoint,
      this.arcPoint
    ])
  }

  /**
   * Arc length of the feature arc (feature radius × sweep), not the offset
   * dimension-arc radius.
   */
  protected override getMeasurementPropertyValue() {
    if (this.measurement != null) return this.measurement
    const featureRadius = this.centerPoint.distanceTo(this.xLine1Point)
    const { sweep } = acdbResolveAngularSweep({
      center: this.centerPoint,
      xLine1: this.xLine1Point,
      xLine2: this.xLine2Point,
      arcPoint: this.arcPoint
    })
    return featureRadius * sweep
  }

  createDimBlock(blockName: string) {
    const style = this.dimensionStyle
    acdbEnsureDimArrowBlocks(this.database, style)

    const block = acdbCreateEmptyDimBlock(blockName)
    const a1 = acdbAngleOfPoints(this.centerPoint, this.xLine1Point)
    const a2 = acdbAngleOfPoints(this.centerPoint, this.xLine2Point)
    const dimRadius = Math.max(this.centerPoint.distanceTo(this.arcPoint), 1e-9)
    const { start, end, sweep } = acdbResolveAngularSweep({
      center: this.centerPoint,
      xLine1: this.xLine1Point,
      xLine2: this.xLine2Point,
      arcPoint: this.arcPoint
    })

    if (style.dimse1 === 0) {
      block.appendEntity(
        acdbCreateDimLineEntity(
          this.xLine1Point,
          acdbPointAt(this.centerPoint, a1, dimRadius),
          style,
          'extension'
        )
      )
    }
    if (style.dimse2 === 0) {
      block.appendEntity(
        acdbCreateDimLineEntity(
          this.xLine2Point,
          acdbPointAt(this.centerPoint, a2, dimRadius),
          style,
          'extension'
        )
      )
    }

    const midAngle = start + sweep / 2
    if (style.dimsd1 === 0 && style.dimsd2 === 0) {
      block.appendEntity(
        acdbCreateDimArcEntity(
          this.centerPoint,
          dimRadius,
          start,
          end,
          style
        )
      )
    } else if (style.dimsd1 === 0 || style.dimsd2 === 0) {
      if (style.dimsd1 === 0) {
        block.appendEntity(
          acdbCreateDimArcEntity(
            this.centerPoint,
            dimRadius,
            start,
            midAngle,
            style
          )
        )
      }
      if (style.dimsd2 === 0) {
        block.appendEntity(
          acdbCreateDimArcEntity(
            this.centerPoint,
            dimRadius,
            midAngle,
            end,
            style
          )
        )
      }
    }

    const scale = acdbArrowScaleFromStyle(style, this)
    const arrow1 = acdbResolveArrowBlockName(
      style.dimsah === 0 ? style.dimblk : style.dimblk1
    )
    const arrow2 = acdbResolveArrowBlockName(
      style.dimsah === 0 ? style.dimblk : style.dimblk2
    )
    if (style.dimtsz <= 0) {
      const aStart = acdbCreateDimArrowInsert(
        acdbPointAt(this.centerPoint, start, dimRadius),
        start - Math.PI / 2,
        scale,
        arrow1
      )
      const aEnd = acdbCreateDimArrowInsert(
        acdbPointAt(this.centerPoint, end, dimRadius),
        end + Math.PI / 2,
        scale,
        arrow2
      )
      if (aStart) block.appendEntity(aStart)
      if (aEnd) block.appendEntity(aEnd)
    }

    const gap =
      (style.dimgap >= 0 ? style.dimgap : 0) * acdbDimFeatureScale(style, this)
    const textPos = acdbPointAt(
      this.centerPoint,
      midAngle,
      dimRadius + gap + acdbTextHeightFromStyle(style, this) * 0.5
    )
    this.textPosition = textPos
    const contents = acdbBuildAnnotationText(
      this.getMeasurementPropertyValue() ?? 0,
      this.dimensionText,
      style,
      'linear'
    )
    const mtext = acdbCreateDimMText({
      contents,
      position: textPos,
      rotation: midAngle + Math.PI / 2,
      style,
      entity: this
    })
    if (mtext) block.appendEntity(mtext)

    return block
  }

  /**
   * Writes DXF fields for this object.
   *
   * @param filer - DXF output writer.
   * @returns The instance (for chaining).
   */
  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbArcDimension')
    filer.writePoint3d(13, this.xLine1Point)
    filer.writePoint3d(14, this.xLine2Point)
    filer.writePoint3d(15, this.centerPoint)
    filer.writePoint3d(16, this.arcPoint)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    filer.atSubclassData('AcDbArcDimension')

    let x1 = this.xLine1Point.x
    let y1 = this.xLine1Point.y
    let z1 = this.xLine1Point.z
    let x2 = this.xLine2Point.x
    let y2 = this.xLine2Point.y
    let z2 = this.xLine2Point.z
    let cx = this.centerPoint.x
    let cy = this.centerPoint.y
    let cz = this.centerPoint.z
    let ax = this.arcPoint.x
    let ay = this.arcPoint.y
    let az = this.arcPoint.z

    while (!filer.atEndOfObject && !filer.atEof && !filer.atExtendedData) {
      const item = filer.readItem()
      if (!item) break
      const code = Number(item.code)
      const n = Number(item.value)
      switch (code) {
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
          cx = n
          break
        case 25:
          cy = n
          break
        case 35:
          cz = n
          break
        case 16:
          ax = n
          break
        case 26:
          ay = n
          break
        case 36:
          az = n
          break
        default:
          break
      }
    }
    this.xLine1Point = new AcGePoint3d(x1, y1, z1)
    this.xLine2Point = new AcGePoint3d(x2, y2, z2)
    this.centerPoint = new AcGePoint3d(cx, cy, cz)
    this.arcPoint = new AcGePoint3d(ax, ay, az)
    return this
  }
}
