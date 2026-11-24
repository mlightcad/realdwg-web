import {
  AcGeMatrix3d,
  AcGePoint3d,
  AcGeVector3d
} from '@mlightcad/geometry-engine'

import type { AcDbCurve } from '../../entity/AcDbCurve.js'
import { AcDbAssocArrayCommonParameters } from './AcDbAssocArrayCommonParameters.js'
import { AcDbAssocArrayItemLocator } from './AcDbAssocArrayItemLocator.js'

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
 * @remarks Do not subclass — AutoCAD does not support further derivation.
 */
export class AcDbAssocArrayPathParameters extends AcDbAssocArrayCommonParameters {
  private _method: AcDbAssocArrayPathMethod = AcDbAssocArrayPathMethod.kMeasure
  private _itemSpacing = 1
  private _alignItems = true
  private _maintainZ = true
  private _path: AcDbAssocArrayPathEdgeRef | undefined
  /**
   * Runtime path curve used when evaluating transforms. Not persisted; the
   * action body resolves it from {@link path}.entityId before evaluate.
   */
  private _pathCurve: AcDbCurve | undefined
  private _basePoint = new AcGePoint3d(0, 0, 0)

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

  get path(): AcDbAssocArrayPathEdgeRef | undefined {
    return this._path
  }

  setPath(edge: AcDbAssocArrayPathEdgeRef): void {
    this._path = { entityId: edge.entityId }
  }

  /**
   * Binds the live curve used by {@link getItemTransform}.
   */
  setPathCurve(curve: AcDbCurve | undefined): void {
    this._pathCurve = curve
  }

  get basePoint(): AcGePoint3d {
    return this._basePoint
  }
  set basePoint(value: AcGePoint3d) {
    this._basePoint = value.clone()
  }

  get parameterType(): 'path' {
    return 'path'
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

  private pathLength(): number {
    const curve = this._pathCurve
    if (!curve) return 0
    const end = curve.getDistAtParam(curve.endParam)
    const start = curve.getDistAtParam(curve.startParam)
    if (end == null || start == null) return 0
    return Math.abs(end - start)
  }

  private pointAtDistance(dist: number): AcGePoint3d | undefined {
    const curve = this._pathCurve
    if (!curve) return undefined
    if (typeof curve.getPointAtDist === 'function') {
      return curve.getPointAtDist(dist)
    }
    const param = curve.getParamAtDist?.(dist)
    if (param == null) return undefined
    return curve.getPointAtParam(param)
  }

  private tangentAtDistance(dist: number): AcGeVector3d {
    const curve = this._pathCurve
    if (curve && typeof curve.getFirstDerivAtDist === 'function') {
      const d = curve.getFirstDerivAtDist(dist)
      if (d && d.lengthSq() > 1e-20) return d.normalize()
    }
    // Finite difference fallback.
    const p0 = this.pointAtDistance(Math.max(0, dist - 1e-3))
    const p1 = this.pointAtDistance(dist + 1e-3)
    if (p0 && p1) {
      const v = new AcGeVector3d(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z)
      if (v.lengthSq() > 1e-20) return v.normalize()
    }
    return new AcGeVector3d(1, 0, 0)
  }

  getItemTransform(locator: AcDbAssocArrayItemLocator): AcGeMatrix3d {
    const length = this.pathLength()
    let dist = 0
    if (this._method === AcDbAssocArrayPathMethod.kDivide) {
      const denom = Math.max(1, this.itemCount - (this._pathCurve?.closed ? 0 : 1))
      dist = this.itemCount <= 1 ? 0 : (locator.itemIndex / denom) * length
    } else {
      dist = locator.itemIndex * this._itemSpacing
    }

    const point = this.pointAtDistance(dist) ?? this._basePoint.clone()
    // Offset along local normal for rows (approximate with Z-up × tangent).
    const tangent = this.tangentAtDistance(dist)
    const up = new AcGeVector3d(0, 0, 1)
    let side = up.clone().cross(tangent)
    if (side.lengthSq() < 1e-20) {
      side = new AcGeVector3d(0, 1, 0).cross(tangent)
    }
    if (side.lengthSq() > 1e-20) side.normalize()
    else side.set(0, 1, 0)

    const x =
      point.x +
      side.x * locator.rowIndex * this.rowSpacing -
      this._basePoint.x
    const y =
      point.y +
      side.y * locator.rowIndex * this.rowSpacing -
      this._basePoint.y
    const z =
      (this._maintainZ ? point.z : 0) +
      locator.levelIndex * this.levelSpacing +
      locator.rowIndex * this.rowElevation -
      this._basePoint.z

    const m = AcGeMatrix3d.makeTranslation(x, y, z)
    if (this._alignItems) {
      const angle = Math.atan2(tangent.y, tangent.x)
      m.multiply(new AcGeMatrix3d().makeRotationZ(angle))
    }
    return m
  }

  toJSON(): Record<string, unknown> {
    return {
      type: this.parameterType,
      ...this.commonToJSON(),
      method: this._method,
      itemSpacing: this._itemSpacing,
      alignItems: this._alignItems,
      maintainZ: this._maintainZ,
      pathEntityId: this._path?.entityId ?? '',
      basePoint: {
        x: this._basePoint.x,
        y: this._basePoint.y,
        z: this._basePoint.z
      }
    }
  }

  fromJSON(data: Record<string, unknown>): void {
    this.commonFromJSON(data)
    if (data.method != null) this._method = Number(data.method)
    if (data.itemSpacing != null) this._itemSpacing = Number(data.itemSpacing)
    if (data.alignItems != null) this.alignItems = !!data.alignItems
    if (data.maintainZ != null) this.maintainZ = !!data.maintainZ
    const pathId = data.pathEntityId
    if (typeof pathId === 'string' && pathId) {
      this._path = { entityId: pathId }
    }
    const b = data.basePoint as
      | { x?: number; y?: number; z?: number }
      | undefined
    if (b) {
      this._basePoint = new AcGePoint3d(b.x ?? 0, b.y ?? 0, b.z ?? 0)
    }
  }
}
