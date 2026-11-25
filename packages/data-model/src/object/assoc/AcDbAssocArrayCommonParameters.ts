import { AcGePoint3d, AcGeVector3d } from '@mlightcad/geometry-engine'

import { AcDbAssocValueUnitType } from './AcDbAssocAction.js'
import {
  AcDbAssocArrayParameters,
  type AcDbAssocArrayValueParamSpec
} from './AcDbAssocArrayParameters.js'

/**
 * Parameters shared by rectangular, polar, and path arrays
 * (ObjectARX `AcDbAssocArrayCommonParameters`).
 *
 * AutoCAD value-parameter names: `Items`, `ItemSpacing`, `Rows`,
 * `RowSpacing`, `RowElevation`, `Levels`, `LevelSpacing`; point parameters
 * `Origin`, `BaseNormal`, `basePoint`.
 */
export abstract class AcDbAssocArrayCommonParameters extends AcDbAssocArrayParameters {
  protected _rowCount = 1
  protected _columnCount = 1
  protected _levelCount = 1
  protected _rowSpacing = 1
  protected _columnSpacing = 1
  protected _levelSpacing = 1
  protected _rowElevation = 0
  /** Array origin in array-block coordinates (`Origin` action param). */
  protected _origin = new AcGePoint3d(0, 0, 0)
  /** Array plane normal (`BaseNormal` action param). */
  protected _baseNormal = new AcGeVector3d(0, 0, 1)
  /** Base point in source-block coordinates (`basePoint` action param). */
  protected _basePoint = new AcGePoint3d(0, 0, 0)

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

  /**
   * Array origin in array-block coordinates (AutoCAD `Origin` parameter).
   * For polar arrays this is the center.
   */
  get origin(): AcGePoint3d {
    return this._origin
  }
  set origin(value: AcGePoint3d) {
    this._origin = value.clone()
  }

  get baseNormal(): AcGeVector3d {
    return this._baseNormal
  }
  set baseNormal(value: AcGeVector3d) {
    this._baseNormal = value.clone()
  }

  /** Base point in source-block coordinates (AutoCAD `basePoint`). */
  get basePoint(): AcGePoint3d {
    return this._basePoint
  }
  set basePoint(value: AcGePoint3d) {
    this._basePoint = value.clone()
  }

  /**
   * Common value parameters in AutoCAD's order. `itemSpacing` is the
   * type-specific `ItemSpacing` value (distance or angle).
   */
  protected commonValueParams(
    itemSpacing: number,
    itemSpacingUnit: AcDbAssocValueUnitType
  ): AcDbAssocArrayValueParamSpec[] {
    const D = AcDbAssocValueUnitType.Distance
    const U = AcDbAssocValueUnitType.Unitless
    return [
      {
        name: 'ItemSpacing',
        value: itemSpacing,
        unitType: itemSpacingUnit,
        code: 40
      },
      { name: 'Items', value: this.itemCount, unitType: U, code: 90 },
      {
        name: 'LevelSpacing',
        value: this._levelSpacing,
        unitType: D,
        code: 40
      },
      { name: 'Levels', value: this._levelCount, unitType: U, code: 90 },
      {
        name: 'RowElevation',
        value: this._rowElevation,
        unitType: D,
        code: 40
      },
      { name: 'RowSpacing', value: this._rowSpacing, unitType: D, code: 40 },
      { name: 'Rows', value: this._rowCount, unitType: U, code: 90 }
    ]
  }

  /**
   * Restores common values; returns the `ItemSpacing` value, if present.
   */
  protected commonFromValueParams(
    get: (name: string) => number | undefined
  ): number | undefined {
    const items = get('Items')
    if (items != null) this.itemCount = items
    const levels = get('Levels')
    if (levels != null) this.levelCount = levels
    const levelSpacing = get('LevelSpacing')
    if (levelSpacing != null) this.levelSpacing = levelSpacing
    const rows = get('Rows')
    if (rows != null) this.rowCount = rows
    const rowSpacing = get('RowSpacing')
    if (rowSpacing != null) this.rowSpacing = rowSpacing
    const rowElevation = get('RowElevation')
    if (rowElevation != null) this.rowElevation = rowElevation
    return get('ItemSpacing')
  }
}
