import { AcGePointLike } from '@mlightcad/geometry-engine'

import { AcDbAlignedDimension } from './AcDbAlignedDimension'

/**
 * Represents a rotated linear dimension entity in AutoCAD.
 *
 * A rotated dimension is similar to an aligned dimension, but its dimension line
 * direction is controlled by an explicit rotation angle.
 */
export class AcDbRotatedDimension extends AcDbAlignedDimension {
  /** The entity type name */
  static override typeName: string = 'RotatedDimension'

  constructor(
    xLine1Point: AcGePointLike,
    xLine2Point: AcGePointLike,
    dimLinePoint: AcGePointLike,
    dimText: string | null = null,
    dimStyle: string | null = null
  ) {
    super(xLine1Point, xLine2Point, dimLinePoint, dimText, dimStyle)
    // Group 70 low bits: 0 = rotated.
    this.dimensionType = 0
  }

  /**
   * @inheritdoc
   */
  protected override get dxfSubclassMarker() {
    return 'AcDbRotatedDimension'
  }
}
