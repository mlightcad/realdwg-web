import {
  AcGeArea2d,
  AcGeBox3d,
  AcGeLoop2dType
} from '@mlightcad/geometry-engine'
import {
  AcGiHatchPatternLine,
  AcGiRenderer
} from '@mlightcad/graphic-interface'

import { AcDbEntity } from './AcDbEntity'

/**
 * Hatch pattern type
 */
export enum AcDbHatchPatternType {
  /**
   * A user-defined pattern provides a direct method to define a simple hatch pattern using a specified
   * hatch entity linetype. The definition data for user-defined hatch pattern include angle, space and
   * double. "Angle" specifies an angle for the hatch pattern relative to the X axis of the hatch plane
   * in OCS. "Space" defines the vertical distance between two consecutive pattern lines. "Double"
   * specifies that a second set of lines is to be drawn at 90 degrees to the original lines. When
   * specifying a user-defined hatch pattern, you don't need to set the pattern name. AutoCAD designates
   * a default pattern name "U" for all user-defined patterns.
   */
  UserDefined = 0,
  /**
   * A predefined pattern type allows you to select a hatch pattern from the AutoCAD standard hatch
   * pattern file acad.pat in the "support" directory. The file contains many predefined hatch patterns,
   * including ANGLE, ANSI31, BRICK, CLAY, etc. When you use a predefined pattern, you can also specify
   * a scale and angle in order to modify the hatch's appearance. Solid fill is a new predefined pattern
   * type that enables the application to fill in the hatch area with a specified color. The reserved
   * name for this new pattern is "SOLID." SOLID does not appear in the file acad.pat because it has no
   * definition data. To specify a solid, use the keyword "SOLID".
   */
  Predefined = 1,
  /**
   * A custom-defined pattern type stores the pattern in its own PAT file, in which the name of the
   * hatch pattern must match the name of the file. For instance, you must store the TEST hatch pattern
   * in a file named test.pat, and the file must be located in the ACAD search path. When you use a
   * custom-defined pattern, you can also specify a scale and angle in order to modify the hatch's
   * appearance.
   */
  Custom = 2
}

/**
 * Hatch style
 */
export enum AcDbHatchStyle {
  /**
   * Normal hatch style will hatch inward from the outer loop. If it encounters an internal intersection,
   * it turns off hatching until it encounters another intersection. Thus, areas separated from the
   * outside of the hatched area by an odd number of intersections are hatched, while areas separated by
   * an even number of intersections are not.
   */
  Normal = 0,
  /**
   * Outer hatch style will hatch inward from the outer loop. It turns off hatching if it encounters an
   * intersection and does not turn it back on. Because this process starts from both ends of each hatch
   * line, only the outmost level of the structure is hatched, and the internal structure is left blank.
   */
  Outer = 1,
  /**
   * Ignore hatch style will hatch inward from the outer loop and ignores all internal loops.
   */
  Ignore = 2
}

/**
 * The class represents the hatch entity in AutoCAD.
 */
export class AcDbHatch extends AcDbEntity {
  private _geo: AcGeArea2d
  private _elevation: number
  private _definitionLines: AcGiHatchPatternLine[]
  private _patternName: string
  private _patternType: AcDbHatchPatternType
  private _patternAngle: number
  private _patternScale: number
  private _hatchStyle: AcDbHatchStyle

  /**
   * Create one empty polyline
   */
  constructor() {
    super()
    this._elevation = 0
    this._geo = new AcGeArea2d()
    this._definitionLines = []
    this._patternName = ''
    this._patternType = AcDbHatchPatternType.Predefined
    this._patternAngle = 0
    this._patternScale = 1
    this._hatchStyle = AcDbHatchStyle.Normal
  }

  get definitionLines() {
    return this._definitionLines
  }

  /**
   * The pattern name of this hatch.
   */
  get patternName() {
    return this._patternName
  }
  set patternName(value: string) {
    this._patternName = value
  }

  /**
   * The pattern name of this hatch.
   */
  get patternType() {
    return this._patternType
  }
  set patternType(value: AcDbHatchPatternType) {
    this._patternType = value
  }

  /**
   * The pattern angle (in radians) of this hatch.
   */
  get patternAngle() {
    return this._patternAngle
  }
  set patternAngle(value: number) {
    this._patternAngle = value
  }

  /**
   * The pattern scale of the hatch entity. It is a non-zero positive number.
   */
  get patternScale() {
    return this._patternScale
  }
  set patternScale(value: number) {
    this._patternScale = value
  }

  /**
   * The pattern style of the hatch entity.
   */
  get hatchStyle() {
    return this._hatchStyle
  }
  set hatchStyle(value: AcDbHatchStyle) {
    this._hatchStyle = value
  }

  /**
   * Append one loop to loops of this area. If it is the first loop added, it is the outter loop.
   * Otherwise, it is an inner loop.
   * @param loop Input the loop to append
   */
  add(loop: AcGeLoop2dType) {
    this._geo.add(loop)
  }

  /**
   * @inheritdoc
   */
  get geometricExtents() {
    const box = this._geo.box
    return new AcGeBox3d(
      { x: box.min.x, y: box.min.y, z: this._elevation },
      { x: box.max.x, y: box.max.y, z: this._elevation }
    )
  }

  /**
   * @inheritdoc
   */
  draw(renderer: AcGiRenderer) {
    return renderer.area(this._geo, {
      color: this.rgbColor,
      solidFill: false,
      patternAngle: this.patternAngle,
      patternLines: this.definitionLines
    })
  }
}
