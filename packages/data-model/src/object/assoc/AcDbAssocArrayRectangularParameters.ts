import { AcGeMatrix3d } from '@mlightcad/geometry-engine'

import { AcDbAssocArrayCommonParameters } from './AcDbAssocArrayCommonParameters.js'
import { AcDbAssocArrayItemLocator } from './AcDbAssocArrayItemLocator.js'

/**
 * Rectangular associative-array parameters
 * (ObjectARX `AcDbAssocArrayRectangularParameters`).
 *
 * @remarks Do not subclass — AutoCAD does not support further derivation.
 */
export class AcDbAssocArrayRectangularParameters extends AcDbAssocArrayCommonParameters {
  private _axesAngle = Math.PI / 2

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

  get parameterType(): 'rectangular' {
    return 'rectangular'
  }

  getItemLocators(): AcDbAssocArrayItemLocator[] {
    const locators: AcDbAssocArrayItemLocator[] = []
    for (let level = 0; level < this.levelCount; level++) {
      for (let row = 0; row < this.rowCount; row++) {
        for (let col = 0; col < this.columnCount; col++) {
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
      col * this.columnSpacing +
      row * this.rowSpacing * Math.cos(this._axesAngle)
    const y = row * this.rowSpacing * Math.sin(this._axesAngle)
    const z = level * this.levelSpacing + row * this.rowElevation
    return AcGeMatrix3d.makeTranslation(x, y, z)
  }

  toJSON(): Record<string, unknown> {
    return {
      type: this.parameterType,
      ...this.commonToJSON(),
      axesAngle: this._axesAngle
    }
  }

  fromJSON(data: Record<string, unknown>): void {
    this.commonFromJSON(data)
    if (data.axesAngle != null) this.axesAngle = Number(data.axesAngle)
  }
}
