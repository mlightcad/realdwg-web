import {
  AcGeArea2d,
  AcGeBox3d,
  AcGePoint3d,
  AcGePointLike,
  AcGePolyline2d
} from '@mlightcad/geometry-engine'
import { AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbCurve } from './AcDbCurve'

/**
 * The class represents the trace entity in AutoCAD, which represents a filled four-sided polygon.
 * It is typically used to create trace-like shapes. It is one of the simpler types of entities
 * within the AutoCAD database and can be visualized as a "filled polyline" with four vertices,
 * where each edge connects two consecutive points.
 *
 * This entity was more commonly used in earlier versions of AutoCAD, especially before the
 * introduction of more advanced entities like solid and hatches. Today, it's not as commonly used
 * since solid provides similar capabilities with more flexibility.
 */
export class AcDbTrace extends AcDbCurve {
  private _elevation: number
  private _vertices: [AcGePoint3d, AcGePoint3d, AcGePoint3d, AcGePoint3d]
  private _thickness: number

  /**
   * Create one empty trace entity
   */
  constructor() {
    super()
    this._elevation = 0
    this._thickness = 1
    this._vertices = [
      new AcGePoint3d(),
      new AcGePoint3d(),
      new AcGePoint3d(),
      new AcGePoint3d()
    ]
  }

  /**
   * The distance of the trace's plane from the WCS origin.
   */
  get elevation(): number {
    return this._elevation
  }
  set elevation(value: number) {
    this._elevation = value
  }

  /**
   * @inheritdoc
   */
  get closed(): boolean {
    return true
  }

  /**
   * The thickness for the text. The thickness is the text's dimension along its normal vector
   * direction (sometimes called the extrusion direction).
   */
  get thickness() {
    return this._thickness
  }
  set thickness(value: number) {
    this._thickness = value
  }

  /**
   * Return the point in the trace whose index is equal to the specified `index` value. `index` can have
   * a value of 0, 1, 2, or 3, depending on which point is desired (that is, 0 for the first point, 1 for
   * the second point, etc.). The returned point is in WCS coordinates.
   * @param index Input index (0 based) of the vertex.
   * @returns Return the point in the trace whose index is equal to the specified `index` value.
   */
  getPointAt(index: number): AcGePoint3d {
    if (index < 0) return this._vertices[0]
    if (index > 3) return this._vertices[3]
    return this._vertices[index]
  }

  /**
   * Set sets the `index`'th point in the trace to the value `point`. `index` must be 0, 1, 2, or 3.
   * `point` must be in WCS coordinates.
   * @param index Input index (0-3) of the point to set in the trace
   */
  setPointAt(index: number, point: AcGePointLike) {
    if (index < 0) this._vertices[0].copy(point)
    if (index > 3) return this._vertices[3].copy(point)
    this._vertices[index].copy(point)
  }

  /**
   * @inheritdoc
   */
  get geometricExtents(): AcGeBox3d {
    return new AcGeBox3d().setFromPoints(this._vertices)
  }

  /**
   * @inheritdoc
   */
  subGetGripPoints() {
    const gripPoints = new Array<AcGePoint3d>()
    for (let index = 0; index < 4; ++index) {
      gripPoints.push(this.getPointAt(index))
    }
    return gripPoints
  }

  /**
   * @inheritdoc
   */
  draw(renderer: AcGiRenderer) {
    const polyline = new AcGePolyline2d(this._vertices, true)
    const area = new AcGeArea2d()
    area.add(polyline)
    return renderer.area(area, {
      color: this.rgbColor,
      solidFill: true,
      patternAngle: 0,
      patternLines: []
    })
  }
}
