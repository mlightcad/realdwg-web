import { AcGeVector3d } from '@mlightcad/geometry-engine'

import { AcDbAlignedDimension } from './AcDbAlignedDimension.js'

/**
 * Represents a rotated linear dimension entity in AutoCAD.
 *
 * A rotated dimension is similar to an aligned dimension, but its dimension line
 * direction is controlled by an explicit rotation angle.
 */
export class AcDbRotatedDimension extends AcDbAlignedDimension {
  /** The entity type name */
  static override typeName: string = 'RotatedDimension'

  /**
   * The dimension line follows the explicit {@link rotation}, not the chord
   * between the extension line origins.
   *
   * @inheritdoc
   */
  protected override get dimLineAngle() {
    return this.rotation
  }

  /** @inheritdoc */
  protected override get hasFixedDimLineAngle() {
    return true
  }

  /**
   * Distance between the extension line origins projected onto the dimension
   * line direction.
   *
   * @inheritdoc
   */
  protected override computeMeasurement() {
    const direction = new AcGeVector3d(
      Math.cos(this.rotation),
      Math.sin(this.rotation),
      0
    )
    return Math.abs(
      new AcGeVector3d()
        .subVectors(this.xLine2Point, this.xLine1Point)
        .dot(direction)
    )
  }

  /**
   * @inheritdoc
   */
  protected override get dxfSubclassMarker() {
    return 'AcDbRotatedDimension'
  }
}
