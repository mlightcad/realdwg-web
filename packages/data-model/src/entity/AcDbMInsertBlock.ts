import {
  AcGeMatrix3d,
  AcGePoint3d,
  AcGeVector2d,
  AcGeVector3d
} from '@mlightcad/geometry-engine'

import { AcDbDxfFiler } from '../base/AcDbDxfFiler.js'
import { AcDbBlockReference } from './AcDbBlockReference.js'
import { AcDbEntityRuntimeProperty } from './AcDbEntityProperties.js'
import { acdbCreateProperty } from './AcDbEntityPropertyHelpers.js'

/**
 * Represents a MINSERT entity (multiple block reference) in AutoCAD.
 *
 * A MINSERT is a block reference that displays its block table record as a
 * rectangular array of `rows × columns` instances. The array is laid out in
 * the block reference's OCS and is rotated together with the reference by
 * {@link rotation}: instance `(row, column)` is displaced by
 * `column * columnSpacing` along the rotated X axis and `row * rowSpacing`
 * along the rotated Y axis. The spacing values are expressed in drawing units
 * and are not affected by {@link scaleFactors}.
 *
 * This class mirrors `AcDbMInsertBlock` in ObjectARX. Like AutoCAD, it is
 * written to DXF as an `INSERT` entity with the `AcDbMInsertBlock` subclass
 * marker.
 *
 * @example
 * ```typescript
 * // Create a 3 x 4 array of "Desk" blocks
 * const minsert = new AcDbMInsertBlock('Desk', 4, 3, 1200, 800)
 * minsert.position = new AcGePoint3d(0, 0, 0)
 * minsert.rotation = Math.PI / 2
 *
 * console.log(`Columns: ${minsert.columns}, rows: ${minsert.rows}`)
 * ```
 */
export class AcDbMInsertBlock extends AcDbBlockReference {
  /** The entity type name */
  static override typeName: string = 'MInsertBlock'

  /** The number of columns in the array (DXF group 70) */
  private _columns: number
  /** The number of rows in the array (DXF group 71) */
  private _rows: number
  /** The distance between columns (DXF group 44) */
  private _columnSpacing: number
  /** The distance between rows (DXF group 45) */
  private _rowSpacing: number

  /**
   * Creates a new MINSERT entity.
   *
   * @param blockName - The name of the block table record to reference
   * @param columns - The number of columns (at least 1)
   * @param rows - The number of rows (at least 1)
   * @param columnSpacing - The distance between columns
   * @param rowSpacing - The distance between rows
   */
  constructor(
    blockName: string,
    columns: number = 1,
    rows: number = 1,
    columnSpacing: number = 0,
    rowSpacing: number = 0
  ) {
    super(blockName)
    this._columns = AcDbMInsertBlock.normalizeCount(columns)
    this._rows = AcDbMInsertBlock.normalizeCount(rows)
    this._columnSpacing = columnSpacing
    this._rowSpacing = rowSpacing
  }

  /**
   * Gets the number of columns in the array.
   *
   * @returns The column count (at least 1)
   */
  get columns() {
    return this._columns
  }

  /**
   * Sets the number of columns in the array. Values are truncated to an
   * integer and clamped to at least 1.
   *
   * @param value - The new column count
   */
  set columns(value: number) {
    this._columns = AcDbMInsertBlock.normalizeCount(value)
  }

  /**
   * Gets the number of rows in the array.
   *
   * @returns The row count (at least 1)
   */
  get rows() {
    return this._rows
  }

  /**
   * Sets the number of rows in the array. Values are truncated to an integer
   * and clamped to at least 1.
   *
   * @param value - The new row count
   */
  set rows(value: number) {
    this._rows = AcDbMInsertBlock.normalizeCount(value)
  }

  /**
   * Gets the distance between columns, measured along the X axis of the
   * rotated block reference OCS.
   *
   * @returns The column spacing in drawing units
   */
  get columnSpacing() {
    return this._columnSpacing
  }

  /**
   * Sets the distance between columns.
   *
   * @param value - The new column spacing in drawing units
   */
  set columnSpacing(value: number) {
    this._columnSpacing = value
  }

  /**
   * Gets the distance between rows, measured along the Y axis of the rotated
   * block reference OCS.
   *
   * @returns The row spacing in drawing units
   */
  get rowSpacing() {
    return this._rowSpacing
  }

  /**
   * Sets the distance between rows.
   *
   * @param value - The new row spacing in drawing units
   */
  set rowSpacing(value: number) {
    this._rowSpacing = value
  }

  /**
   * Gets the offsets of all `rows × columns` instances, row by row.
   *
   * @inheritdoc
   */
  protected override getInstanceOffsets(): AcGeVector2d[] {
    const offsets: AcGeVector2d[] = []
    for (let row = 0; row < this._rows; row++) {
      for (let col = 0; col < this._columns; col++) {
        offsets.push(
          new AcGeVector2d(col * this._columnSpacing, row * this._rowSpacing)
        )
      }
    }
    return offsets
  }

  /**
   * Transforms this MINSERT by an arbitrary world-space matrix.
   *
   * The placement is transformed by {@link AcDbBlockReference.transformBy};
   * the column and row spacing are then re-expressed in the new rotated OCS so
   * the array follows uniform scaling and mirroring.
   *
   * @param matrix - Transformation matrix in WCS.
   * @returns The current entity instance.
   */
  override transformBy(matrix: AcGeMatrix3d) {
    const toWcs = this.getArrayAxesToWcs()
    const origin = this.position.clone()
    const columnEnd = new AcGePoint3d(this._columnSpacing, 0, 0)
      .applyMatrix4(toWcs)
      .add(origin)
    const rowEnd = new AcGePoint3d(0, this._rowSpacing, 0)
      .applyMatrix4(toWcs)
      .add(origin)
    origin.applyMatrix4(matrix)
    columnEnd.applyMatrix4(matrix)
    rowEnd.applyMatrix4(matrix)

    super.transformBy(matrix)

    const toLocal = this.getArrayAxesToWcs().invert()
    const columnStep = new AcGeVector3d(columnEnd)
      .sub(origin)
      .applyMatrix4(toLocal)
    const rowStep = new AcGeVector3d(rowEnd).sub(origin).applyMatrix4(toLocal)
    this._columnSpacing = columnStep.x
    this._rowSpacing = rowStep.y
    return this
  }

  /**
   * Gets the array parameters shown in the geometry group of
   * {@link AcDbBlockReference.properties}.
   *
   * @internal
   */
  protected override getArrayProperties(): AcDbEntityRuntimeProperty[] {
    // Counts must be whole numbers of at least 1; other input is ignored.
    const isCount = (value: number) => Number.isInteger(value) && value >= 1
    return [
      acdbCreateProperty(
        'columns',
        'int',
        () => this.columns,
        (value: number) => {
          if (isCount(value)) this.columns = value
        }
      ),
      acdbCreateProperty(
        'rows',
        'int',
        () => this.rows,
        (value: number) => {
          if (isCount(value)) this.rows = value
        }
      ),
      acdbCreateProperty(
        'columnSpacing',
        'float',
        () => this.columnSpacing,
        (value: number) => {
          if (Number.isFinite(value)) this.columnSpacing = value
        }
      ),
      acdbCreateProperty(
        'rowSpacing',
        'float',
        () => this.rowSpacing,
        (value: number) => {
          if (Number.isFinite(value)) this.rowSpacing = value
        }
      )
    ]
  }

  /** @internal */
  protected override get dxfSubclassName() {
    return 'AcDbMInsertBlock'
  }

  /** @internal */
  protected override dxfOutArrayFields(filer: AcDbDxfFiler) {
    filer.writeInt16(70, this._columns)
    filer.writeInt16(71, this._rows)
    filer.writeDouble(44, this._columnSpacing)
    filer.writeDouble(45, this._rowSpacing)
  }

  /** @internal */
  protected override dxfInArrayField(code: number, value: number) {
    switch (code) {
      case 70:
        this.columns = value
        break
      case 71:
        this.rows = value
        break
      case 44:
        this._columnSpacing = value
        break
      case 45:
        this._rowSpacing = value
        break
      default:
        break
    }
  }

  /**
   * Maps the array axes (rotated OCS) to WCS directions, excluding the
   * translation to the insertion point.
   */
  private getArrayAxesToWcs() {
    const extrusion = new AcGeMatrix3d().setFromExtrusionDirection(this.normal)
    const rotation = new AcGeMatrix3d().makeRotationZ(this.rotation)
    return new AcGeMatrix3d().multiplyMatrices(extrusion, rotation)
  }

  /** Truncates a count to an integer that is at least 1. */
  private static normalizeCount(value: number) {
    return Math.max(1, Math.trunc(value) || 1)
  }
}
