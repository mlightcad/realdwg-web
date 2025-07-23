import { AcGePoint2d, AcGePoint3d } from '@mlightcad/geometry-engine'
import {
  AcGiDefaultLightingType,
  AcGiOrthographicType,
  AcGiRenderMode,
  AcGiView
} from '@mlightcad/graphic-interface'

import { AcDbSymbolTableRecord } from './AcDbSymbolTableRecord'

const DEFAULT_VIEW: AcGiView = {
  center: new AcGePoint2d(),
  viewDirectionFromTarget: new AcGePoint3d(0, 0, 1),
  viewTarget: new AcGePoint3d(0, 0, 0),
  lensLength: 500,
  frontClippingPlane: 0,
  backClippingPlane: 0,
  viewHeight: 1000,
  viewTwistAngle: 0,
  frozenLayers: [],
  styleSheet: '',
  renderMode: AcGiRenderMode.OPTIMIZED_2D,
  viewMode: 0,
  ucsIconSetting: 0,
  ucsOrigin: new AcGePoint3d(0, 0, 0),
  ucsXAxis: new AcGePoint3d(1, 0, 0),
  ucsYAxis: new AcGePoint3d(0, 1, 0),
  orthographicType: AcGiOrthographicType.TOP,
  shadePlotSetting: 0,
  shadePlotObjectId: undefined,
  visualStyleObjectId: undefined,
  isDefaultLightingOn: false,
  defaultLightingType: AcGiDefaultLightingType.ONE_DISTANT_LIGHT,
  brightness: 0,
  contrast: 0,
  ambientColor: undefined
}

/**
 * This class represents viewport arrangements in AutoCAD.
 */
export class AcDbViewportTableRecord extends AcDbSymbolTableRecord {
  private _circleSides: number
  private _center: AcGePoint2d
  private _lowerLeftCorner: AcGePoint2d
  private _upperRightCorner: AcGePoint2d
  private _snapBase: AcGePoint2d
  private _snapAngle: number
  private _snapSpacing: AcGePoint2d
  private _standardFlag: number
  private _gridSpacing: AcGePoint2d
  private _gridMajor: number
  private _backgroundObjectId?: string
  private _gsView: AcGiView

  constructor() {
    super()
    this._circleSides = 100
    this._center = new AcGePoint2d()
    this._lowerLeftCorner = new AcGePoint2d(0, 0)
    this._upperRightCorner = new AcGePoint2d(1, 1)
    this._snapBase = new AcGePoint2d(0, 0)
    this._snapAngle = 0
    this._snapSpacing = new AcGePoint2d(0, 0)
    this._standardFlag = 0
    this._gridSpacing = new AcGePoint2d()
    // TODO: Not sure what's the correct default value
    this._gridMajor = 10
    this._gsView = DEFAULT_VIEW
  }

  /**
   * The circle zoom percent. It controls the number of sides to the tessellation used when displaying
   * curves. The value can be between 1 and 20000, with higher settings using more sides in the curve
   * tessellation.
   */
  get circleSides() {
    return this._circleSides
  }
  set circleSides(value: number) {
    this._circleSides = value
  }

  get center() {
    return this._center
  }

  /**
   * The lower left corner of the viewport window. The X and Y values of this point are expressed as
   * a value between (0.0, 0.0) for the lower left corner of the AutoCAD graphics area and (1.0, 1.0)
   * for upper right corner of the AutoCAD graphics area. For example, a lower left corner value of
   * (0.5, 0.0) indicates that the viewport's lower left corner is along the bottom of the AutoCAD
   * graphics area, midway between the left and right edges of the graphics area.
   */
  get lowerLeftCorner() {
    return this._lowerLeftCorner
  }
  set lowerLeftCorner(value: AcGePoint2d) {
    this._lowerLeftCorner.copy(value)
  }

  /**
   * The upper right corner of the viewport window. The X and Y values of this point are expressed as
   * a value between (0.0, 0.0) for the lower left corner of the AutoCAD graphics area and (1.0, 1.0)
   * for upper right corner of the AutoCAD graphics area. For example, an upper right corner value of
   * (0.5, 1.0) indicates that the viewport's upper right corner is along the top of the AutoCAD
   * graphics area, midway between the left and right edges of the graphics area.
   */
  get upperRightCorner() {
    return this._upperRightCorner
  }
  set upperRightCorner(value: AcGePoint2d) {
    this._upperRightCorner.copy(value)
  }

  /**
   * The snap basepoint (in UCS coordinates) for the viewport table record.
   */
  get snapBase() {
    return this._snapBase
  }
  set snapBase(value: AcGePoint2d) {
    this._snapBase.copy(value)
  }

  /**
   * The snap angle setting (in radians) for the viewport table record. The snap angle is measured
   * within the UCS XY plane, with zero being the UCS X axis and positive angles going counterclockwise
   * when looking down the UCS Z axis towards the UCS origin.
   */
  get snapAngle() {
    return this._snapAngle
  }
  set snapAngle(value: number) {
    this._snapAngle = value
  }

  /**
   * An AcGePoint2d in which the X value represents the X spacing of the snap grid and the Y value
   * represents the Y spacing of the snap grid. Both values are in drawing units.
   */
  get snapIncrements() {
    return this._snapSpacing
  }
  set snapIncrements(value: AcGePoint2d) {
    this._snapSpacing.copy(value)
  }

  /**
   * The number of minor grid lines between each major grid line in the viewport.
   */
  get gridMajor() {
    return this._gridMajor
  }
  set gridMajor(value: number) {
    this._gridMajor = value
  }

  /**
   * An AcGePoint2d in which the X value represents the X spacing (in drawing units) of the grid and
   * the Y value represents the Y spacing of the grid.
   */
  get gridIncrements() {
    return this._gridSpacing
  }
  set gridIncrements(value: AcGePoint2d) {
    this._gridSpacing.copy(value)
  }

  /*
   * Viewport status bit-coded flags:
   * - 1 (0x1) = Enables perspective mode
   * - 2 (0x2) = Enables front clipping
   * - 4 (0x4) = Enables back clipping
   * - 8 (0x8) = Enables UCS follow
   * - 16 (0x10) = Enables front clip not at eye
   * - 32 (0x20) = Enables UCS icon visibility
   * - 64 (0x40) = Enables UCS icon at origin
   * - 128 (0x80) = Enables fast zoom
   * - 256 (0x100) = Enables snap mode
   * - 512 (0x200) = Enables grid mode
   * - 1024 (0x400) = Enables isometric snap style
   * - 2048 (0x800) = Enables hide plot mode
   * - 4096 (0x1000) = kIsoPairTop. If set and kIsoPairRight is not set, then isopair top is enabled. If both kIsoPairTop and kIsoPairRight are set, then isopair left is enabled
   * - 8192 (0x2000) = kIsoPairRight. If set and kIsoPairTop is not set, then isopair right is enabled
   * - 16384 (0x4000) = Enables viewport zoom locking
   * - 32768 (0x8000) = Currently always enabled
   * - 65536 (0x10000) = Enables non-rectangular clipping
   * - 131072 (0x20000) = Turns the viewport off
   * - 262144 (0x40000) = Enables the display of the grid beyond the drawing limits
   * - 524288 (0x80000) = Enable adaptive grid display
   * - 1048576 (0x100000) = Enables subdivision of the grid below the set grid spacing when the grid display is adaptive
   * - 2097152 (0x200000) = Enables grid follows workplane switching
   *
   * @internal
   */
  get standardFlag() {
    return this._standardFlag
  }
  set standardFlag(value: number) {
    this._standardFlag = value
  }

  get snapEnabled() {
    return !!(this._standardFlag & 0x100)
  }

  /**
   * The object dD of the new background for the view.
   */
  get backgroundObjectId() {
    return this._backgroundObjectId
  }
  set backgroundObjectId(value: string | undefined) {
    this._backgroundObjectId = value
  }

  /**
   * The AcGiView associated with this viewport table record
   */
  get gsView() {
    return this._gsView
  }
}
