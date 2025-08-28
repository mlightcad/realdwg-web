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

/**
 * Abstract base class for all drawing entities.
 *
 * This class provides the fundamental functionality for all drawing entities,
 * including layer management, color handling, linetype support, visibility,
 * and geometric operations. All specific entity types (lines, circles, text, etc.)
 * inherit from this class.
 *
 * @example
 * ```typescript
 * class MyEntity extends AcDbEntity {
 *   get geometricExtents(): AcGeBox3d {
 *     // Implementation for geometric extents
 *   }
 *
 *   draw(renderer: AcGiRenderer): AcGiEntity | undefined {
 *     // Implementation for drawing
 *   }
 * }
 * ```
 */
export abstract class AcDbEntity extends AcDbObject {
  /** The entity type name */
  static typeName: string = 'Entity'
  /** The layer name this entity belongs to */
  private _layer: string = '0'
  /** The color of this entity */
  private _color: AcCmColor = new AcCmColor()
  /** The linetype name for this entity */
  private _lineType: string = ByLayer
  /** The line weight for this entity */
  private _lineWeight: number = 1
  /** The linetype scale factor for this entity */
  private _linetypeScale: number = -1
  /** Whether this entity is visible */
  private _visibility: boolean = true
  /** The transparency level of this entity (0-1) */
  private _transparency: number = 0

  /**
   * Gets the type name of this entity.
   *
   * This method returns the entity type by removing the "AcDb" prefix
   * from the constructor name.
   *
   * @returns The entity type name
   *
   * @example
   * ```typescript
   * const entity = new AcDbLine();
   * console.log(entity.type); // "Line"
   * ```
   */
  get type() {
    return (this.constructor as typeof AcDbEntity).typeName
  }

  /**
   * Gets the name of the layer referenced by this entity.
   *
   * @returns The layer name
   *
   * @example
   * ```typescript
   * const layerName = entity.layer;
   * ```
   */
  get layer() {
    return this._layer
  }

  /**
   * Sets the name of the layer for this entity.
   *
   * @param value - The new layer name
   *
   * @example
   * ```typescript
   * entity.layer = 'MyLayer';
   * ```
   */
  set layer(value: string) {
    this._layer = value
  }

  /**
   * Gets the color information of this entity.
   *
   * @returns The color object for this entity
   *
   * @example
   * ```typescript
   * const color = entity.color;
   * ```
   */
  get color() {
    return this._color
  }

  /**
   * Sets the color information for this entity.
   *
   * @param value - The new color object
   *
   * @example
   * ```typescript
   * entity.color = new AcCmColor(0xFF0000);
   * ```
   */
  set color(value: AcCmColor) {
    this._color.copy(value)
  }

  /**
   * Gets the RGB color of this entity after converting color index.
   *
   * This method handles the conversion of color indices (including ByLayer and ByBlock)
   * to actual RGB colors. It resolves layer colors and block colors as needed.
   *
   * @returns The RGB color value as a number
   *
   * @example
   * ```typescript
   * const rgbColor = entity.rgbColor;
   * console.log(`RGB: ${rgbColor.toString(16)}`);
   * ```
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
   * Gets the name of the line type referenced by this entity.
   *
   * @returns The linetype name
   *
   * @example
   * ```typescript
   * const lineType = entity.lineType;
   * ```
   */
  get lineType() {
    return this._lineType
  }

  /**
   * Sets the name of the line type for this entity.
   *
   * @param value - The new linetype name
   *
   * @example
   * ```typescript
   * entity.lineType = 'DASHED';
   * ```
   */
  set lineType(value: string) {
    this._lineType = value || ByLayer
  }

  /**
   * Gets the line weight used by this entity.
   *
   * @returns The line weight value
   *
   * @example
   * ```typescript
   * const weight = entity.lineWeight;
   * ```
   */
  get lineWeight() {
    return this._lineWeight
  }

  /**
   * Sets the line weight for this entity.
   *
   * @param value - The new line weight value
   *
   * @example
   * ```typescript
   * entity.lineWeight = 2;
   * ```
   */
  set lineWeight(value: number) {
    this._lineWeight = value
  }

  /**
   * Gets the line type scale factor of this entity.
   *
   * When an entity is first instantiated, its line type scale is initialized
   * to an invalid value. When the entity is added to the database, if a
   * linetype scale has not been specified for the entity, it is set to the
   * database's current line type scale value.
   *
   * @returns The linetype scale factor
   *
   * @example
   * ```typescript
   * const scale = entity.linetypeScale;
   * ```
   */
  get linetypeScale() {
    return this._linetypeScale
  }

  /**
   * Sets the line type scale factor for this entity.
   *
   * @param value - The new linetype scale factor
   *
   * @example
   * ```typescript
   * entity.linetypeScale = 2.0;
   * ```
   */
  set linetypeScale(value: number) {
    this._linetypeScale = value
  }

  /**
   * Gets whether this entity is visible.
   *
   * @returns True if the entity is visible, false otherwise
   *
   * @example
   * ```typescript
   * const isVisible = entity.visibility;
   * ```
   */
  get visibility() {
    return this._visibility
  }

  /**
   * Sets whether this entity is visible.
   *
   * @param value - True to make the entity visible, false to hide it
   *
   * @example
   * ```typescript
   * entity.visibility = false; // Hide the entity
   * ```
   */
  set visibility(value: boolean) {
    this._visibility = value
  }

  /**
   * Gets the transparency level of this entity.
   *
   * @returns The transparency value (0-1, where 0 is opaque and 1 is fully transparent)
   *
   * @example
   * ```typescript
   * const transparency = entity.transparency;
   * ```
   */
  get transparency() {
    return this._transparency
  }

  /**
   * Sets the transparency level of this entity.
   *
   * @param value - The transparency value (0-1, where 0 is opaque and 1 is fully transparent)
   *
   * @example
   * ```typescript
   * entity.transparency = 0.5; // 50% transparent
   * ```
   */
  set transparency(value: number) {
    this._transparency = value
  }

  /**
   * Gets the grip points for this entity.
   *
   * Grip points are the control points that can be used to modify the entity.
   * This method should be overridden by subclasses to provide entity-specific
   * grip points.
   *
   * @returns Array of grip points as 3D points
   *
   * @example
   * ```typescript
   * const gripPoints = entity.subGetGripPoints();
   * ```
   */
  subGetGripPoints() {
    const gripPoints = new Array<AcGePoint3d>()
    return gripPoints
  }

  /**
   * Gets the object snap points for this entity.
   *
   * Object snap points are the points that can be used for precise positioning
   * when drawing or editing. This method should be overridden by subclasses
   * to provide entity-specific snap points.
   *
   * @param osnapMode - The object snap mode
   * @param gsSelectionMark - The selection mark
   * @param pickPoint - The pick point
   * @param lastPoint - The last point
   * @param snapPoints - Array to populate with snap points
   *
   * @example
   * ```typescript
   * const snapPoints: AcGePoint3d[] = [];
   * entity.subGetOsnapPoints(AcDbOsnapMode.Endpoint, 0, pickPoint, lastPoint, snapPoints);
   * ```
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
   * Transforms this entity by the specified matrix.
   *
   * This method applies a geometric transformation to the entity.
   * Subclasses should override this method to provide entity-specific
   * transformation behavior.
   *
   * @param matrix - The transformation matrix to apply
   * @returns This entity after transformation
   *
   * @example
   * ```typescript
   * const matrix = AcGeMatrix3d.translation(10, 0, 0);
   * entity.transformBy(matrix);
   * ```
   */
  // @ts-expect-error not use '_' prefix so that typedoc can the correct parameter to generate doc
  transformBy(matrix: AcGeMatrix3d): this {
    return this
  }

  /**
   * Gets the geometric extents of this entity.
   *
   * This method should be implemented by subclasses to return the
   * bounding box that encompasses the entire entity.
   *
   * @returns The geometric extents as a 3D bounding box
   *
   * @example
   * ```typescript
   * const extents = entity.geometricExtents;
   * console.log(`Min: ${extents.minPoint}, Max: ${extents.maxPoint}`);
   * ```
   */
  abstract get geometricExtents(): AcGeBox3d

  /**
   * Draws this entity using the specified renderer.
   *
   * This method should be implemented by subclasses to provide
   * entity-specific drawing behavior.
   *
   * @param renderer - The renderer to use for drawing
   * @returns The rendered entity, or undefined if drawing failed
   *
   * @example
   * ```typescript
   * const renderedEntity = entity.draw(renderer);
   * ```
   */
  abstract draw(renderer: AcGiRenderer): AcGiEntity | undefined

  /**
   * Triggers a modified event for this entity.
   *
   * This method notifies listeners that the entity has been modified.
   *
   * @example
   * ```typescript
   * entity.triggerModifiedEvent();
   * ```
   */
  triggerModifiedEvent() {
    this.database.events.entityModified.dispatch({
      database: this.database,
      entity: this
    })
  }

  /**
   * Gets the line style for this entity.
   *
   * This method returns the line style based on the entity's linetype
   * and other properties.
   *
   * @returns The line style object
   *
   * @example
   * ```typescript
   * const lineStyle = entity.lineStyle;
   * ```
   */
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

  /**
   * Gets the line type for this entity.
   *
   * This method resolves the line type, handling ByLayer and ByBlock
   * references as needed.
   *
   * @returns The resolved line type name
   *
   * @example
   * ```typescript
   * const lineType = entity.getLineType();
   * ```
   */
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

  /**
   * Gets the color of the layer this entity belongs to.
   *
   * This method retrieves the color from the layer table for the
   * layer this entity belongs to.
   *
   * @returns The layer color, or undefined if the layer doesn't exist
   *
   * @example
   * ```typescript
   * const layerColor = entity.getLayerColor();
   * ```
   */
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
