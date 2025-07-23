import {
  AcGeBox3d,
  AcGeMatrix3d,
  AcGePoint3d,
  AcGePointLike
} from '@mlightcad/geometry-engine'
import { AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbEntity } from './AcDbEntity'

/**
 * The class represents the point entity in AutoCAD.
 */
export class AcDbPoint extends AcDbEntity {
  private _geo: AcGePoint3d
  /**
   * This constructor initializes the line object to use start as the start point, and end
   * as the endpoint. Both points must be in WCS coordinates.
   */
  constructor() {
    super()
    this._geo = new AcGePoint3d()
  }

  /**
   * The position of this point in WCS coordinates
   */
  get position(): AcGePoint3d {
    return this._geo
  }
  set position(value: AcGePointLike) {
    this._geo.set(value.x, value.y, value.z || 0)
  }

  /**
   * @inheritdoc
   */
  get geometricExtents(): AcGeBox3d {
    return new AcGeBox3d().expandByPoint(this._geo)
  }

  /**
   * @inheritdoc
   */
  transformBy(matrix: AcGeMatrix3d) {
    this._geo.applyMatrix3d(matrix)
    return this
  }

  /**
   * @inheritdoc
   */
  draw(renderer: AcGiRenderer) {
    return renderer.point(this._geo, {
      displayMode: this.database.pdmode,
      displaySize: this.database.pdsize,
      color: this.rgbColor
    })
  }
}
