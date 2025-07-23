import {
  AcGeBox3d,
  AcGePoint3d,
  AcGePoint3dLike
} from '@mlightcad/geometry-engine'
import {
  AcGiEntity,
  AcGiLineArrowStyle,
  AcGiRenderer
} from '@mlightcad/graphic-interface'

import { AcDbLine } from '../AcDbLine'
import { AcDbDimension } from './AcDbDimension'

/**
 * This class represents the diameter dimension type in AutoCAD. This dimension type requires two points
 * that define a diameter chord on the curve being dimensioned to be able to draw the dimension line from
 * one chord point to the other. In addition, if the text is located outside the curve being dimensioned,
 * then a "leader length" value is used to determine how far the dimension line extends out past the curve
 * before doing a horizontal dogleg (if necessary) to the annotation text.
 *
 * - If the text is inside the curve being dimensioned, then the dimension line will be drawn from
 * the farChordPoint to the chordPoint, with a break for the annotation text.
 * - If the dimension text is outside the curve being dimensioned, then the dimension line is drawn
 * from the farChordPoint, on through the chordPoint, and out the leaderLength distance past the
 * chordPoint, where it will do a short horizontal dogleg (if appropriate) to the annotation text.
 */
export class AcDbDiametricDimension extends AcDbDimension {
  private _chordPoint: AcGePoint3d
  private _farChordPoint: AcGePoint3d
  private _extArcStartAngle: number
  private _extArcEndAngle: number
  private _leaderLength: number

  /**
   * Create one instance of this class using the provided parameters
   * @param chordPoint Input point (in WCS coordinates) on the curve being dimensioned
   * @param farChordPoint Input point (in WCS coordinates) on curve being dimensioned and diametrically
   * opposite the chordPoint
   * @param leaderLength Input leader length
   */
  constructor(
    chordPoint: AcGePoint3dLike,
    farChordPoint: AcGePoint3dLike,
    leaderLength: number = 0,
    dimText: string | null = null,
    dimStyle: string | null = null
  ) {
    super()
    this._chordPoint = new AcGePoint3d().copy(chordPoint)
    this._farChordPoint = new AcGePoint3d().copy(farChordPoint)
    this._extArcStartAngle = 0
    this._extArcEndAngle = 0
    this._leaderLength = leaderLength

    this.dimensionText = dimText
    // TODO: Set it to the current default dimStyle within the AutoCAD editor if dimStyle is null
    this.dimensionStyleName = dimStyle
  }

  /**
   * The point (in WCS coordinates) where the dimension line intersects the curve being dimensioned and
   * extends outside the curve, if the text is outside the curve.
   */
  get chordPoint() {
    return this._chordPoint
  }
  set chordPoint(value: AcGePoint3d) {
    this._chordPoint.copy(value)
  }

  /**
   * The far chord point (in WCS coordinates) of the curve being dimensioned. This is the point on the
   * curve that is diametrically opposite the point where the dimension line extends outside the curve,
   * if the text is outside the curve.
   */
  get farChordPoint() {
    return this._farChordPoint
  }
  set farChordPoint(value: AcGePoint3d) {
    this._farChordPoint.copy(value)
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
   * The dimension to use length as the distance from the chordPoint dimension definition point, out
   * to where the dimension will do a horizontal dogleg to the annotation text (or stop if no dogleg
   * is necessary).
   */
  get leaderLength() {
    return this._leaderLength
  }

  /**
   * @inheritdoc
   */
  get geometricExtents() {
    // TODO: Finish it
    return new AcGeBox3d()
  }

  protected drawLines(renderer: AcGiRenderer, lines: AcDbLine[]) {
    const results: AcGiEntity[] = []
    const count = lines.length
    if (count == 1) {
      results.push(
        this.drawLine(renderer, lines[0], {
          firstArrow: this.firstArrowStyle
        })
      )
    } else if (count == 3) {
      this.sortLines(lines)
      results.push(
        this.drawLine(renderer, lines[0], {
          firstArrow: this.firstArrowStyle
        })
      )
      results.push(this.drawLine(renderer, lines[1]))
      results.push(
        this.drawLine(renderer, lines[2], {
          firstArrow: this.firstArrowStyle
        })
      )
    } else {
      lines.forEach(line => {
        results.push(this.drawLine(renderer, line))
      })
    }
    return results
  }

  private drawLine(
    renderer: AcGiRenderer,
    line: AcDbLine,
    lineArrowStyle?: AcGiLineArrowStyle
  ) {
    if (lineArrowStyle) {
      const points = [line.startPoint, line.endPoint]
      return renderer.lines(points, {
        ...this.lineStyle,
        arrows: lineArrowStyle
      })
    } else {
      return line.draw(renderer)
    }
  }

  private sortLines(lines: AcDbLine[]) {
    // Function to compare positions of points
    const comparePoints = (a: AcGePoint3d, b: AcGePoint3d): number => {
      if (a.x !== b.x) return a.x - b.x
      if (a.y !== b.y) return a.y - b.y
      return a.z - b.z
    }

    // Sort segments based on the start points first, then end points
    lines.sort((segA, segB) => {
      const startCompare = comparePoints(segA.startPoint, segB.startPoint)
      if (startCompare !== 0) return startCompare
      return comparePoints(segA.endPoint, segB.endPoint)
    })
  }
}
