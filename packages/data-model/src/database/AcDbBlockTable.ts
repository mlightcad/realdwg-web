import { AcDbBlockTableRecord } from './AcDbBlockTableRecord'
import { AcDbDatabase } from './AcDbDatabase'
import { AcDbSymbolTable } from './AcDbSymbolTable'

/**
 * Symbol table for block table records.
 * 
 * This class manages block table records which represent block definitions
 * within a drawing database. Blocks are reusable collections of entities
 * that can be inserted multiple times into a drawing.
 * 
 * @example
 * ```typescript
 * const blockTable = new AcDbBlockTable(database);
 * const modelSpace = blockTable.modelSpace;
 * const block = blockTable.getAt('MyBlock');
 * ```
 */
export class AcDbBlockTable extends AcDbSymbolTable<AcDbBlockTableRecord> {
  /**
   * Creates a new AcDbBlockTable instance.
   * 
   * @param db - The database this block table belongs to
   * 
   * @example
   * ```typescript
   * const blockTable = new AcDbBlockTable(database);
   * ```
   */
  constructor(db: AcDbDatabase) {
    super(db)
  }

  /**
   * Gets the MODEL_SPACE block table record.
   * 
   * This method returns the model space block table record, creating it
   * if it doesn't exist. Model space is the primary drawing area where
   * most entities are created and stored.
   * 
   * @returns The MODEL_SPACE block table record
   * 
   * @example
   * ```typescript
   * const modelSpace = blockTable.modelSpace;
   * const entities = modelSpace.entities;
   * ```
   */
  get modelSpace(): AcDbBlockTableRecord {
    let modelSpace = this.getAt(AcDbBlockTableRecord.MODEL_SPACE_NAME)
    if (!modelSpace) {
      modelSpace = new AcDbBlockTableRecord()
      modelSpace.name = AcDbBlockTableRecord.MODEL_SPACE_NAME
      this.add(modelSpace)
    }
    return modelSpace
  }

  /**
   * Normalizes the specified block table record name if it is one paper spacce or model space
   * block table record. 
   *
   * @override
   * @param name - The name of the block table record.
   * @returns The normalized block table record name.
   */
  protected normalizeName(name: string) {
    let regularizedName = name
    if (AcDbBlockTableRecord.isModelSapceName(name)) {
      regularizedName = AcDbBlockTableRecord.MODEL_SPACE_NAME
    } else if (AcDbBlockTableRecord.isPaperSapceName(name)) {
      const prefix = AcDbBlockTableRecord.PAPER_SPACE_NAME_PREFIX
      const suffix = name.substring(prefix.length)
      regularizedName = prefix + suffix
    }
    return regularizedName
  }
}
