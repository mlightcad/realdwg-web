import { AcGeMatrix3d, AcGePoint3d } from '@mlightcad/geometry-engine'

import { AcDbAssocValueUnitType } from './AcDbAssocAction.js'
import { AcDbAssocArrayCommonParameters } from './AcDbAssocArrayCommonParameters.js'
import { AcDbAssocArrayItemLocator } from './AcDbAssocArrayItemLocator.js'
import type { AcDbAssocArrayValueParamSpec } from './AcDbAssocArrayParameters.js'

const TWO_PI = Math.PI * 2

/**
 * Polar associative-array parameters
 * (ObjectARX `AcDbAssocArrayPolarParameters`).
 *
 * AutoCAD value parameters: `FillAngle`, `ItemSpacing` (angle between items),
 * `Items`, `LevelSpacing`, `Levels`, `RowElevation`, `RowSpacing`, `Rows`,
 * `Radius`, `StartAngle`; the center is the `Origin` point parameter.
 * Clockwise arrays store negative angles.
 *
 * Item 0 is placed at `center + radius·(cos startAngle, sin startAngle)`;
 * item i is item 0 rotated by `i · angleBetweenItems` about the center.
 *
 * @remarks Do not subclass — AutoCAD does not support further derivation.
 */
export class AcDbAssocArrayPolarParameters extends AcDbAssocArrayCommonParameters {
  private _angleBetweenItems = Math.PI / 3
  private _fillAngle = TWO_PI
  private _rotateItems = true
  private _direction = 1
  private _radius = 0
  private _startAngle = 0

  /**
   * @param angleBetweenItems - Angle between items in radians
   *   (ObjectARX ctor first arg is degrees).
   * @param rowSpacing - Radial row spacing.
   * @param levelSpacing - Level spacing.
   * @param itemCount - Number of items around the center.
   * @param rowCount - Number of radial rows.
   * @param levelCount - Number of levels.
   * @param rowElevation - Z elevation per row.
   */
  constructor(
    angleBetweenItems = Math.PI / 3,
    rowSpacing = 0,
    levelSpacing = 1,
    itemCount = 6,
    rowCount = 1,
    levelCount = 1,
    rowElevation = 0
  ) {
    super()
    this._angleBetweenItems = Math.abs(angleBetweenItems)
    this.rowSpacing = rowSpacing
    this.levelSpacing = levelSpacing
    this._columnCount = Math.max(1, Math.floor(itemCount) || 1)
    this.rowCount = rowCount
    this.levelCount = levelCount
    this.rowElevation = rowElevation
    const n = this._columnCount
    const span = this._angleBetweenItems * n
    this._fillAngle =
      Math.abs(span - TWO_PI) < 1e-9
        ? TWO_PI
        : this._angleBetweenItems * Math.max(0, n - 1)
  }

  /** Positive angle between adjacent items, in radians. */
  get angleBetweenItems(): number {
    return this._angleBetweenItems
  }
  set angleBetweenItems(value: number) {
    this._angleBetweenItems = Math.abs(value)
    if (!this.isFullCircle) {
      this._fillAngle =
        this._angleBetweenItems * Math.max(0, this.itemCount - 1)
    }
  }

  /**
   * Total angle filled by the array, in radians. A full circle (2π) spaces
   * items by `fill / n`; any other fill by `fill / (n - 1)` (AutoCAD).
   */
  get fillAngle(): number {
    return this._fillAngle
  }
  set fillAngle(value: number) {
    this._fillAngle = Math.min(TWO_PI, Math.abs(value))
    this.updateSpacingFromFill()
  }

  override get itemCount(): number {
    return this._columnCount
  }
  override set itemCount(value: number) {
    this.columnCount = value
    this.updateSpacingFromFill()
  }

  private get isFullCircle(): boolean {
    return Math.abs(this._fillAngle - TWO_PI) < 1e-9
  }

  private updateSpacingFromFill(): void {
    const n = this.itemCount
    if (this.isFullCircle) {
      this._angleBetweenItems = TWO_PI / Math.max(1, n)
    } else if (n > 1) {
      this._angleBetweenItems = this._fillAngle / (n - 1)
    }
  }

  get rotateItems(): boolean {
    return this._rotateItems
  }
  set rotateItems(value: boolean) {
    this._rotateItems = !!value
  }

  /** `1` = CCW, `-1` = CW. */
  get direction(): number {
    return this._direction
  }
  set direction(value: number) {
    this._direction = value < 0 ? -1 : 1
  }

  /** Array center in array-block coordinates (AutoCAD `Origin`). */
  get center(): AcGePoint3d {
    return this._origin
  }
  set center(value: AcGePoint3d) {
    this._origin = value.clone()
  }

  /** Distance from the center to item 0 (AutoCAD `Radius`). */
  get radius(): number {
    return this._radius
  }
  set radius(value: number) {
    this._radius = Math.max(0, value)
  }

  /** Angle of item 0 around the center, in radians (AutoCAD `StartAngle`). */
  get startAngle(): number {
    return this._startAngle
  }
  set startAngle(value: number) {
    this._startAngle = value
  }

  /**
   * Sets {@link radius} and {@link startAngle} so item 0 sits at `point`
   * (array-block coordinates).
   */
  setFirstItemPosition(point: { x: number; y: number }): void {
    const dx = point.x - this._origin.x
    const dy = point.y - this._origin.y
    this._radius = Math.hypot(dx, dy)
    this._startAngle = this._radius > 1e-12 ? Math.atan2(dy, dx) : 0
  }

  get parameterType(): 'polar' {
    return 'polar'
  }

  get className(): string {
    return 'AcDbAssocArrayPolarParameters'
  }

  getItemLocators(): AcDbAssocArrayItemLocator[] {
    const locators: AcDbAssocArrayItemLocator[] = []
    for (let level = 0; level < this.levelCount; level++) {
      for (let row = 0; row < this.rowCount; row++) {
        for (let item = 0; item < this.itemCount; item++) {
          locators.push(new AcDbAssocArrayItemLocator(item, row, level))
        }
      }
    }
    return locators
  }

  getItemTransform(locator: AcDbAssocArrayItemLocator): AcGeMatrix3d {
    const c = this._origin
    const angle = this._direction * locator.itemIndex * this._angleBetweenItems
    const r = this._radius + locator.rowIndex * this.rowSpacing
    const z =
      locator.levelIndex * this.levelSpacing +
      locator.rowIndex * this.rowElevation
    // Item 0 position relative to the center.
    const rx = r * Math.cos(this._startAngle)
    const ry = r * Math.sin(this._startAngle)
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const x = c.x + rx * cos - ry * sin
    const y = c.y + rx * sin + ry * cos
    const m = AcGeMatrix3d.makeTranslation(x, y, c.z + z)
    if (this._rotateItems && angle !== 0) {
      m.multiply(new AcGeMatrix3d().makeRotationZ(angle))
    }
    return m
  }

  toValueParams(): AcDbAssocArrayValueParamSpec[] {
    const A = AcDbAssocValueUnitType.Angle
    const D = AcDbAssocValueUnitType.Distance
    const U = AcDbAssocValueUnitType.Unitless
    const params: AcDbAssocArrayValueParamSpec[] = [
      {
        name: 'FillAngle',
        value: this._direction * this._fillAngle,
        unitType: A,
        code: 40
      },
      ...this.commonValueParams(this._direction * this._angleBetweenItems, A),
      { name: 'Radius', value: this._radius, unitType: D, code: 40 },
      { name: 'StartAngle', value: this._startAngle, unitType: A, code: 40 }
    ]
    // AutoCAD does not write AlignItems for polar arrays it creates with
    // rotated items; store it only when items keep their orientation.
    if (!this._rotateItems) {
      params.push({ name: 'AlignItems', value: 0, unitType: U, code: 90 })
    }
    return params
  }

  fromValueParams(get: (name: string) => number | undefined): void {
    const spacing = this.commonFromValueParams(get)
    const fill = get('FillAngle')
    const sign = (fill ?? spacing ?? 1) < 0 ? -1 : 1
    this._direction = sign
    if (fill != null) this._fillAngle = Math.min(TWO_PI, Math.abs(fill))
    if (spacing != null) this._angleBetweenItems = Math.abs(spacing)
    else this.updateSpacingFromFill()
    const radius = get('Radius')
    if (radius != null) this._radius = Math.abs(radius)
    const start = get('StartAngle')
    if (start != null) this._startAngle = start
    const align = get('AlignItems')
    if (align != null) this._rotateItems = align !== 0
  }
}
