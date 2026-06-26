import { AcCmColor, AcCmTransparency } from '@mlightcad/common'
import { AcGiLineStyle, AcGiLineWeight } from '@mlightcad/graphic-interface'

import { AcDbDxfFiler } from '../base/AcDbDxfFiler'
import {
  AcDbSymbolTableRecord,
  AcDbSymbolTableRecordAttrs
} from './AcDbSymbolTableRecord'

/**
 * Interface defining the attributes for layer table records.
 *
 * Extends the base AcDbSymbolTableRecordAttrs interface and adds layer-specific
 * properties such as color, visibility, linetype, and other layer settings.
 */
export interface AcDbLayerTableRecordAttrs extends AcDbSymbolTableRecordAttrs {
  /** The color of the layer */
  color: AcCmColor
  /** Optional description of the layer */
  description?: string
  /** Standard flags for layer properties (bit-coded values) */
  standardFlags: number
  /** Whether the layer is hidden */
  isHidden?: boolean
  /** Whether the layer is in use */
  isInUse?: boolean
  /** Whether the layer is turned off */
  isOff: boolean
  /** Whether the layer is plottable */
  isPlottable: boolean
  /** Transparency level of the layer */
  transparency: AcCmTransparency
  /** The linetype name for the layer */
  linetype: string
  /** The line weight for the layer */
  lineWeight: AcGiLineWeight
  /** The material ID associated with the layer */
  materialId?: string
}

/**
 * Represents a record in the layer table.
 *
 * This class contains information about a layer in the drawing database,
 * including color, visibility settings, linetype, and other layer properties.
 * Layers are used to organize and control the display of entities in the drawing.
 *
 * @example
 * ```typescript
 * const layer = new AcDbLayerTableRecord({
 *   name: 'MyLayer',
 *   color: new AcCmColor(255, 0, 0), // Red
 *   isOff: false,
 *   isPlottable: true
 * });
 * ```
 */
export class AcDbLayerTableRecord extends AcDbSymbolTableRecord {
  private _color: AcCmColor
  private _description: string = ''
  private _standardFlags: number = 0
  private _isHidden: boolean = false
  private _isInUse: boolean = true
  private _isOff: boolean = false
  private _isPlottable: boolean = true
  private _transparency: AcCmTransparency
  private _linetype: string = ''
  private _lineWeight: AcGiLineWeight = -1 as AcGiLineWeight
  private _materialId: string = -1 as unknown as string

  /**
   * Creates a new AcDbLayerTableRecord instance.
   *
   * @param init - Input values for this layer table record
   */
  constructor(attrs?: Partial<AcDbLayerTableRecordAttrs>) {
    attrs = attrs || {}
    super(attrs)

    this._color = (attrs.color ?? new AcCmColor()).clone()
    this._description = attrs.description ?? ''
    this._standardFlags = attrs.standardFlags ?? 0
    this._isHidden = attrs.isHidden ?? false
    this._isInUse = attrs.isInUse ?? true
    this._isOff = attrs.isOff ?? false
    this._isPlottable = attrs.isPlottable ?? true
    this._transparency = (attrs.transparency ?? new AcCmTransparency()).clone()
    this._linetype = attrs.linetype ?? ''
    this._lineWeight = attrs.lineWeight ?? (-1 as AcGiLineWeight)
    this._materialId = attrs.materialId ?? (-1 as unknown as string)
  }

  /**
   * Records this layer for transaction commit when a property changes inside an
   * active transaction.
   */
  private markModified(): void {
    try {
      this.database.transactionManager.recordModify(this)
    } catch {
      // Layer is not associated with a database yet.
    }
  }

  /**
   * Gets or sets the color value of this layer.
   *
   * @returns The color of the layer
   *
   * @example
   * ```typescript
   * const color = layer.color;
   * layer.color = new AcCmColor(255, 0, 0); // Red
   * ```
   */
  get color() {
    return this._color
  }
  set color(value: AcCmColor) {
    const next = value.clone()
    if (this._color.equals(next)) {
      return
    }
    this.markModified()
    this._color = next
  }

  /**
   * Gets or sets the description of this layer.
   *
   * @returns The description of the layer
   *
   * @example
   * ```typescript
   * const description = layer.description;
   * layer.description = 'My custom layer';
   * ```
   */
  get description() {
    return this._description
  }
  set description(value: string) {
    if (this._description === value) {
      return
    }
    this.markModified()
    this._description = value
  }

  /**
   * Gets or sets the standard flags for this layer.
   *
   * Standard flags are bit-coded values:
   * - 1 = Layer is frozen; otherwise layer is thawed
   * - 2 = Layer is frozen by default in new viewports
   * - 4 = Layer is locked
   * - 16 = If set, table entry is externally dependent on an xref
   * - 32 = If both this bit and bit 16 are set, the externally dependent xref has been successfully resolved
   * - 64 = If set, the table entry was referenced by at least one entity in the drawing the last time the drawing was edited
   *
   * @returns The standard flags value
   *
   * @example
   * ```typescript
   * const flags = layer.standardFlags;
   * layer.standardFlags = 1; // Freeze the layer
   * ```
   */
  get standardFlags() {
    return this._standardFlags
  }
  set standardFlags(value: number) {
    if (this._standardFlags === value) {
      return
    }
    this.markModified()
    this._standardFlags = value
  }

  /**
   * Gets or sets whether this layer is frozen.
   *
   * When a layer is frozen, its entities are not displayed and cannot be modified.
   *
   * @returns True if the layer is frozen, false otherwise
   *
   * @example
   * ```typescript
   * if (layer.isFrozen) {
   *   console.log('Layer is frozen');
   * }
   * layer.isFrozen = true;
   * ```
   */
  get isFrozen() {
    return (this.standardFlags & 0x01) == 1
  }
  set isFrozen(value: boolean) {
    const flag = value ? 1 : 0
    this.standardFlags = this.standardFlags | flag
  }

  /**
   * Gets or sets whether this layer is hidden.
   *
   * When a layer is hidden, it isn't shown in the user interface of
   * the host application, but entities on the layer are still displayed.
   *
   * @returns True if the layer is hidden, false otherwise
   *
   * @example
   * ```typescript
   * if (layer.isHidden) {
   *   console.log('Layer is hidden from UI');
   * }
   * layer.isHidden = true;
   * ```
   */
  get isHidden() {
    return this._isHidden
  }
  set isHidden(value: boolean) {
    if (this._isHidden === value) {
      return
    }
    this.markModified()
    this._isHidden = value
  }

  /**
   * Gets or sets whether this layer is in use.
   *
   * A layer is considered in use if it contains entities or is referenced
   * by other objects in the drawing.
   *
   * @returns True if the layer is in use, false otherwise
   *
   * @example
   * ```typescript
   * if (layer.isInUse) {
   *   console.log('Layer contains entities');
   * }
   * ```
   */
  get isInUse() {
    return this._isInUse
  }
  set isInUse(value: boolean) {
    if (this._isInUse === value) {
      return
    }
    this.markModified()
    this._isInUse = value
  }

  /**
   * Gets or sets whether this layer is locked.
   *
   * When a layer is locked, its entities cannot be modified but are still visible.
   *
   * @returns True if the layer is locked, false otherwise
   *
   * @example
   * ```typescript
   * if (layer.isLocked) {
   *   console.log('Layer is locked');
   * }
   * layer.isLocked = true;
   * ```
   */
  get isLocked() {
    return (this.standardFlags & 0x04) == 4
  }
  set isLocked(value: boolean) {
    const flag = value ? 4 : 0
    this.standardFlags = this.standardFlags | flag
  }

  /**
   * Gets or sets whether this layer is turned off.
   *
   * When a layer is turned off, its entities are not displayed but can still be modified.
   *
   * @returns True if the layer is turned off, false otherwise
   *
   * @example
   * ```typescript
   * if (layer.isOff) {
   *   console.log('Layer is turned off');
   * }
   * layer.isOff = true;
   * ```
   */
  get isOff() {
    return this._isOff
  }
  set isOff(value: boolean) {
    if (this._isOff === value) {
      return
    }
    this.markModified()
    this._isOff = value
  }

  /**
   * Gets or sets whether this layer is plottable.
   *
   * When a layer is plottable, its entities will be included when the drawing is plotted or printed.
   *
   * @returns True if the layer is plottable, false otherwise
   *
   * @example
   * ```typescript
   * if (layer.isPlottable) {
   *   console.log('Layer will be included in plots');
   * }
   * layer.isPlottable = false;
   * ```
   */
  get isPlottable() {
    return this._isPlottable
  }
  set isPlottable(value: boolean) {
    if (this._isPlottable === value) {
      return
    }
    this.markModified()
    this._isPlottable = value
  }

  /**
   * Gets or sets the transparency level of this layer.
   *
   * Transparency values.
   *
   * @returns The transparency level
   */
  get transparency() {
    return this._transparency
  }
  set transparency(value: AcCmTransparency) {
    const next = value.clone()
    if (this._transparency.equals(next)) {
      return
    }
    this.markModified()
    this._transparency = next
  }

  /**
   * Gets or sets the linetype name for this layer.
   *
   * The linetype defines the pattern of dashes, dots, and spaces used
   * to display lines and curves on this layer.
   *
   * @returns The linetype name
   *
   * @example
   * ```typescript
   * const linetype = layer.linetype;
   * layer.linetype = 'DASHED';
   * ```
   */
  get linetype() {
    return this._linetype
  }
  set linetype(value: string) {
    if (this._linetype === value) {
      return
    }
    this.markModified()
    this._linetype = value
  }

  /**
   * Gets the line style for this layer.
   *
   * This method returns the line style based on the layer's linetype
   * and other properties.
   *
   * @returns The line style object
   */
  get lineStyle(): AcGiLineStyle | undefined {
    const lineTypeRecord = this.database?.tables.linetypeTable.getAt(
      this.linetype
    )
    if (lineTypeRecord) {
      return { type: 'UserSpecified', ...lineTypeRecord.linetype }
    }
    return undefined
  }

  /**
   * Gets or sets the line weight for this layer.
   *
   * Line weight determines the thickness of lines and curves on this layer.
   *
   * @returns The line weight value
   */
  get lineWeight() {
    return this._lineWeight
  }
  set lineWeight(value: AcGiLineWeight) {
    if (this._lineWeight === value) {
      return
    }
    this.markModified()
    this._lineWeight = value
  }

  /**
   * Gets or sets the material ID associated with this layer.
   *
   * Material IDs are used for rendering and visualization purposes.
   *
   * @returns The material ID
   *
   * @example
   * ```typescript
   * const materialId = layer.materialId;
   * layer.materialId = 'concrete';
   * ```
   */
  get materialId() {
    return this._materialId
  }
  set materialId(value: string) {
    if (this._materialId === value) {
      return
    }
    this.markModified()
    this._materialId = value
  }

  /**
   * Writes DXF fields for this object.
   *
   * @param filer - DXF output writer.
   * @returns The instance (for chaining).
   */
  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbLayerTableRecord')
    filer.writeString(2, this.name)
    filer.writeInt16(70, this.standardFlags)
    filer.writeCmColor(this.color)
    filer.writeString(6, this.linetype)
    filer.writeInt16(290, this.isPlottable ? 1 : 0)
    filer.writeInt16(370, this.lineWeight)
    filer.writeTransparency(this.transparency)
    if (this.description) {
      filer.writeString(4, this.description)
    }
    return this
  }
}
