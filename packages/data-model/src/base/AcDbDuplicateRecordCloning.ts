/**
 * Defines how duplicate records are handled when objects
 * are cloned into a destination database.
 *
 * @remarks
 * This enum mirrors AcDb::DuplicateRecordCloning in ObjectARX.
 */
export enum AcDbDuplicateRecordCloning {
  /** No special cloning behavior */
  NotApplicable = 0,

  /** Ignore the duplicate record */
  Ignore = 1,

  /** Replace the existing record */
  Replace = 2,

  /** Mangle the name when coming from an external reference */
  XrefMangleName = 3,

  /** Always mangle the name to avoid conflicts */
  MangleName = 4
}
