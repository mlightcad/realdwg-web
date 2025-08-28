import {
  AcGeLine3d,
  AcGePoint2dLike,
  AcGePoint3d
} from '@mlightcad/geometry-engine'
import {
  AcGiArrowStyle,
  AcGiArrowType,
  AcGiLineArrowStyle,
  AcGiRenderer
} from '@mlightcad/graphic-interface'
import { AcDbObjectId } from 'base'

import { AcDbDimStyleTableRecord } from '../../database'
import { AcDbRenderingCache } from '../../misc'
import { AcDbEntity } from '../AcDbEntity'
import { AcDbLine } from '../AcDbLine'

/**
 * Defines the line spacing style for dimension text.
 */
export enum AcDbLineSpacingStyle {
  /** At least the specified spacing */
  AtLeast = 1,
  /** Exactly the specified spacing */
  Exactly = 2
}

/**
 * Abstract base class for all dimension entity types in AutoCAD.
 *
 * This class provides the fundamental functionality for all dimension entities,
 * including dimension text, style management, arrow handling, and measurement
 * calculations. The appearance of dimensions is controlled by dimension variable
 * settings and dimension styles.
 *
 * @example
 * ```typescript
 * class MyDimension extends AcDbDimension {
 *   // Implementation for specific dimension type
 *   draw(renderer: AcGiRenderer) {
 *     // Custom drawing logic
 *   }
 * }
 * ```
 */
export abstract class AcDbDimension extends AcDbEntity {
  /** The entity type name */
  static override typeName: string = 'Dimension'

  /** The block table record ID containing the dimension entities */
  private _dimBlockId: string | null
  /** The dimension style name used by this dimension */
  private _dimensionStyleName: string | null
  /** The user-supplied dimension annotation text */
  private _dimensionText: string | null
  /** The measured value of the dimension */
  private _measurement?: number
  /** The line spacing factor for dimension text */
  private _textLineSpacingFactor: number
  /** The line spacing style for dimension text */
  private _textLineSpacingStyle: AcDbLineSpacingStyle
  /** The position of the dimension text */
  private _textPosition: AcGePoint3d
  /** The rotation angle of the dimension text */
  private _textRotation: number
  /** The cached dimension style record */
  private _dimStyle?: AcDbDimStyleTableRecord

  /**
   * Creates a new dimension entity.
   *
   * This constructor initializes a dimension with default values.
   * Subclasses should override this constructor to set up dimension-specific properties.
   *
   * @example
   * ```typescript
   * const dimension = new MyDimension();
   * dimension.dimensionText = "10.0";
   * dimension.textPosition = new AcGePoint3d(5, 5, 0);
   * ```
   */
  constructor() {
    super()
    this._dimBlockId = null
    this._dimensionStyleName = null
    this._dimensionText = null
    this._textLineSpacingFactor = 1.0
    this._textLineSpacingStyle = AcDbLineSpacingStyle.AtLeast
    this._textPosition = new AcGePoint3d()
    this._textRotation = 0
  }

  /**
   * Gets the block table record ID containing the entities that this dimension displays.
   *
   * @returns The block table record ID, or null if not set
   *
   * @example
   * ```typescript
   * const blockId = dimension.dimBlockId;
   * console.log(`Dimension block ID: ${blockId}`);
   * ```
   */
  get dimBlockId() {
    return this._dimBlockId
  }

  /**
   * Sets the block table record ID for this dimension.
   *
   * @param value - The block table record ID, or null to clear
   *
   * @example
   * ```typescript
   * dimension.dimBlockId = "MyDimensionBlock";
   * ```
   */
  set dimBlockId(value: string | null) {
    this._dimBlockId = value
  }

  /**
   * Gets the dimension style name used by this dimension.
   *
   * @returns The dimension style name, or null if not set
   *
   * @example
   * ```typescript
   * const styleName = dimension.dimensionStyleName;
   * console.log(`Dimension style: ${styleName}`);
   * ```
   */
  get dimensionStyleName() {
    return this._dimensionStyleName
  }

  /**
   * Sets the dimension style name for this dimension.
   *
   * @param value - The dimension style name, or null to use default
   *
   * @example
   * ```typescript
   * dimension.dimensionStyleName = "Standard";
   * ```
   */
  set dimensionStyleName(value: string | null) {
    this._dimensionStyleName = value
  }

  /**
   * Gets the dimension style used by this dimension.
   *
   * This method returns the dimension style record associated with this dimension.
   * If no style is specified, it returns the default dimension style.
   *
   * @returns The dimension style record
   *
   * @example
   * ```typescript
   * const style = dimension.dimensionStyle;
   * console.log(`Style name: ${style.name}`);
   * ```
   */
  get dimensionStyle(): AcDbDimStyleTableRecord {
    if (this._dimStyle == null) {
      let dimStyle: AcDbDimStyleTableRecord | undefined = undefined
      if (this.dimensionStyleName) {
        dimStyle = this.database.tables.dimStyleTable.getAt(
          this.dimensionStyleName
        )
      }
      if (dimStyle == null) dimStyle = new AcDbDimStyleTableRecord()
      this._dimStyle = dimStyle
    }
    return this._dimStyle
  }

  /**
   * Gets the user-supplied dimension annotation text string.
   *
   * This string can contain multiline text formatting characters. The text can be:
   * - Empty string ('') for default text only
   * - Text with angle brackets for mixed default and user text (e.g., 'This is the default text <>')
   * - Period ('.') for no text
   * - User-defined text only
   *
   * @returns The dimension text string
   *
   * @example
   * ```typescript
   * const text = dimension.dimensionText;
   * console.log(`Dimension text: ${text}`);
   * ```
   */
  get dimensionText() {
    return this._dimensionText
  }
  set dimensionText(value: string | null) {
    this._dimensionText = value
  }

  /**
   * The current measurement value for this dimension
   */
  get measurement() {
    return this._measurement
  }
  set measurement(value: number | undefined) {
    this._measurement = value
  }

  /**
   * The line spacing factor (a value between 0.25 and 4.00).
   */
  get textLineSpacingFactor() {
    return this._textLineSpacingFactor
  }
  set textLineSpacingFactor(value: number) {
    this._textLineSpacingFactor = value
  }

  /**
   * The line spacing style for the dimension.
   */
  get textLineSpacingStyle() {
    return this._textLineSpacingStyle
  }
  set textLineSpacingStyle(value: AcDbLineSpacingStyle) {
    this._textLineSpacingStyle = value
  }

  /**
   * The dimension's text position point. This is the middle center point of the text (which is itself an
   * MText object with middle-center justification).
   */
  get textPosition() {
    return this._textPosition
  }
  set textPosition(value: AcGePoint3d) {
    this._textPosition.copy(value)
  }

  /**
   * The rotation angle (in radians) of the dimension's annotation text. This is the angle from the
   * dimension's horizontal axis to the horizontal axis used by the text. The angle is in the dimension's
   * OCS X-Y plane with positive angles going counterclockwise when looking down the OCS Z axis towards
   * the OCS origin. The value obtained from: (2 * pi) + the dimension's text rotation angle--the
   * dimension's horizontal rotation angle
   */
  get textRotation() {
    return this._textRotation
  }
  set textRotation(value: number) {
    this._textRotation = value
  }

  /**
   * @inheritdoc
   */
  draw(renderer: AcGiRenderer) {
    if (this.dimBlockId) {
      const blockTableRecord = this.database.tables.blockTable.getAt(
        this.dimBlockId
      )
      if (blockTableRecord) {
        return AcDbRenderingCache.instance.draw(
          renderer,
          blockTableRecord,
          this.rgbColor,
          false
        )
      }
    }
    return renderer.group([])
  }

  protected drawFirstArrow(renderer: AcGiRenderer) {
    const blockTableRecord = this.database.tables.blockTable.getAt(
      this.firstArrowType
    )
    if (blockTableRecord) {
      return AcDbRenderingCache.instance.draw(
        renderer,
        blockTableRecord,
        this.rgbColor,
        false
      )
    }
    return undefined
  }

  protected drawSecondArrow(renderer: AcGiRenderer) {
    const blockTableRecord = this.database.tables.blockTable.getAt(
      this.secondArrowType
    )
    if (blockTableRecord) {
      return AcDbRenderingCache.instance.draw(
        renderer,
        blockTableRecord,
        this.rgbColor,
        false
      )
    }
    return undefined
  }

  protected get arrowScaleFactor() {
    const dimStyle = this.dimensionStyle
    // TODO:
    // 1. DIMASZ has no effect when DIMTSZ is other than zero.
    // 2. Calculate scale factor based on unit
    return dimStyle.dimasz
  }

  /**
   * Arrow style of the first arrow
   */
  protected get firstArrowStyle(): AcGiArrowStyle {
    return {
      type: this.firstArrowType,
      scale: this.arrowScaleFactor,
      appended: this.isAppendArrow,
      visible: this.dimensionStyle.dimse1 == 0
    }
  }

  /**
   * Arrow style of the second arrow
   */
  protected get secondArrowStyle(): AcGiArrowStyle {
    return {
      type: this.secondArrowType,
      scale: this.arrowScaleFactor,
      appended: this.isAppendArrow,
      visible: this.dimensionStyle.dimse2 == 0
    }
  }

  /**
   * The flag to determinate how to attach arrow to endpoint of the line.
   * - true: append arrow to endpoint of the line
   * - false: overlap arrow with endpoint of the line
   */
  protected get isAppendArrow() {
    return true
  }

  /**
   * The BTR id associated with the first arrow type
   */
  protected get firstArrowTypeBtrId() {
    const dimStyle = this.dimensionStyle
    return dimStyle.dimsah == 0 ? dimStyle.dimblk : dimStyle.dimblk1
  }

  /**
   * The first arrow type
   */
  protected get firstArrowType() {
    const btrId = this.firstArrowTypeBtrId
    return this.getArrowName(btrId)
  }

  /**
   * The BTR id associated with the second arrow type
   */
  protected get secondArrowTypeBtrId() {
    const dimStyle = this.dimensionStyle
    return dimStyle.dimsah == 0 ? dimStyle.dimblk : dimStyle.dimblk2
  }

  /**
   * The second arrow type
   */
  protected get secondArrowType() {
    const btrId = this.secondArrowTypeBtrId
    return this.getArrowName(btrId)
  }

  /**
   * The maximum number of arrow lines of this dimension
   */
  protected get arrowLineCount() {
    return 1
  }

  /**
   * Get line arrow style of the specified line according to its type (extension line or dimension
   * line). Return undefined if no line arrow style applied.
   * @param line Input line to get its line style
   * @returns Return the line style of the specified line. Return undefined if no line arrow style applied.
   */
  // @ts-expect-error not use '_' prefix so that typedoc can the correct parameter to generate doc
  protected getLineArrowStyle(line: AcDbLine): AcGiLineArrowStyle | undefined {
    return undefined
  }

  /**
   * Find the point `p3` on a line along the line direction at a distance `length` from `p2`.
   *
   * @param p1 - The start point of the line.
   * @param p2 - The end point of the line.
   * @param length - The distance from `p2` to `p3`.
   * @returns Return the point `p3`.
   */
  protected findPointOnLine1(
    p1: AcGePoint3d,
    p2: AcGePoint3d,
    length: number
  ): AcGePoint3d {
    // Calculate the direction vector from p1 to p2
    const direction = new AcGePoint3d().subVectors(p2, p1).normalize()

    // Calculate p3 by moving in the direction from p2 by the specified length
    const p3 = new AcGePoint3d(p2).addScaledVector(direction, length)

    return p3
  }

  /**
   * Find the point `p2` on a line starting from `p1` at a specified angle
   * and at a distance `length` from `p1`.
   *
   * @param p1 - The start point of the line.
   * @param angle - The angle of the line in radians relative to the x-axis.
   * @param length - The distance from `p1` to `p2`.
   * @returns Return the point `p2`.
   */
  protected findPointOnLine2(
    p1: AcGePoint2dLike,
    angle: number,
    length: number
  ): AcGePoint2dLike {
    // Calculate the new point p2
    const x = p1.x + length * Math.cos(angle)
    const y = p1.y + length * Math.sin(angle)
    return { x, y }
  }

  /**
   * Adjust start point and end point of extension line according current dimension style
   * @param extensionLine Input extension line to adjust its start point and end point
   */
  protected adjustExtensionLine(extensionLine: AcGeLine3d) {
    const dimStyle = this.dimensionStyle
    extensionLine.extend(dimStyle.dimexe)
    extensionLine.extend(-dimStyle.dimexo, true)
  }

  /**
   * Get dimension style name by dimension block id
   * @param id Input dimension block id
   * @returns Return dimension style name by dimension block id
   */
  private getArrowName(id: AcDbObjectId) {
    const blockTableRecord = this.database.tables.blockTable.getIdAt(id)
    return (
      blockTableRecord
        ? blockTableRecord.name.toUpperCase()
        : AcGiArrowType.Closed
    ) as AcGiArrowType
  }
}
