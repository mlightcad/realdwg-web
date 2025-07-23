import { AcCmColor } from '@mlightcad/common'
import {
  AcGeBox3d,
  AcGeMatrix3d,
  AcGePoint3d
} from '@mlightcad/geometry-engine'
import {
  AcGiEntity,
  AcGiLineStyle,
  AcGiRenderer
} from '@mlightcad/graphic-interface'

import { AcDbObject } from '../base/AcDbObject'
import { AcDbOsnapMode, ByBlock, ByLayer, DEFAULT_LINE_TYPE } from '../misc'

export abstract class AcDbEntity extends AcDbObject {
  private _layer: string = '0'
  private _color: AcCmColor = new AcCmColor()
  private _lineType: string = ByLayer
  private _lineWeight: number = 1
  private _linetypeScale: number = -1
  private _visibility: boolean = true
  private _transparency: number = 0

  get type() {
    return this.constructor.name.substring(4)
  }

  /**
   * The name of the layer referenced by this entity
   */
  get layer() {
    return this._layer
  }
  set layer(value: string) {
    this._layer = value
  }

  /**
   * The color information of this entity
   */
  get color() {
    return this._color
  }
  set color(value: AcCmColor) {
    this._color.copy(value)
  }

  /**
   * The RGB color of this entity after converting color index (including ByLayer and ByBlock) or name to
   * real RGB color.
   */
  get rgbColor() {
    // Default color
    let color = this.database.cecolor
    if (this.color.isByLayer) {
      const layerColor = this.getLayerColor()
      if (layerColor && layerColor.color) {
        color = layerColor
      }
    } else if (this.color.isByBlock) {
      // Do nothing for common entity and just use default color in database
      // Block reference entity need to override this method handle 'byBlock'.
    } else if (this.color.color != null) {
      color = this.color
    }
    return color.color == null ? 0xffffff : color.color
  }

  /**
   * The name of the line type referenced by this entity.
   */
  get lineType() {
    return this._lineType
  }
  set lineType(value: string) {
    this._lineType = value || ByLayer
  }

  /**
   * Line weight used by this entity.
   */
  get lineWeight() {
    return this._lineWeight
  }
  set lineWeight(value: number) {
    this._lineWeight = value
  }

  /**
   * The line type scale factor of this entity. When an entity is first instantiated, its line type scale
   * is initialized to an invalid value. When the entity is added to the database, if a linetype scale has
   * not been specified for the entity, it is set to the database's current line type scale value.
   */
  get linetypeScale() {
    return this._linetypeScale
  }
  set linetypeScale(value: number) {
    this._linetypeScale = value
  }

  /**
   * The visibility state of this entity
   */
  get visibility() {
    return this._visibility
  }
  set visibility(value: boolean) {
    this._visibility = value
  }

  /**
   * The transparency setting of this entity.
   */
  get transparency() {
    return this._transparency
  }
  set transparency(value: number) {
    this._transparency = value
  }

  /**
   * Calculate grip points of this entity and return them.
   * @returns Return grip points of this entity
   */
  subGetGripPoints() {
    const gripPoints = new Array<AcGePoint3d>()
    return gripPoints
  }

  /**
   * This function must use the material provided in osnapMode, gsSelectionMark, pickPoint, lastPoint, and
   * viewXform to determine all appropriate osnap points for the entity. It must then append all such osnap
   * points to the snapPoints array.
   * @param osnapMode Input osnap mode being requested
   * @param gsSelectionMark Input GS marker of the subentity involved in the object snap operation
   * @param pickPoint Input point (in WCS coordinates) picked during the object snap operation
   * @param lastPoint Input point (in WCS coordinates) selected just before pickPoint
   * @param snapPoints The snapPoints array is passed to all entities involved in the osnap operation, so it's
   * possible that the array will already have entries in it when passed in. For this reason, it's very important
   * that points be appended to the snapPoints array instead of assigning to any existing elements.
   */
  subGetOsnapPoints(
    // @ts-expect-error not use '_' prefix so that typedoc can the correct parameter to generate doc
    osnapMode: AcDbOsnapMode,
    // @ts-expect-error not use '_' prefix so that typedoc can the correct parameter to generate doc
    gsSelectionMark: number,
    // @ts-expect-error not use '_' prefix so that typedoc can the correct parameter to generate doc
    pickPoint: AcGePoint3d,
    // @ts-expect-error not use '_' prefix so that typedoc can the correct parameter to generate doc
    lastPoint: AcGePoint3d,
    // @ts-expect-error not use '_' prefix so that typedoc can the correct parameter to generate doc
    snapPoints: AcGePoint3d[]
  ) {}

  /**
   * Apply a transformation matrix to this entity
   * @param matrix Input one transformation matrix
   * @returns Return this entity
   */
  // @ts-expect-error not use '_' prefix so that typedoc can the correct parameter to generate doc
  transformBy(matrix: AcGeMatrix3d): this {
    return this
  }

  /**
   * Compute the corner points (in WCS coordinates) of a box (with edges parallel to the WCS X, Y,
   * and Z axes) that encloses the 3D extents of the entity, and return those points as an instance
   * of class AcDbExtents.
   */
  abstract get geometricExtents(): AcGeBox3d

  /**
   * Convert this entity to an object be able to draw by the specified renderer and return it.
   * @param renderer Input renderer to draw this entity
   * @returns Return object to render in the scene. Different renderers use different classes to
   * represent objects to render. So the type of returned object is completely specific to render
   * engine.
   */
  abstract draw(renderer: AcGiRenderer): AcGiEntity | undefined

  /**
   * Trigger 'entityModified' event
   */
  triggerModifiedEvent() {
    this.database.events.entityModified.dispatch({
      database: this.database,
      entity: this
    })
  }

  protected get lineStyle(): AcGiLineStyle {
    const linetypeName = this.getLineType()
    const linetypeRecord =
      this.database?.tables.linetypeTable.getAt(linetypeName)
    if (linetypeRecord) {
      return { ...linetypeRecord.linetype, color: this.rgbColor }
    } else {
      return {
        name: linetypeName,
        standardFlag: 0,
        color: this.rgbColor,
        description: '',
        totalPatternLength: 0
      }
    }
  }

  private getLineType(): string {
    if (this.lineType == ByLayer) {
      const layer = this.database.tables.layerTable.getAt(this.layer)
      if (layer && layer.linetype) return layer.linetype
    } else if (this.lineType == ByBlock) {
      // TODO: Get line type correctly
      return DEFAULT_LINE_TYPE
    } else {
      return this.lineType
    }
    return DEFAULT_LINE_TYPE
  }

  protected getLayerColor() {
    const layer = this.database.tables.layerTable.getAt(this.layer)
    if (layer == null) {
      console.error(
        `The layer with name '${this.layer}' not found in drawing database!`
      )
    } else {
      return layer.color
    }
    return null
  }
}
