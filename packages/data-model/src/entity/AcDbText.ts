import { AcGeBox3d, AcGePoint3d } from '@mlightcad/geometry-engine'
import {
  AcGiBaseTextStyle,
  AcGiMTextAttachmentPoint,
  AcGiMTextData,
  AcGiMTextFlowDirection,
  AcGiRenderer
} from '@mlightcad/graphic-interface'

import { AcDbEntity } from './AcDbEntity'

/**
 * The horizontal mode of the text
 */
export enum AcDbTextHorizontalMode {
  LEFT = 0,
  CENTER = 1,
  RIGHT = 2,
  ALIGNED = 3,
  MIDDLE = 4,
  FIT = 5
}

/**
 * The vertical mode of the text
 */
export enum AcDbTextVerticalMode {
  BASELINE = 0,
  BOTTOM = 1,
  MIDDLE = 2,
  TOP = 3
}

/**
 * The class represents the text entity in AutoCAD.
 */
export class AcDbText extends AcDbEntity {
  private _textString: string
  private _thickness: number
  private _height: number
  private _position: AcGePoint3d
  private _rotation: number
  private _oblique: number
  private _horizontalMode: AcDbTextHorizontalMode
  private _verticalModel: AcDbTextVerticalMode
  private _styleName: string
  private _widthFactor: number

  constructor() {
    super()
    this._textString = ''
    this._height = 0
    this._thickness = 1
    this._position = new AcGePoint3d()
    this._rotation = 0
    this._oblique = 0
    this._horizontalMode = AcDbTextHorizontalMode.LEFT
    this._verticalModel = AcDbTextVerticalMode.MIDDLE
    this._styleName = ''
    this._widthFactor = 1
  }

  /**
   * The text string used by this entity
   */
  get textString() {
    return this._textString
  }
  set textString(value: string) {
    this._textString = value
  }

  /**
   * The thickness for the text. The thickness is the text's dimension along its normal vector
   * direction (sometimes called the extrusion direction).
   */
  get thickness() {
    return this._thickness
  }
  set thickness(value: number) {
    this._thickness = value
  }

  /**
   * The height of the text. The height value is used as a scale factor for both height and width
   * of the text.
   */
  get height() {
    return this._height
  }
  set height(value: number) {
    this._height = value
  }

  /**
   * The insertion point of the text in WCS coordinates.
   */
  get position() {
    return this._position
  }
  set position(value: AcGePoint3d) {
    this._position.copy(value)
  }

  /**
   * The rotation angle of the text. The rotation angle is relative to the X axis of the text's OCS,
   * with positive angles going counterclockwise when looking down the Z axis toward the origin. The
   * OCS X axis is determined by using the text's normal vector, the WCS Z axis, and the arbitrary
   * axis algorithm.
   */
  get rotation() {
    return this._rotation
  }
  set rotation(value: number) {
    this._rotation = value
  }

  /**
   * The oblique angle (in radians) of the text. The obliquing angle is the angle from the text's
   * vertical; that is, the top of the text "slants" relative to the bottom, the same as the slope
   * in this italic text. Positive angles slant characters forward at their tops. Negative angles
   * have 2pi added to them to convert them to their positive equivalent.
   */
  get oblique() {
    return this._oblique
  }
  set oblique(value: number) {
    this._oblique = value
  }

  /**
   * The horizontal mode of the text
   */
  get horizontalMode() {
    return this._horizontalMode
  }
  set horizontalMode(value: AcDbTextHorizontalMode) {
    this._horizontalMode = value
  }

  /**
   * The vertical mode of the text
   */
  get verticalMode() {
    return this._verticalModel
  }
  set verticalMode(value: AcDbTextVerticalMode) {
    this._verticalModel = value
  }

  /**
   * The style name stored in text style table record and used by this text entity
   */
  get styleName() {
    return this._styleName
  }
  set styleName(value: string) {
    this._styleName = value
  }

  /**
   * The width factor (also referred to as the relative X-scale factor) for the text. The widthFactor
   * is applied to the text's width to allow the width to be adjusted independently of the height.
   * For example, if the widthFactor value is 0.8, then the text is drawn with a width that is 80% of
   * its normal "unadjusted" width.
   */
  get widthFactor() {
    return this._widthFactor
  }
  set widthFactor(value: number) {
    this._widthFactor = value
  }

  /**
   * @inheritdoc
   */
  get geometricExtents(): AcGeBox3d {
    // TODO: Implement it correctly
    return new AcGeBox3d()
  }

  private getTextStyle(): AcGiBaseTextStyle {
    const textStyleTable = this.database.tables.textStyleTable
    let style = textStyleTable.getAt(this.styleName)
    if (!style) {
      style = (textStyleTable.getAt('STANDARD') ||
        textStyleTable.getAt('Standard'))!
    }
    return style.textStyle
  }

  /**
   * @inheritdoc
   */
  draw(renderer: AcGiRenderer) {
    const mtextData: AcGiMTextData = {
      text: this.textString,
      height: this.height,
      width: Infinity,
      widthFactor: this.widthFactor,
      position: this.position,
      // Please use 'rotation' and do not set value of 'directionVector' because it will overrides
      // rotation value.
      rotation: this.rotation,
      // MText draw text from top to bottom.
      drawingDirection: AcGiMTextFlowDirection.BOTTOM_TO_TOP,
      attachmentPoint: AcGiMTextAttachmentPoint.BottomLeft
    }
    const textStyle = { ...this.getTextStyle(), color: this.rgbColor }
    return renderer.mtext(mtextData, textStyle)
  }
}
