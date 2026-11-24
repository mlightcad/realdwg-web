import { AcDbAssocArrayParameters } from './AcDbAssocArrayParameters.js'

/**
 * Parameters shared by rectangular, polar, and path arrays
 * (ObjectARX `AcDbAssocArrayCommonParameters`).
 */
export abstract class AcDbAssocArrayCommonParameters extends AcDbAssocArrayParameters {
  protected _rowCount = 1
  protected _columnCount = 1
  protected _levelCount = 1
  protected _rowSpacing = 1
  protected _columnSpacing = 1
  protected _levelSpacing = 1
  protected _rowElevation = 0

  get rowCount(): number {
    return this._rowCount
  }
  set rowCount(value: number) {
    this._rowCount = Math.max(1, Math.floor(value) || 1)
  }

  get columnCount(): number {
    return this._columnCount
  }
  set columnCount(value: number) {
    this._columnCount = Math.max(1, Math.floor(value) || 1)
  }

  get levelCount(): number {
    return this._levelCount
  }
  set levelCount(value: number) {
    this._levelCount = Math.max(1, Math.floor(value) || 1)
  }

  get rowSpacing(): number {
    return this._rowSpacing
  }
  set rowSpacing(value: number) {
    this._rowSpacing = value
  }

  get columnSpacing(): number {
    return this._columnSpacing
  }
  set columnSpacing(value: number) {
    this._columnSpacing = value
  }

  get levelSpacing(): number {
    return this._levelSpacing
  }
  set levelSpacing(value: number) {
    this._levelSpacing = value
  }

  get rowElevation(): number {
    return this._rowElevation
  }
  set rowElevation(value: number) {
    this._rowElevation = value
  }

  /** Item count along the primary axis (columns / polar items / path items). */
  get itemCount(): number {
    return this._columnCount
  }
  set itemCount(value: number) {
    this.columnCount = value
  }

  protected commonToJSON(): Record<string, unknown> {
    return {
      rowCount: this._rowCount,
      columnCount: this._columnCount,
      levelCount: this._levelCount,
      rowSpacing: this._rowSpacing,
      columnSpacing: this._columnSpacing,
      levelSpacing: this._levelSpacing,
      rowElevation: this._rowElevation
    }
  }

  protected commonFromJSON(data: Record<string, unknown>): void {
    if (data.rowCount != null) this.rowCount = Number(data.rowCount)
    if (data.columnCount != null) this.columnCount = Number(data.columnCount)
    if (data.levelCount != null) this.levelCount = Number(data.levelCount)
    if (data.rowSpacing != null) this.rowSpacing = Number(data.rowSpacing)
    if (data.columnSpacing != null)
      this.columnSpacing = Number(data.columnSpacing)
    if (data.levelSpacing != null) this.levelSpacing = Number(data.levelSpacing)
    if (data.rowElevation != null) this.rowElevation = Number(data.rowElevation)
  }
}
