import { AcDbDxfFiler } from '../base/AcDbDxfFiler'
import { AcDbObject, AcDbObjectAttrs } from '../base/AcDbObject'

/**
 * Interface defining the attributes for symbol table records.
 *
 * Extends the base AcDbObjectAttrs interface and adds a name property
 * that is required for all symbol table records.
 */
export interface AcDbSymbolTableRecordAttrs extends AcDbObjectAttrs {
  /** The name of the symbol table record */
  name: string
}

/**
 * Base class for all symbol table records.
 *
 * This class provides the fundamental functionality for all symbol table records,
 * including name management. Symbol table records represent entries in various
 * symbol tables such as layer tables, linetype tables, text style tables, etc.
 *
 * @example
 * ```typescript
 * class MySymbolTableRecord extends AcDbSymbolTableRecord {
 *   constructor(attrs?: Partial<AcDbSymbolTableRecordAttrs>) {
 *     super(attrs);
 *   }
 * }
 * ```
 */
export class AcDbSymbolTableRecord extends AcDbObject {
  /** The name of the symbol table record */
  private _name: string = ''

  /**
   * Creates a new AcDbSymbolTableRecord instance.
   *
   * @param attrs - Input attribute values for this symbol table record
   *
   * @example
   * ```typescript
   * const record = new AcDbSymbolTableRecord({ name: 'MyRecord' });
   * ```
   */
  constructor(attrs?: Partial<AcDbSymbolTableRecordAttrs>) {
    attrs = attrs || {}
    super(attrs)
    this._name = attrs.name ?? ''
  }

  /**
   * Gets or sets the name of the symbol table record.
   *
   * This property corresponds to DXF group code 2 and is used for
   * identifying and referencing the symbol table record.
   *
   * @returns The name of the symbol table record
   *
   * @example
   * ```typescript
   * const recordName = record.name;
   * record.name = 'NewRecordName';
   * ```
   */
  get name(): string {
    return this._name
  }
  set name(value: string) {
    this._name = value
  }

  /**
   * Writes DXF fields for this object.
   *
   * @param filer - DXF output writer.
   * @returns The instance (for chaining).
   */
  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbSymbolTableRecord')
    return this
  }
}
