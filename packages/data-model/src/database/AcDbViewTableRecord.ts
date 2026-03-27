import { AcDbDxfFiler } from '../base'
import { AcDbAbstractViewTableRecord } from './AcDbAbstractViewTableRecord'

/**
 * Represents a view table record in AutoCAD.
 *
 * This class represents named views in AutoCAD, which store a camera-like
 * configuration including view direction, target, and display settings.
 *
 * @example
 * ```typescript
 * const viewRecord = new AcDbViewTableRecord();
 * viewRecord.name = 'Front';
 * viewRecord.viewWidth = 2000;
 * viewRecord.gsView.viewHeight = 1000;
 * ```
 */
export class AcDbViewTableRecord extends AcDbAbstractViewTableRecord {
  /** Standard flags for the view record */
  private _standardFlags: number
  /** View width in DCS */
  private _viewWidth: number
  /** Whether a UCS is associated with this view */
  private _ucsAssociated: boolean
  /** Whether the camera is plottable */
  private _cameraPlottable: boolean
  /** UCS elevation when a UCS is associated */
  private _ucsElevation: number
  /** Named UCS object ID (optional) */
  private _ucsObjectId?: string
  /** Base UCS object ID (optional) */
  private _ucsBaseObjectId?: string
  /** Background object ID for the view */
  private _backgroundObjectId?: string
  /** Live section object ID for the view */
  private _liveSectionObjectId?: string

  /**
   * Creates a new AcDbViewTableRecord instance.
   *
   * @example
   * ```typescript
   * const viewRecord = new AcDbViewTableRecord();
   * ```
   */
  constructor() {
    super()
    this._standardFlags = 0
    this._viewWidth = this.viewHeight
    this._ucsAssociated = false
    this._cameraPlottable = false
    this._ucsElevation = 0
  }

  /**
   * Gets or sets the standard flags for this view record.
   */
  get standardFlags() {
    return this._standardFlags
  }
  set standardFlags(value: number) {
    this._standardFlags = value
  }

  /**
   * Gets or sets the view width in DCS.
   */
  get viewWidth() {
    return this._viewWidth
  }
  set viewWidth(value: number) {
    this._viewWidth = value
  }

  /**
   * Gets or sets whether a UCS is associated to this view.
   */
  get ucsAssociated() {
    return this._ucsAssociated
  }
  set ucsAssociated(value: boolean) {
    this._ucsAssociated = value
  }

  /**
   * Gets or sets whether the camera is plottable.
   */
  get cameraPlottable() {
    return this._cameraPlottable
  }
  set cameraPlottable(value: boolean) {
    this._cameraPlottable = value
  }

  /**
   * Gets or sets the UCS elevation when UCS is associated.
   */
  get ucsElevation() {
    return this._ucsElevation
  }
  set ucsElevation(value: number) {
    this._ucsElevation = value
  }

  /**
   * Gets or sets the named UCS object ID (optional).
   */
  get ucsObjectId() {
    return this._ucsObjectId
  }
  set ucsObjectId(value: string | undefined) {
    this._ucsObjectId = value
  }

  /**
   * Gets or sets the base UCS object ID (optional).
   */
  get ucsBaseObjectId() {
    return this._ucsBaseObjectId
  }
  set ucsBaseObjectId(value: string | undefined) {
    this._ucsBaseObjectId = value
  }

  /**
   * Gets or sets the background object ID (optional).
   */
  get backgroundObjectId() {
    return this._backgroundObjectId
  }
  set backgroundObjectId(value: string | undefined) {
    this._backgroundObjectId = value
  }

  /**
   * Gets or sets the live section object ID (optional).
   */
  get liveSectionObjectId() {
    return this._liveSectionObjectId
  }
  set liveSectionObjectId(value: string | undefined) {
    this._liveSectionObjectId = value
  }

  /**
   * Writes DXF fields for this object.
   *
   * @param filer - DXF output writer.
   * @returns The instance (for chaining).
   */
  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbViewTableRecord')
    filer.writeString(2, this.name)
    filer.writeInt16(70, this.standardFlags)
    filer.writeDouble(40, this.gsView.viewHeight)
    filer.writePoint2d(10, this.centerPoint)
    filer.writeDouble(41, this.viewWidth)
    filer.writePoint3d(11, this.gsView.viewDirectionFromTarget)
    filer.writePoint3d(12, this.gsView.viewTarget)
    filer.writeDouble(42, this.gsView.lensLength)
    filer.writeDouble(43, this.gsView.frontClippingPlane)
    filer.writeDouble(44, this.gsView.backClippingPlane)
    filer.writeAngle(50, this.gsView.viewTwistAngle)
    filer.writeInt16(71, this.gsView.viewMode)
    filer.writeInt16(281, this.gsView.renderMode)
    filer.writeInt16(72, this.ucsAssociated ? 1 : 0)
    filer.writeInt16(73, this.cameraPlottable ? 1 : 0)
    filer.writeObjectId(332, this.backgroundObjectId)
    filer.writeObjectId(334, this.liveSectionObjectId)
    filer.writeObjectId(348, this.gsView.visualStyleObjectId)

    if (this.ucsAssociated) {
      filer.writePoint3d(110, this.gsView.ucsOrigin)
      filer.writePoint3d(111, this.gsView.ucsXAxis)
      filer.writePoint3d(112, this.gsView.ucsYAxis)
      filer.writeInt16(79, this.gsView.orthographicType)
      filer.writeDouble(146, this.ucsElevation)
      filer.writeObjectId(345, this.ucsObjectId)
      filer.writeObjectId(346, this.ucsBaseObjectId)
    }

    return this
  }
}
