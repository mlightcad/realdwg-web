import { AcGeMatrix3d, AcGePoint3d } from '@mlightcad/geometry-engine'

import { AcDbAssocArrayCommonParameters } from './AcDbAssocArrayCommonParameters.js'
import { AcDbAssocArrayItemLocator } from './AcDbAssocArrayItemLocator.js'

/**
 * Polar associative-array parameters
 * (ObjectARX `AcDbAssocArrayPolarParameters`).
 *
 * @remarks Do not subclass — AutoCAD does not support further derivation.
 */
export class AcDbAssocArrayPolarParameters extends AcDbAssocArrayCommonParameters {
  private _angleBetweenItems = Math.PI / 3
  private _fillAngle = 2 * Math.PI
  private _rotateItems = true
  private _direction = 1
  private _center = new AcGePoint3d(0, 0, 0)
  private _basePoint = new AcGePoint3d(0, 0, 0)

  /**
   * @param angleBetweenItems - Angle between items in radians when using
   *   explicit spacing (ObjectARX ctor first arg is degrees).
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
    this._angleBetweenItems = angleBetweenItems
    this.rowSpacing = rowSpacing
    this.levelSpacing = levelSpacing
    this.itemCount = itemCount
    this.rowCount = rowCount
    this.levelCount = levelCount
    this.rowElevation = rowElevation
    this.fillAngle = angleBetweenItems * Math.max(0, itemCount - 1)
  }

  get angleBetweenItems(): number {
    return this._angleBetweenItems
  }
  set angleBetweenItems(value: number) {
    this._angleBetweenItems = value
  }

  get fillAngle(): number {
    return this._fillAngle
  }
  set fillAngle(value: number) {
    this._fillAngle = value
    if (this.itemCount > 1) {
      this._angleBetweenItems = value / (this.itemCount - 1)
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

  get center(): AcGePoint3d {
    return this._center
  }
  set center(value: AcGePoint3d) {
    this._center = value.clone()
  }

  get basePoint(): AcGePoint3d {
    return this._basePoint
  }
  set basePoint(value: AcGePoint3d) {
    this._basePoint = value.clone()
  }

  get parameterType(): 'polar' {
    return 'polar'
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
    const angle =
      this._direction * locator.itemIndex * this._angleBetweenItems
    const radiusExtra = locator.rowIndex * this.rowSpacing
    const dx0 = this._basePoint.x - this._center.x
    const dy0 = this._basePoint.y - this._center.y
    const r0 = Math.hypot(dx0, dy0)
    // Base == center yields r0 = 0; callers should put the source base on the
    // objects (selection centroid), not on the array center, so radius is
    // meaningful and live preview can form T(base)·M·T(-base).
    const baseAngle = r0 > 1e-12 ? Math.atan2(dy0, dx0) : 0
    const r = r0 + radiusExtra
    const a = baseAngle + angle
    const x = this._center.x + r * Math.cos(a) - this._basePoint.x
    const y = this._center.y + r * Math.sin(a) - this._basePoint.y
    const z =
      locator.levelIndex * this.levelSpacing +
      locator.rowIndex * this.rowElevation

    const m = AcGeMatrix3d.makeTranslation(x, y, z)
    if (this._rotateItems && angle !== 0) {
      const rot = new AcGeMatrix3d().makeRotationZ(angle)
      // BTR-local (sources relative to base as origin): T · R maps p' to
      // R·p' + (newBase − base), which equals rotating about `center` when
      // composed as T(base)·M·T(-base) in world space.
      return m.multiply(rot)
    }
    return m
  }

  toJSON(): Record<string, unknown> {
    return {
      type: this.parameterType,
      ...this.commonToJSON(),
      angleBetweenItems: this._angleBetweenItems,
      fillAngle: this._fillAngle,
      rotateItems: this._rotateItems,
      direction: this._direction,
      center: {
        x: this._center.x,
        y: this._center.y,
        z: this._center.z
      },
      basePoint: {
        x: this._basePoint.x,
        y: this._basePoint.y,
        z: this._basePoint.z
      }
    }
  }

  fromJSON(data: Record<string, unknown>): void {
    this.commonFromJSON(data)
    if (data.angleBetweenItems != null)
      this.angleBetweenItems = Number(data.angleBetweenItems)
    if (data.fillAngle != null) this._fillAngle = Number(data.fillAngle)
    if (data.rotateItems != null) this.rotateItems = !!data.rotateItems
    if (data.direction != null) this.direction = Number(data.direction)
    const c = data.center as { x?: number; y?: number; z?: number } | undefined
    if (c) {
      this._center = new AcGePoint3d(c.x ?? 0, c.y ?? 0, c.z ?? 0)
    }
    const b = data.basePoint as
      | { x?: number; y?: number; z?: number }
      | undefined
    if (b) {
      this._basePoint = new AcGePoint3d(b.x ?? 0, b.y ?? 0, b.z ?? 0)
    }
  }
}
