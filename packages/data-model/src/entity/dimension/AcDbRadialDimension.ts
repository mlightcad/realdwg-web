import {
  AcGeBox3d,
  AcGePoint3d,
  AcGePoint3dLike
} from '@mlightcad/geometry-engine'
import { AcGiLineArrowStyle } from '@mlightcad/graphic-interface'

import { AcDbLine } from '../AcDbLine'
import { AcDbDimension } from './AcDbDimension'

/**
 * This class represents the radius dimension type in AutoCAD. This dimension type requires a center
 * point and a point on the curve being dimensioned in order to be able to draw the dimension line
 * from the center point through the point on the curve. In addition, it utilizes a "leader length"
 * value to determine how far the dimension line extends out past the curve before doing a horizontal
 * dogleg (if necessary) to the annotation text.
 */
export class AcDbRadialDimension extends AcDbDimension {
  private _center: AcGePoint3d
  private _chordPoint: AcGePoint3d
  private _extArcStartAngle: number
  private _extArcEndAngle: number
  private _leaderLength: number

  /**
   * Create one instance of this class by using the parameters passed in to initialize the dimension.
   * - If the text is inside the curve being dimensioned, then the dimension line is drawn from the
   * center to the chordPoint, with a break for the annotation text.
   * - If the dimension text is outside the curve being dimensioned, then the dimension line is drawn
   * from the center, on through the chordPoint and out the leaderLength distance past the chordPoint
   * where it does a short horizontal dogleg (if appropriate) to the annotation text.
   * @param center Input center point (in WCS coordinates) of curve being dimensioned
   * @param chordPoint Input point (in WCS coordinates) on the curve being dimensioned
   * @param leaderLength Input leader length
   * @param dimText	Input text string to use as the dimension annotation
   * @param dimStyle Input object ID of AcDbDimStyleTableRecord to use
   */
  constructor(
    center: AcGePoint3dLike,
    chordPoint: AcGePoint3dLike,
    leaderLength: number,
    dimText: string | null = null,
    dimStyle: string | null = null
  ) {
    super()
    this._center = new AcGePoint3d().copy(center)
    this._chordPoint = new AcGePoint3d().copy(chordPoint)
    this._leaderLength = leaderLength
    this._extArcStartAngle = 0
    this._extArcEndAngle = 0

    this.dimensionText = dimText
    // TODO: Set it to the current default dimStyle within the AutoCAD editor if dimStyle is null
    this.dimensionStyleName = dimStyle
  }

  /**
   * The center point (in WCS coordinates) of the curve being dimensioned.
   * Note: This point is the primary definition point for this dimension type.
   */
  get center() {
    return this._center
  }
  set center(value: AcGePoint3d) {
    this._center.copy(value)
  }

  /**
   * The point (in WCS coordinates) where the dimension line intersects the curve being dimensioned.
   */
  get chordPoint() {
    return this._chordPoint
  }
  set chordPoint(value: AcGePoint3d) {
    this._chordPoint.copy(value)
  }

  /**
   * The extension arc start angle.
   */
  get extArcStartAngle() {
    return this._extArcStartAngle
  }
  set extArcStartAngle(value: number) {
    this._extArcStartAngle = value
  }

  /**
   * The extension arc end angle.
   */
  get extArcEndAngle() {
    return this._extArcEndAngle
  }
  set extArcEndAngle(value: number) {
    this._extArcEndAngle = value
  }

  /**
   * The dimension uses length as the distance from the chordPoint dimension definition point out to
   * where the dimension does a horizontal dogleg to the annotation text (or stops if no dogleg is
   * necessary).
   */
  get leaderLength() {
    return this._leaderLength
  }
  set leaderLenght(value: number) {
    this._leaderLength = value
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
  protected getLineArrowStyle(_line: AcDbLine): AcGiLineArrowStyle | undefined {
    return {
      secondArrow: this.secondArrowStyle
    }
  }
}
