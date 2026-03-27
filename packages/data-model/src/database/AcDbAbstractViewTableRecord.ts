import { AcGePoint2d, AcGePoint3d } from '@mlightcad/geometry-engine'
import {
  AcGiDefaultLightingType,
  AcGiOrthographicType,
  AcGiRenderMode,
  AcGiView
} from '@mlightcad/graphic-interface'

import { AcDbSymbolTableRecord } from './AcDbSymbolTableRecord'

const createDefaultView = (): AcGiView => ({
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
})

/**
 * Base class for view-related symbol table records.
 *
 * Both AcDbViewTableRecord and AcDbViewportTableRecord share the same
 * view/camera properties (center, target, direction, twist, etc.). This
 * abstract class centralizes those common fields.
 */
export abstract class AcDbAbstractViewTableRecord extends AcDbSymbolTableRecord {
  /** Graphics system view configuration */
  private _gsView: AcGiView
  /** Center point for the view (DCS) */
  private _centerPoint: AcGePoint2d

  constructor() {
    super()
    this._gsView = createDefaultView()
    // Keep the center point and gsView.center as the same object instance
    this._centerPoint = this._gsView.center
  }

  /**
   * Gets the AcGiView associated with this record.
   */
  get gsView() {
    return this._gsView
  }

  /**
   * Gets or sets the view center point (DCS).
   */
  get centerPoint() {
    return this._centerPoint
  }
  set centerPoint(value: AcGePoint2d) {
    this._centerPoint.copy(value)
  }

  /**
   * Gets or sets the view direction from target.
   */
  get viewDirectionFromTarget() {
    return this._gsView.viewDirectionFromTarget
  }
  set viewDirectionFromTarget(value: AcGePoint3d) {
    this._gsView.viewDirectionFromTarget.copy(value)
  }

  /**
   * Gets or sets the view target.
   */
  get viewTarget() {
    return this._gsView.viewTarget
  }
  set viewTarget(value: AcGePoint3d) {
    this._gsView.viewTarget.copy(value)
  }

  /**
   * Gets or sets the view height.
   */
  get viewHeight() {
    return this._gsView.viewHeight
  }
  set viewHeight(value: number) {
    this._gsView.viewHeight = value
  }

  /**
   * Gets or sets the view twist angle (radians).
   */
  get viewTwistAngle() {
    return this._gsView.viewTwistAngle
  }
  set viewTwistAngle(value: number) {
    this._gsView.viewTwistAngle = value
  }

  /**
   * Gets or sets the lens length.
   */
  get lensLength() {
    return this._gsView.lensLength
  }
  set lensLength(value: number) {
    this._gsView.lensLength = value
  }

  /**
   * Gets or sets the front clipping plane distance.
   */
  get frontClippingPlane() {
    return this._gsView.frontClippingPlane
  }
  set frontClippingPlane(value: number) {
    this._gsView.frontClippingPlane = value
  }

  /**
   * Gets or sets the back clipping plane distance.
   */
  get backClippingPlane() {
    return this._gsView.backClippingPlane
  }
  set backClippingPlane(value: number) {
    this._gsView.backClippingPlane = value
  }

  /**
   * Gets or sets the render mode.
   */
  get renderMode() {
    return this._gsView.renderMode
  }
  set renderMode(value: AcGiRenderMode) {
    this._gsView.renderMode = value
  }

  /**
   * Gets or sets the view mode.
   */
  get viewMode() {
    return this._gsView.viewMode
  }
  set viewMode(value: number) {
    this._gsView.viewMode = value
  }

  /**
   * Gets or sets the UCS icon setting.
   */
  get ucsIconSetting() {
    return this._gsView.ucsIconSetting
  }
  set ucsIconSetting(value: number) {
    this._gsView.ucsIconSetting = value
  }

  /**
   * Gets or sets the UCS origin.
   */
  get ucsOrigin() {
    return this._gsView.ucsOrigin
  }
  set ucsOrigin(value: AcGePoint3d) {
    this._gsView.ucsOrigin.copy(value)
  }

  /**
   * Gets or sets the UCS X axis.
   */
  get ucsXAxis() {
    return this._gsView.ucsXAxis
  }
  set ucsXAxis(value: AcGePoint3d) {
    this._gsView.ucsXAxis.copy(value)
  }

  /**
   * Gets or sets the UCS Y axis.
   */
  get ucsYAxis() {
    return this._gsView.ucsYAxis
  }
  set ucsYAxis(value: AcGePoint3d) {
    this._gsView.ucsYAxis.copy(value)
  }

  /**
   * Gets or sets the orthographic type.
   */
  get orthographicType() {
    return this._gsView.orthographicType
  }
  set orthographicType(value: AcGiOrthographicType) {
    this._gsView.orthographicType = value
  }

  /**
   * Gets or sets the shade plot setting.
   */
  get shadePlotSetting() {
    return this._gsView.shadePlotSetting
  }
  set shadePlotSetting(value: number) {
    this._gsView.shadePlotSetting = value
  }

  /**
   * Gets or sets the shade plot object ID.
   */
  get shadePlotObjectId() {
    return this._gsView.shadePlotObjectId
  }
  set shadePlotObjectId(value: string | undefined) {
    this._gsView.shadePlotObjectId = value
  }

  /**
   * Gets or sets the visual style object ID.
   */
  get visualStyleObjectId() {
    return this._gsView.visualStyleObjectId
  }
  set visualStyleObjectId(value: string | undefined) {
    this._gsView.visualStyleObjectId = value
  }

  /**
   * Gets or sets whether default lighting is on.
   */
  get isDefaultLightingOn() {
    return this._gsView.isDefaultLightingOn
  }
  set isDefaultLightingOn(value: boolean) {
    this._gsView.isDefaultLightingOn = value
  }

  /**
   * Gets or sets the default lighting type.
   */
  get defaultLightingType() {
    return this._gsView.defaultLightingType
  }
  set defaultLightingType(value: AcGiDefaultLightingType) {
    this._gsView.defaultLightingType = value
  }

  /**
   * Gets or sets the brightness.
   */
  get brightness() {
    return this._gsView.brightness
  }
  set brightness(value: number) {
    this._gsView.brightness = value
  }

  /**
   * Gets or sets the contrast.
   */
  get contrast() {
    return this._gsView.contrast
  }
  set contrast(value: number) {
    this._gsView.contrast = value
  }

  /**
   * Gets or sets the ambient color.
   */
  get ambientColor() {
    return this._gsView.ambientColor
  }
  set ambientColor(value: number | undefined) {
    this._gsView.ambientColor = value
  }
}
