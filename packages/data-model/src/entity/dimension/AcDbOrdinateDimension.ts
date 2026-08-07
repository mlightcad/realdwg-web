import { AcCmColor, AcCmColorMethod } from '@mlightcad/common'
import {
  AcGeMatrix3d,
  AcGePoint3d,
  AcGePoint3dLike
} from '@mlightcad/geometry-engine'

import { AcDbDxfFiler } from '../../base'
import { AcDbBlockTableRecord } from '../../database'
import { AcDbEntityProperties } from '../AcDbEntityProperties'
import { AcDbLine } from '../AcDbLine'
import { AcDbMText } from '../AcDbMText'
import { AcDbDimension } from './AcDbDimension'

/**
 * Represents an ordinate dimension entity in AutoCAD.
 *
 * Ordinate dimensions measure the "horizontal" (X axis) or "vertical" (Y axis) distance
 * from a specified origin point to some other specified point. They are commonly used
 * in mechanical drawings, architectural plans, and other technical documentation where
 * precise coordinate measurements are required.
 *
 * The dimension displays a leader line from the defining point to the leader end point,
 * with the annotation text located appropriately near the end of the leader. Ordinate
 * dimensions are particularly useful for dimensioning parts with multiple features that
 * need to be positioned relative to a common reference point.
 */
export class AcDbOrdinateDimension extends AcDbDimension {
  /** The entity type name */
  static override typeName: string = 'OrdinateDimension'

  private _definingPoint: AcGePoint3d
  private _leaderEndPoint: AcGePoint3d

  /**
   * Creates a new ordinate dimension.
   *
   * @param definingPoint - The point where the ordinate leader should start. This is
   *                        the point being measured relative to the dimension's origin
   * @param leaderEndPoint - The point where the ordinate leader should end. This point
   *                         is used for the dimension leader's endpoint and in text
   *                         position calculations
   * @param dimText - Optional custom dimension text to display instead of the calculated
   *                  coordinate value. If null, the calculated coordinate will be displayed
   * @param dimStyle - Optional name of the dimension style table record to use for
   *                   formatting. If null, the current default style will be used
   */
  constructor(
    definingPoint: AcGePoint3dLike,
    leaderEndPoint: AcGePoint3dLike,
    dimText: string | null = null,
    dimStyle: string | null = null
  ) {
    super()
    this._definingPoint = new AcGePoint3d().copy(definingPoint)
    this._leaderEndPoint = new AcGePoint3d().copy(leaderEndPoint)

    this.dimensionText = dimText
    // TODO: Set it to the current default dimStyle within the AutoCAD editor if dimStyle is null
    this.dimensionStyleName = dimStyle
  }

  /**
   * Gets or sets the ordinate point to be measured.
   *
   * This is the point (in WCS coordinates) that defines the location being measured.
   * The dimension measures the X or Y distance between this point and the dimension's
   * origin point, depending on the orientation of the ordinate dimension.
   *
   * @returns The defining point of the ordinate dimension
   */
  get definingPoint() {
    return this._definingPoint
  }
  set definingPoint(value: AcGePoint3d) {
    this._definingPoint.copy(value)
  }

  /**
   * Gets or sets the leader end point.
   *
   * This point is used as the dimension leader's endpoint and is used in the text
   * position calculations. It determines where the leader line ends and where the
   * dimension text is positioned relative to the leader.
   *
   * @returns The leader end point of the ordinate dimension
   */
  get leaderEndPoint() {
    return this._leaderEndPoint
  }
  set leaderEndPoint(value: AcGePoint3d) {
    this._leaderEndPoint.copy(value)
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
              'definingPoint',
              () => this.definingPoint
            ),
            ...this.createPoint3dProperties(
              'leaderEndPoint',
              () => this.leaderEndPoint
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
    return [this.definingPoint, this.leaderEndPoint]
  }

  /**
   * @inheritdoc
   */
  protected override subTransformBy(matrix: AcGeMatrix3d) {
    this._definingPoint.applyMatrix4(matrix)
    this._leaderEndPoint.applyMatrix4(matrix)
  }

  /**
   * Gets the geometric extents (bounding box) of this dimension entity.
   *
   * The geometric extents define the minimum bounding box that completely contains
   * the dimension entity, including all its components like the leader line and text.
   *
   * @returns A 3D bounding box containing the dimension entity
   * @inheritdoc
   */
  get geometricExtents() {
    return this.getGeometricExtentsFromDimBlockOrPoints([
      this.definingPoint,
      this.leaderEndPoint
    ])
  }

  /**
   * Gets the number of arrow lines for this dimension.
   *
   * Ordinate dimensions typically don't use arrows since they are coordinate-based
   * measurements rather than distance measurements between two points.
   *
   * @returns The number of arrow lines (always 0 for ordinate dimensions)
   * @inheritdoc
   */
  protected get arrowLineCount() {
    return 0
  }

  /**
   * Lays the ordinate dimension out as a leader plus its annotation.
   *
   * AutoCAD draws a doglegged leader from the defining point to the leader end
   * point and puts the text just beyond it. The dogleg is only visible when the
   * two points are offset on both axes; when they line up the leader collapses
   * to a straight segment, which is the common case.
   */
  protected override createDimBlock(blockName: string) {
    const block = new AcDbBlockTableRecord()
    block.name = blockName

    const start = this.definingPoint
    const end = this.leaderEndPoint
    const scale = this.dimensionStyle.dimscale
    const annotationScale = Number.isFinite(scale) && scale > 0 ? scale : 1
    const gap = this.dimensionStyle.dimgap * annotationScale

    // Ordinate leaders run along the measured axis, so the elbow sits at the
    // end point's coordinate on that axis and the start point's on the other.
    const alongX = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)
    const elbow = alongX
      ? new AcGePoint3d(end.x, start.y, start.z)
      : new AcGePoint3d(start.x, end.y, start.z)

    const addSegment = (from: AcGePoint3d, to: AcGePoint3d) => {
      if (from.distanceTo(to) > 0) {
        block.appendEntity(new AcDbLine(from.clone(), to.clone()))
      }
    }
    addSegment(start, elbow)
    addSegment(elbow, new AcGePoint3d(end.x, end.y, start.z))

    const text = this.resolvedText(alongX)
    if (text) {
      const mtext = new AcDbMText()
      mtext.attachmentPoint = this.attachmentPoint
      mtext.layer = '0'
      mtext.color = new AcCmColor(AcCmColorMethod.ByBlock)
      mtext.contents = text
      mtext.height = this.dimensionStyle.dimtxt * annotationScale
      // Nudge the label clear of the leader tip along the leader direction.
      const dx = alongX ? Math.sign(end.x - start.x) || 1 : 0
      const dy = alongX ? 0 : Math.sign(end.y - start.y) || 1
      mtext.location = new AcGePoint3d(
        end.x + dx * gap,
        end.y + dy * gap,
        start.z
      )
      mtext.styleName = this.dimensionStyle.dimtxsty
      block.appendEntity(mtext)
    }

    return block
  }

  /**
   * Label for an ordinate dimension: the measured coordinate of the defining
   * point along the dimensioned axis, unless the file overrides it via group 1.
   *
   * @param alongX - True when the dimension measures the X ordinate.
   */
  private resolvedText(alongX: boolean) {
    const override = this.dimensionText
    if (override && override !== '<>') return override
    const cached = this.measurement
    const value =
      cached != null && Number.isFinite(cached) && cached >= 0
        ? cached
        : alongX
          ? this.definingPoint.x
          : this.definingPoint.y
    const decimals = this.dimensionStyle.dimdec
    const digits = Number.isFinite(decimals) && decimals >= 0 ? decimals : 2
    return (value * (this.dimensionStyle.dimlfac || 1)).toFixed(digits)
  }

  /**
   * Writes DXF fields for this object.
   *
   * @param filer - DXF output writer.
   * @returns The instance (for chaining).
   */
  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbOrdinateDimension')
    filer.writePoint3d(13, this.definingPoint)
    filer.writePoint3d(14, this.leaderEndPoint)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    filer.atSubclassData('AcDbOrdinateDimension')

    let dx = this.definingPoint.x
    let dy = this.definingPoint.y
    let dz = this.definingPoint.z
    let lx = this.leaderEndPoint.x
    let ly = this.leaderEndPoint.y
    let lz = this.leaderEndPoint.z

    const commit = () => {
      this.definingPoint = new AcGePoint3d(dx, dy, dz)
      this.leaderEndPoint = new AcGePoint3d(lx, ly, lz)
    }

    while (!filer.atEndOfObject && !filer.atEof && !filer.atExtendedData) {
      const item = filer.readItem()
      if (!item) break
      const code = Number(item.code)
      const n = Number(item.value)
      switch (code) {
        case 13:
          dx = n
          break
        case 23:
          dy = n
          break
        case 33:
          dz = n
          break
        case 14:
          lx = n
          break
        case 24:
          ly = n
          break
        case 34:
          lz = n
          break
        default:
          break
      }
    }

    commit()
    return this
  }
}
