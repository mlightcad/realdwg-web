import {
  AcGeBox3d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGeVector3d
} from '@mlightcad/geometry-engine'
import {
  AcGiBaseTextStyle,
  AcGiRenderer,
  AcGiTextStyle
} from '@mlightcad/graphic-interface'
import {
  AcGiMTextAttachmentPoint,
  AcGiMTextData,
  AcGiMTextFlowDirection
} from '@mlightcad/graphic-interface'

import { AcDbEntity } from './AcDbEntity'

/**
 * The class represents the mtext (multiline text) entity in AutoCAD.
 */
export class AcDbMText extends AcDbEntity {
  private _height: number
  private _width: number
  private _contents: string
  private _lineSpacingStyle: number
  private _lineSpacingFactor: number
  private _backgroundFill: boolean
  private _backgroundFillColor: number
  private _backgroundScaleFactor: number
  private _backgroundFillTransparency: number
  private _rotation: number
  private _styleName: string
  private _location: AcGePoint3d
  private _attachmentPoint: AcGiMTextAttachmentPoint
  private _direction: AcGeVector3d
  private _drawingDirection: AcGiMTextFlowDirection

  constructor() {
    super()
    this._contents = ''
    this._height = 0
    this._width = 0
    this._lineSpacingFactor = 0.25
    this._lineSpacingStyle = 0
    this._backgroundFill = false
    this._backgroundFillColor = 0xc8c8c8
    this._backgroundFillTransparency = 1
    this._backgroundScaleFactor = 1
    this._rotation = 0
    this._styleName = ''
    this._location = new AcGePoint3d()
    this._attachmentPoint = AcGiMTextAttachmentPoint.TopLeft
    this._direction = new AcGeVector3d(1, 0, 0)
    this._drawingDirection = AcGiMTextFlowDirection.LEFT_TO_RIGHT
  }

  /**
   * Returns a string that contains the contents of the mtext object. Formatting data used for word
   * wrap calculations is removed
   */
  get contents() {
    return this._contents
  }
  set contents(value: string) {
    this._contents = value
  }

  /**
   * The height of the text.
   */
  get height() {
    return this._height
  }
  set height(value: number) {
    this._height = value
  }

  /**
   * The maximum width setting used by the MText object for word wrap formatting. It is possible that
   * none of the lines resulting from word wrap formatting will reach this width value. Words which
   * exceed this width value will not be broken, but will extend beyond the given width.
   */
  get width() {
    return this._width
  }
  set width(value: number) {
    this._width = value
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
   * The line spacing factor (a value between 0.25 and 4.00).
   */
  get lineSpacingFactor() {
    return this._lineSpacingFactor
  }
  set lineSpacingFactor(value: number) {
    this._lineSpacingFactor = value
  }

  /**
   * The line spacing style.
   */
  get lineSpacingStyle() {
    return this._lineSpacingStyle
  }
  set lineSpacingStyle(value: number) {
    this._lineSpacingStyle = value
  }

  /**
   * Toggle the background fill on or off. If it is true, background color is turned off, and no
   * background fill color has been specified, this function sets the background fill color to
   * an RGB value of 200,200,200.
   */
  get backgroundFill() {
    return this._backgroundFill
  }
  set backgroundFill(value: boolean) {
    this._backgroundFill = value
    this._backgroundFillColor = 0xc8c8c8
  }

  /**
   * The background fill color. This property is valid only if background fill is enable.
   */
  get backgroundFillColor() {
    return this._backgroundFillColor
  }
  set backgroundFillColor(value: number) {
    this._backgroundFillColor = value
  }

  /**
   * The background fill transparency. This property is valid only if background fill is enable.
   */
  get backgroundFillTransparency() {
    return this._backgroundFillTransparency
  }
  set backgroundFillTransparency(value: number) {
    this._backgroundFillTransparency = value
  }

  /**
   * The background scale factor.
   */
  get backgroundScaleFactor() {
    return this._backgroundScaleFactor
  }
  set backgroundScaleFactor(value: number) {
    this._backgroundScaleFactor = value
  }

  /**
   * The style name stored in text ttyle table record and used by this text entity
   */
  get styleName() {
    return this._styleName
  }
  set styleName(value: string) {
    this._styleName = value
  }

  /**
   * The insertion point of this mtext entity.
   */
  get location() {
    return this._location
  }
  set location(value: AcGePoint3dLike) {
    this._location.copy(value)
  }

  /**
   * The attachment point value which determines how the text will be oriented around the insertion point
   * of the mtext object. For example, if the attachment point is AcGiAttachmentPoint.MiddleCenter, then
   * the text body will be displayed such that the insertion point appears at the geometric center of the
   * text body.
   */
  get attachmentPoint() {
    return this._attachmentPoint
  }
  set attachmentPoint(value: AcGiMTextAttachmentPoint) {
    this._attachmentPoint = value
  }

  /**
   * Represent the X axis ("horizontal") for the text. This direction vector is used to determine the text
   * flow direction.
   */
  get direction() {
    return this._direction
  }
  set direction(value: AcGeVector3d) {
    this._direction.copy(value)
  }

  get drawingDirection() {
    return this._drawingDirection
  }
  set drawingDirection(value: AcGiMTextFlowDirection) {
    this._drawingDirection = value
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
      text: this.contents,
      height: this.height,
      width: this.width,
      position: this.location,
      rotation: this.rotation,
      directionVector: this.direction,
      attachmentPoint: this.attachmentPoint,
      drawingDirection: this.drawingDirection,
      lineSpaceFactor: this.lineSpacingFactor
    }
    const textStyle: AcGiTextStyle = {
      ...this.getTextStyle(),
      color: this.rgbColor
    }
    return renderer.mtext(mtextData, textStyle)
  }
}
