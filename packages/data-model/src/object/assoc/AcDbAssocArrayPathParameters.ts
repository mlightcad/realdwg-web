import {
  AcGeMatrix3d,
  AcGePoint3d,
  AcGeVector3d
} from '@mlightcad/geometry-engine'

import type { AcDbCurve } from '../../entity/AcDbCurve.js'
import { AcDbAssocValueUnitType } from './AcDbAssocAction.js'
import { AcDbAssocArrayCommonParameters } from './AcDbAssocArrayCommonParameters.js'
import { AcDbAssocArrayItemLocator } from './AcDbAssocArrayItemLocator.js'
import type { AcDbAssocArrayValueParamSpec } from './AcDbAssocArrayParameters.js'

/**
 * Path-array distribution method (ObjectARX
 * `AcDbAssocArrayPathParameters::Method`).
 */
export enum AcDbAssocArrayPathMethod {
  /** Place items at a fixed spacing along the path. */
  kMeasure = 0,
  /** Divide the path into equal segments for the item count. */
  kDivide = 1
}

/**
 * Soft reference to a path curve entity.
 */
export interface AcDbAssocArrayPathEdgeRef {
  entityId: string
}

/**
 * Path associative-array parameters
 * (ObjectARX `AcDbAssocArrayPathParameters`).
 *
 * AutoCAD value parameters: `ItemSpacing`, `Items`, `LevelSpacing`,
 * `Levels`, `RowElevation`, `RowSpacing`, `Rows`, `AlignItems`, `FillPath`,
 * `MaintainZ`, `Orientation`, `TangentOrientationAngle`. The path is the
 * `RowProfile` edge parameter and its dependency.
 *
 * Item i is placed at the path point at distance `dᵢ`; with
 * {@link alignItems} it is rotated to the path tangent there. The source
 * block is authored in the frame of item 0, as in AutoCAD.
 *
 * AutoCAD persists the measure method only: a divide array is written as a
 * measure array whose spacing is `length / (n - 1)`.
 *
 * @remarks Do not subclass — AutoCAD does not support further derivation.
 */
export class AcDbAssocArrayPathParameters extends AcDbAssocArrayCommonParameters {
  private _method: AcDbAssocArrayPathMethod = AcDbAssocArrayPathMethod.kMeasure
  private _itemSpacing = 1
  private _alignItems = true
  private _maintainZ = true
  private _fillPath = false
  private _orientation = 1
  private _tangentOrientationAngle = 0
  private _path: AcDbAssocArrayPathEdgeRef | undefined
  /**
   * Runtime path curve used when evaluating transforms. Not persisted; the
   * action body resolves it from the path dependency before evaluation.
   */
  private _pathCurve: AcDbCurve | undefined
  /** World → array-block transform applied to path geometry. */
  private _worldToArray: AcGeMatrix3d | undefined

  constructor(
    itemSpacing = 1,
    rowSpacing = 1,
    levelSpacing = 1,
    itemCount = 1,
    rowCount = 1,
    levelCount = 1,
    rowElevation = 0
  ) {
    super()
    this._itemSpacing = itemSpacing
    this.rowSpacing = rowSpacing
    this.levelSpacing = levelSpacing
    this.itemCount = itemCount
    this.rowCount = rowCount
    this.levelCount = levelCount
    this.rowElevation = rowElevation
  }

  get method(): AcDbAssocArrayPathMethod {
    return this._method
  }
  set method(value: AcDbAssocArrayPathMethod) {
    this._method = value
  }

  get itemSpacing(): number {
    return this._itemSpacing
  }
  set itemSpacing(value: number) {
    this._itemSpacing = value
  }

  get alignItems(): boolean {
    return this._alignItems
  }
  set alignItems(value: boolean) {
    this._alignItems = !!value
  }

  get maintainZ(): boolean {
    return this._maintainZ
  }
  set maintainZ(value: boolean) {
    this._maintainZ = !!value
  }

  /**
   * AutoCAD `FillPath`: with the measure method, the item count follows the
   * path length (`floor(length / spacing) + 1`).
   */
  get fillPath(): boolean {
    return this._fillPath
  }
  set fillPath(value: boolean) {
    this._fillPath = !!value
  }

  /** AutoCAD `Orientation` (persisted as-is). */
  get orientation(): number {
    return this._orientation
  }
  set orientation(value: number) {
    this._orientation = Math.trunc(value)
  }

  /** AutoCAD `TangentOrientationAngle`, radians (persisted as-is). */
  get tangentOrientationAngle(): number {
    return this._tangentOrientationAngle
  }
  set tangentOrientationAngle(value: number) {
    this._tangentOrientationAngle = value
  }

  get path(): AcDbAssocArrayPathEdgeRef | undefined {
    return this._path
  }

  setPath(edge: AcDbAssocArrayPathEdgeRef): void {
    this._path = { entityId: edge.entityId }
  }

  /**
   * Binds the live curve used by {@link getItemTransform}.
   *
   * @param worldToArray - Transform from world to array-block coordinates
   *   (inverse of the array INSERT transform). Identity when omitted.
   */
  setPathCurve(
    curve: AcDbCurve | undefined,
    worldToArray?: AcGeMatrix3d
  ): void {
    this._pathCurve = curve
    this._worldToArray = worldToArray?.clone()
  }

  get parameterType(): 'path' {
    return 'path'
  }

  get className(): string {
    return 'AcDbAssocArrayPathParameters'
  }

  /** Path length, or 0 when no curve is bound. */
  pathLength(): number {
    const curve = this._pathCurve
    if (!curve) return 0
    const end = curve.getDistAtParam(curve.endParam)
    const start = curve.getDistAtParam(curve.startParam)
    if (end == null || start == null) return 0
    return Math.abs(end - start)
  }

  /** Item count actually placed on the bound path. */
  effectiveItemCount(): number {
    let itemCount = this.itemCount
    if (
      this._method === AcDbAssocArrayPathMethod.kMeasure &&
      this._pathCurve &&
      this._itemSpacing > 0
    ) {
      const length = this.pathLength()
      if (length > 0) {
        const fit = Math.floor(length / this._itemSpacing + 1e-9) + 1
        itemCount = this._fillPath ? fit : Math.min(itemCount, fit)
      }
    }
    return Math.max(1, itemCount)
  }

  getItemLocators(): AcDbAssocArrayItemLocator[] {
    // kMeasure: only place items that fit on the path (AutoCAD Measure).
    const itemCount = this.effectiveItemCount()
    const locators: AcDbAssocArrayItemLocator[] = []
    for (let level = 0; level < this.levelCount; level++) {
      for (let row = 0; row < this.rowCount; row++) {
        for (let item = 0; item < itemCount; item++) {
          locators.push(new AcDbAssocArrayItemLocator(item, row, level))
        }
      }
    }
    return locators
  }

  private toArray(point: AcGePoint3d): AcGePoint3d {
    const m = this._worldToArray
    if (!m) return point
    const e = m.elements
    return new AcGePoint3d(
      e[0] * point.x + e[4] * point.y + e[8] * point.z + e[12],
      e[1] * point.x + e[5] * point.y + e[9] * point.z + e[13],
      e[2] * point.x + e[6] * point.y + e[10] * point.z + e[14]
    )
  }

  private pointAtDistance(dist: number): AcGePoint3d | undefined {
    const curve = this._pathCurve
    if (!curve) return undefined
    let point: AcGePoint3d | undefined
    if (typeof curve.getPointAtDist === 'function') {
      point = curve.getPointAtDist(dist)
    } else {
      const param = curve.getParamAtDist?.(dist)
      point = param == null ? undefined : curve.getPointAtParam(param)
    }
    return point ? this.toArray(point) : undefined
  }

  private tangentAtDistance(dist: number): AcGeVector3d {
    // Finite difference in array space (also handles path transforms).
    const length = this.pathLength()
    const h = Math.max(1e-6, Math.min(1e-3, length * 1e-6 || 1e-3))
    const d0 = Math.max(0, dist - h)
    const d1 = length > 0 ? Math.min(length, dist + h) : dist + h
    const p0 = this.pointAtDistance(d0 === d1 ? Math.max(0, d1 - 2 * h) : d0)
    const p1 = this.pointAtDistance(d1)
    if (p0 && p1) {
      const v = new AcGeVector3d(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z)
      if (v.lengthSq() > 1e-20) return v.normalize()
    }
    return new AcGeVector3d(1, 0, 0)
  }

  /** Distance along the path of item `index`. */
  distanceOfItem(index: number): number {
    const length = this.pathLength()
    if (this._method === AcDbAssocArrayPathMethod.kDivide) {
      const n = this.itemCount
      const denom = Math.max(1, n - (this._pathCurve?.closed ? 0 : 1))
      return n <= 1 ? 0 : (index / denom) * length
    }
    const dist = index * this._itemSpacing
    return length > 0 ? Math.min(dist, length) : dist
  }

  /**
   * Item frame on the path (array-block coordinates) without the source
   * offset: translation to the path point, rotated to the tangent when
   * aligned. Item 0's frame is how the source block is authored.
   */
  getItemTransform(locator: AcDbAssocArrayItemLocator): AcGeMatrix3d {
    const dist = this.distanceOfItem(locator.itemIndex)
    const point = this.pointAtDistance(dist) ?? this._origin.clone()
    const tangent = this.tangentAtDistance(dist)
    // Rows are offset along the in-plane normal of the path.
    let side = new AcGeVector3d(0, 0, 1).cross(tangent)
    if (side.lengthSq() > 1e-20) side.normalize()
    else side = new AcGeVector3d(0, 1, 0)
    const rowOffset = locator.rowIndex * this.rowSpacing

    const x = point.x + side.x * rowOffset
    const y = point.y + side.y * rowOffset
    const z =
      (this._maintainZ ? point.z : 0) +
      locator.levelIndex * this.levelSpacing +
      locator.rowIndex * this.rowElevation

    const m = AcGeMatrix3d.makeTranslation(x, y, z)
    if (this._alignItems) {
      const angle = Math.atan2(tangent.y, tangent.x)
      if (Math.abs(angle) > 1e-12) {
        m.multiply(new AcGeMatrix3d().makeRotationZ(angle))
      }
    }
    return m
  }

  /**
   * Frame of item 0 (used to author the source block when the array is
   * created).
   */
  getFirstItemFrame(): AcGeMatrix3d {
    return this.getItemTransform(new AcDbAssocArrayItemLocator(0, 0, 0))
  }

  toValueParams(): AcDbAssocArrayValueParamSpec[] {
    const D = AcDbAssocValueUnitType.Distance
    const U = AcDbAssocValueUnitType.Unitless
    let spacing = this._itemSpacing
    let items = this.itemCount
    if (this._pathCurve) items = this.effectiveItemCount()
    if (this._method === AcDbAssocArrayPathMethod.kDivide) {
      const length = this.pathLength()
      const n = this.itemCount
      const denom = Math.max(1, n - (this._pathCurve?.closed ? 0 : 1))
      if (length > 0 && n > 1) spacing = length / denom
      items = n
    }
    return [
      ...this.commonValueParams(spacing, D),
      {
        name: 'AlignItems',
        value: this._alignItems ? 1 : 0,
        unitType: U,
        code: 90
      },
      {
        name: 'FillPath',
        value: this._fillPath ? 1 : 0,
        unitType: U,
        code: 40
      },
      {
        name: 'MaintainZ',
        value: this._maintainZ ? 1 : 0,
        unitType: U,
        code: 40
      },
      { name: 'Orientation', value: this._orientation, unitType: U, code: 90 },
      {
        name: 'TangentOrientationAngle',
        value: this._tangentOrientationAngle,
        unitType: U,
        code: 40
      }
    ].map(spec =>
      spec.name === 'Items' ? { ...spec, value: items } : spec
    ) as AcDbAssocArrayValueParamSpec[]
  }

  fromValueParams(get: (name: string) => number | undefined): void {
    const spacing = this.commonFromValueParams(get)
    if (spacing != null) this._itemSpacing = spacing
    this._method = AcDbAssocArrayPathMethod.kMeasure
    const align = get('AlignItems')
    if (align != null) this._alignItems = align !== 0
    const fill = get('FillPath')
    if (fill != null) this._fillPath = fill !== 0
    const maintainZ = get('MaintainZ')
    if (maintainZ != null) this._maintainZ = maintainZ !== 0
    const orientation = get('Orientation')
    if (orientation != null) this._orientation = Math.trunc(orientation)
    const tangentAngle = get('TangentOrientationAngle')
    if (tangentAngle != null) this._tangentOrientationAngle = tangentAngle
  }
}
