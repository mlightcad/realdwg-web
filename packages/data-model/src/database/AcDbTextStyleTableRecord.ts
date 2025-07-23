import { AcGiBaseTextStyle } from '@mlightcad/graphic-interface'

import { AcDbSymbolTableRecord } from './AcDbSymbolTableRecord'

/**
 * This class represents the records that are found in the text style table (known as the "style"
 * table in DXF). Each of these records represents a specific set of text parameters such as font,
 * default size, relative x scaling, vertical or horizontal, etc.
 */
export class AcDbTextStyleTableRecord extends AcDbSymbolTableRecord {
  private _textStyle: AcGiBaseTextStyle
  private _isVertical: boolean

  constructor(textStyle: AcGiBaseTextStyle) {
    super()
    this.name = textStyle.name
    this._textStyle = textStyle
    // Property `font` in text style may be empty string
    // If it contans file extension, just remove file extension.
    this._textStyle.font = this.getFileNameWithoutExtension(
      this._textStyle.font || this._textStyle.extendedFont || this.name
    )
    this._isVertical = false
  }

  /**
   * The obliquing angle. The obliquing angle is the angle from the text's vertical; that is, the
   * top of the text "slants" relative to the bottom--the same as the slope in this italic text.
   * Positive angles slant characters forward at their tops. Negative angles have 2pi added to them
   * to convert them to their positive equivalent.
   */
  get obliquingAngle() {
    return this._textStyle.obliqueAngle
  }
  set obliquingAngle(value: number) {
    this._textStyle.obliqueAngle = value
  }

  /**
   * The text height used for the last text created using this text style. This value is updated
   * automatically by AutoCAD after the creation of any text object that references this text style
   * table record. If the textSize value for this text style is 0, then the priorSize value is used
   * by AutoCAD as the default text height for the next text created using this text style.
   *
   * This value is automatically changed by the use of the text command. It will only be automatically
   * changed if the textSize is set to 0 so that users are prompted for a height.
   */
  get priorSize() {
    return this._textStyle.lastHeight
  }
  set priorSize(value: number) {
    this._textStyle.lastHeight = value
  }

  /**
   * The default size of the text drawn with this text style. If the text size is set to 0, then each
   * use of the AutoCAD text commands prompt for a text height to use in creating the text entity. If
   * textSize is non-zero, the text command will not prompt for a text height and will use this value.
   */
  get textSize() {
    return this._textStyle.fixedTextHeight
  }
  set textSize(value: number) {
    this._textStyle.fixedTextHeight = value
  }

  /**
   * The width factor (also referred to as the relative X-scale factor) for the text style table
   * record. The width factor is applied to the text's width to allow the width to be adjusted
   * independently of the height. For example, if the width factor value is 0.8, then the text is
   * drawn with a width that is 80% of its normal "unadjusted" width.
   */
  get xScale() {
    return this._textStyle.widthFactor
  }
  set xScale(value: number) {
    this._textStyle.widthFactor = value
  }

  /**
   * True if text drawn with this text style is drawn vertically. Faslse otherwise.
   */
  get isVertical() {
    return this._isVertical
  }
  set isVertical(value: boolean) {
    this._isVertical = value
  }

  /**
   * The name of the font file for this text style
   */
  get fileName() {
    return this._textStyle.font
  }
  set fileName(value: string) {
    this._textStyle.font = value
  }

  /**
   * The name of the big font file for this text style
   */
  get bigFontFileName() {
    return this._textStyle.bigFont
  }
  set bigFontFileName(value: string) {
    this._textStyle.bigFont = value
  }

  /**
   * Text style information used by renderer.
   */
  get textStyle() {
    return this._textStyle
  }

  private getFileNameWithoutExtension(pathName: string) {
    const fileName = pathName.split('/').pop()
    if (fileName) {
      // Find the last dot to separate the extension, if any
      const dotIndex = fileName.lastIndexOf('.')

      // If no dot is found, return the file name as is
      if (dotIndex === -1) {
        return fileName
      }

      // Otherwise, return the part before the last dot (file name without extension)
      return fileName.substring(0, dotIndex)
    }
    return pathName
  }
}
