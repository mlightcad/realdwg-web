import {
  AcGeBox3d,
  AcGePoint3d,
  AcGePoint3dLike
} from '@mlightcad/geometry-engine'

import { AcDbDimension } from './AcDbDimension'

/**
 * This class represents the ordinate dimension type within AutoCAD. Ordinate dimensions measure
 * the "horizontal" (X axis) or "vertical" (Y axis) distance from a specified origin point to some
 * other specified point.
 * It measures the distance from the their origin point to their definingPoint along the X or Y
 * axis (as specified by the appropriate member function). They display a leader line from the
 * definingPoint to the leaderEndPoint, with the annotation text located appropriately near the
 * end of the leader.
 */
export class AcDbOrdinateDimension extends AcDbDimension {
  private _definingPoint: AcGePoint3d
  private _leaderEndPoint: AcGePoint3d

  /**
   * Create one instance of this class.
   * @param definingPoint Input point where ordinate leader should start
   * @param leaderEndPoint Input point where ordinate leader should end
   * @param dimText Input dimension text to use instead of calculated value
   * @param dimStyle Input string name of dimension style table record to use
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
   * The ordinate point (in WCS coordinates) to be measured. The dimension measures the X or Y
   * distance between this point and the dimension's origin point.
   */
  get definingPoint() {
    return this._definingPoint
  }
  set definingPoint(value: AcGePoint3d) {
    this._definingPoint.copy(value)
  }

  /**
   * The point that is used as the dimension leader's endpoint and is used in the text position
   * calculations.
   */
  get leaderEndPoint() {
    return this._leaderEndPoint
  }
  set leaderEndPoint(value: AcGePoint3d) {
    this._leaderEndPoint.copy(value)
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
  protected get arrowLineCount() {
    return 0
  }
}
