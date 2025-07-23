import {
  AcGeBox3d,
  AcGePoint3d,
  AcGeVector3d
} from '@mlightcad/geometry-engine'
import { AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbCurve } from './AcDbCurve'

/**
 * The class represents the XLINE entity type within AutoCAD. An xline entity is a line that extends to
 * infinity in both directions.
 */
export class AcDbXline extends AcDbCurve {
  private _basePoint: AcGePoint3d
  private _unitDir: AcGeVector3d

  /**
   * Create one empty polyline
   */
  constructor() {
    super()
    this._basePoint = new AcGePoint3d()
    this._unitDir = new AcGeVector3d()
  }

  /**
   * The base point of the xline.
   */
  get basePoint() {
    return this._basePoint
  }
  set basePoint(value: AcGePoint3d) {
    this._basePoint.copy(value)
  }

  /**
   * The second point of the xline.
   */
  get unitDir() {
    return this._unitDir
  }
  set unitDir(value: AcGePoint3d) {
    this._unitDir.copy(value)
  }

  /**
   * @inheritdoc
   */
  get closed(): boolean {
    return false
  }

  /**
   * @inheritdoc
   */
  get geometricExtents(): AcGeBox3d {
    const extents = new AcGeBox3d()
    extents.expandByPoint(
      this._unitDir.clone().multiplyScalar(10).add(this._basePoint)
    )
    extents.expandByPoint(
      this._unitDir.clone().multiplyScalar(-10).add(this._basePoint)
    )
    return extents
  }

  /**
   * @inheritdoc
   */
  subGetGripPoints() {
    const gripPoints = new Array<AcGePoint3d>()
    gripPoints.push(this.basePoint)
    return gripPoints
  }

  /**
   * @inheritdoc
   */
  draw(renderer: AcGiRenderer) {
    const points: AcGePoint3d[] = []
    points.push(
      this._unitDir.clone().multiplyScalar(-1000000).add(this._basePoint)
    )
    points.push(
      this._unitDir.clone().multiplyScalar(1000000).add(this._basePoint)
    )
    return renderer.lines(points, this.lineStyle)
  }
}
