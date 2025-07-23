import { AcDbEntity } from './AcDbEntity'

export abstract class AcDbCurve extends AcDbEntity {
  /**
   * Return true if the curve is closed. It means its start point is identical to its end point.
   * Otherwise, return false.
   */
  abstract get closed(): boolean
}
