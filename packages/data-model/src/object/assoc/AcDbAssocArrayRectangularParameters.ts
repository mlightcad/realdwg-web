import { AcGeMatrix3d } from '@mlightcad/geometry-engine'

import { AcDbAssocValueUnitType } from './AcDbAssocAction.js'
import { AcDbAssocArrayCommonParameters } from './AcDbAssocArrayCommonParameters.js'
import { AcDbAssocArrayItemLocator } from './AcDbAssocArrayItemLocator.js'
import type { AcDbAssocArrayValueParamSpec } from './AcDbAssocArrayParameters.js'

/**
 * Rectangular associative-array parameters
 * (ObjectARX `AcDbAssocArrayRectangularParameters`).
 *
 * AutoCAD value parameters: `AlignItems`, `AxesAngle`, `ItemSpacing`
 * (column spacing), `Items` (columns), `LevelSpacing`, `Levels`,
 * `RowElevation`, `RowSpacing`, `Rows`.
 *
 * @remarks Do not subclass — AutoCAD does not support further derivation.
 */
export class AcDbAssocArrayRectangularParameters extends AcDbAssocArrayCommonParameters {
  private _axesAngle = Math.PI / 2
  private _alignItems = false

  /**
   * @param columnSpacing - Distance between columns.
   * @param rowSpacing - Distance between rows.
   * @param levelSpacing - Distance between levels.
   * @param columnCount - Number of columns.
   * @param rowCount - Number of rows.
   * @param levelCount - Number of levels.
   * @param rowElevation - Incremental Z per row.
   * @param axesAngle - Angle between row and column axes in **radians**
   *   (ObjectARX ctor takes degrees; this TS API uses radians consistently
   *   with the rest of the geometry engine — convert at the command layer).
   */
  constructor(
    columnSpacing = 1,
    rowSpacing = 1,
    levelSpacing = 1,
    columnCount = 1,
    rowCount = 1,
    levelCount = 1,
    rowElevation = 0,
    axesAngle = Math.PI / 2
  ) {
    super()
    this.columnSpacing = columnSpacing
    this.rowSpacing = rowSpacing
    this.levelSpacing = levelSpacing
    this.columnCount = columnCount
    this.rowCount = rowCount
    this.levelCount = levelCount
    this.rowElevation = rowElevation
    this.axesAngle = axesAngle
  }

  get axesAngle(): number {
    return this._axesAngle
  }
  set axesAngle(value: number) {
    this._axesAngle = value
  }

  /** AutoCAD `AlignItems` (unused by the rectangular layout; persisted). */
  get alignItems(): boolean {
    return this._alignItems
  }
  set alignItems(value: boolean) {
    this._alignItems = !!value
  }

  get parameterType(): 'rectangular' {
    return 'rectangular'
  }

  get className(): string {
    return 'AcDbAssocArrayRectangularParameters'
  }

  getItemLocators(): AcDbAssocArrayItemLocator[] {
    const locators: AcDbAssocArrayItemLocator[] = []
    for (let level = 0; level < this.levelCount; level++) {
      for (let col = 0; col < this.columnCount; col++) {
        for (let row = 0; row < this.rowCount; row++) {
          locators.push(new AcDbAssocArrayItemLocator(col, row, level))
        }
      }
    }
    return locators
  }

  getItemTransform(locator: AcDbAssocArrayItemLocator): AcGeMatrix3d {
    const col = locator.itemIndex
    const row = locator.rowIndex
    const level = locator.levelIndex
    const x =
      this._origin.x +
      col * this.columnSpacing +
      row * this.rowSpacing * Math.cos(this._axesAngle)
    const y = this._origin.y + row * this.rowSpacing * Math.sin(this._axesAngle)
    const z =
      this._origin.z + level * this.levelSpacing + row * this.rowElevation
    return AcGeMatrix3d.makeTranslation(x, y, z)
  }

  toValueParams(): AcDbAssocArrayValueParamSpec[] {
    const common = this.commonValueParams(
      this.columnSpacing,
      AcDbAssocValueUnitType.Distance
    )
    return [
      {
        name: 'AlignItems',
        value: this._alignItems ? 1 : 0,
        unitType: AcDbAssocValueUnitType.Unitless,
        code: 90
      },
      {
        name: 'AxesAngle',
        value: this._axesAngle,
        unitType: AcDbAssocValueUnitType.Angle,
        code: 40
      },
      ...common
    ]
  }

  fromValueParams(get: (name: string) => number | undefined): void {
    const spacing = this.commonFromValueParams(get)
    if (spacing != null) this.columnSpacing = spacing
    const axes = get('AxesAngle')
    if (axes != null) this.axesAngle = axes
    const align = get('AlignItems')
    if (align != null) this.alignItems = align !== 0
  }
}
