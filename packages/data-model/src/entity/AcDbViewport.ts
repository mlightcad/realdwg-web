import { AcGeBox3d, AcGePoint3d } from '@mlightcad/geometry-engine'
import {
  AcGiEntity,
  AcGiRenderer,
  AcGiViewport
} from '@mlightcad/graphic-interface'

import { AcDbEntity } from './AcDbEntity'

export class AcDbViewport extends AcDbEntity {
  private _centerPoint: AcGePoint3d
  private _height: number
  private _width: number
  private _viewCenter: AcGePoint3d
  private _viewHeight: number
  private _number: number

  constructor() {
    super()
    this._centerPoint = new AcGePoint3d()
    this._height = 0
    this._width = 0
    this._viewCenter = new AcGePoint3d()
    this._viewHeight = 0
    this._number = -1
  }

  /**
   * The viewport ID number. This is the number that is reported by the AutoCAD CVPORT system variable
   * when the viewport is the current viewport in the AutoCAD editor. If the viewport is inactive, -1
   * is returned.
   * This value is not saved with the drawing, and changes each time the drawing is opened.
   */
  get number() {
    return this._number
  }
  set number(value: number) {
    this._number = value
  }

  /**
   * The center point of the viewport entity in WCS coordinates (within Paper Space).
   */
  get centerPoint() {
    return this._centerPoint
  }
  set centerPoint(value: AcGePoint3d) {
    this._centerPoint = value
  }

  /**
   * The height of the viewport entity's window in drawing units.
   */
  get height() {
    return this._height
  }
  set height(value: number) {
    this._height = value
  }

  /**
   * The width of the viewport entity's window in drawing units. This is the width in Paper Space
   * of the viewport itself, not the width of the Model Space view within the viewport.
   */
  get width() {
    return this._width
  }
  set width(value: number) {
    this._width = value
  }

  /**
   * The view center (in display coordinate system coordinates) of the view in the viewport.
   */
  get viewCenter() {
    return this._viewCenter
  }
  set viewCenter(value: AcGePoint3d) {
    this._viewCenter = value
  }

  /**
   * The height (in display coordinate system coordinates) of the Model Space view within the viewport.
   * Zooming the view out within the viewport increases this value and zooming in decreases this value.
   */
  get viewHeight() {
    return this._viewHeight
  }
  set viewHeight(value: number) {
    this._viewHeight = value
  }

  /**
   * @inheritdoc
   */
  get geometricExtents(): AcGeBox3d {
    // TODO: Implement it correctly
    return new AcGeBox3d()
  }

  /**
   * @inheritdoc
   */
  draw(renderer: AcGiRenderer) {
    // Draw a rectangle if meeting the following conditions:
    // - viewport entity isn't in model space
    // - viewport id number is greater than 1
    //
    // In paper space layouts, there is always a system-defined "default" viewport that exists as
    // the bottom-most item. This viewport doesn't show any entities and is mainly for internal
    // AutoCAD purposes. The viewport id number of this system-defined "default" viewport is 1.
    if (
      this._number > 1 &&
      this.ownerId != this.database.tables.blockTable.modelSpace.objectId
    ) {
      const viewport = this.toGiViewport()
      const group = renderer.group(this.createViewportRect(viewport, renderer))
      return group
    }
    return undefined
  }

  toGiViewport() {
    const viewport = new AcGiViewport()
    viewport.id = this.objectId
    viewport.groupId = this.ownerId
    viewport.number = this.number
    viewport.centerPoint = this.centerPoint
    viewport.width = this.width
    viewport.height = this.height
    viewport.viewHeight = this.viewHeight
    viewport.viewCenter = this.viewCenter
    return viewport
  }

  private createViewportRect(viewport: AcGiViewport, renderer: AcGiRenderer) {
    const lines: AcGiEntity[] = []
    lines.push(
      renderer.lines(
        [
          new AcGePoint3d(
            viewport.centerPoint.x - viewport.width / 2,
            viewport.centerPoint.y - viewport.height / 2,
            0
          ),
          new AcGePoint3d(
            viewport.centerPoint.x + viewport.width / 2,
            viewport.centerPoint.y - viewport.height / 2,
            0
          )
        ],
        this.lineStyle
      )
    )
    lines.push(
      renderer.lines(
        [
          new AcGePoint3d(
            viewport.centerPoint.x + viewport.width / 2,
            viewport.centerPoint.y - viewport.height / 2,
            0
          ),
          new AcGePoint3d(
            viewport.centerPoint.x + viewport.width / 2,
            viewport.centerPoint.y + viewport.height / 2,
            0
          )
        ],
        this.lineStyle
      )
    )
    lines.push(
      renderer.lines(
        [
          new AcGePoint3d(
            viewport.centerPoint.x + viewport.width / 2,
            viewport.centerPoint.y + viewport.height / 2,
            0
          ),
          new AcGePoint3d(
            viewport.centerPoint.x - viewport.width / 2,
            viewport.centerPoint.y + viewport.height / 2,
            0
          )
        ],
        this.lineStyle
      )
    )
    lines.push(
      renderer.lines(
        [
          new AcGePoint3d(
            viewport.centerPoint.x - viewport.width / 2,
            viewport.centerPoint.y + viewport.height / 2,
            0
          ),
          new AcGePoint3d(
            viewport.centerPoint.x - viewport.width / 2,
            viewport.centerPoint.y - viewport.height / 2,
            0
          )
        ],
        this.lineStyle
      )
    )
    return lines
  }
}
