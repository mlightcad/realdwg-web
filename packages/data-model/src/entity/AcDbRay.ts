import {
  AcGeBox3d,
  AcGeIntersectPrimitive,
  AcGeLine3d,
  AcGeMatrix3d,
  acgeOffsetPointByDirectionInXY,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGeVector3d,
  AcGeVector3dLike
} from '@mlightcad/geometry-engine'
import { AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbDxfFiler } from '../base/AcDbDxfFiler.js'
import { AcDbOsnapMode } from '../misc/AcDbOsnapMode.js'
import { AcDbCurve } from './AcDbCurve.js'
import {
  acdbCurveOnTol,
  acdbDetachSplitPiece,
  acdbSplitCurveByParams
} from './AcDbCurveParamHelpers.js'
import { AcDbEntityProperties } from './AcDbEntityProperties.js'
import {
  acdbPoint3dProperties,
  acdbVector3dProperties
} from './AcDbEntityPropertyHelpers.js'
import { acdbMovePrimaryGripPointAt } from './AcDbGripHelpers.js'
import { AcDbLine } from './AcDbLine.js'

/**
 * Represents a ray entity in AutoCAD.
 *
 * A ray is a 3D geometric object that extends infinitely in one direction from a base point.
 * Rays are commonly used for construction lines, reference lines, and temporary geometry.
 * Unlike lines, rays have no end point and extend to infinity.
 *
 * @example
 * ```typescript
 * // Create a ray from origin in the positive X direction
 * const ray = new AcDbRay();
 * ray.basePoint = new AcGePoint3d(0, 0, 0);
 * ray.unitDir = new AcGeVector3d(1, 0, 0);
 *
 * // Access ray properties
 * console.log(`Base point: ${ray.basePoint}`);
 * console.log(`Unit direction: ${ray.unitDir}`);
 * ```
 */
export class AcDbRay extends AcDbCurve {
  /** The entity type name */
  static override typeName: string = 'Ray'

  override get dxfTypeName() {
    return 'RAY'
  }

  /** The base point of the ray */
  private _basePoint: AcGePoint3d
  /** The unit direction vector of the ray */
  private _unitDir: AcGeVector3d

  /**
   * Creates a new ray entity.
   *
   * This constructor initializes a ray with default values.
   * The base point is at the origin and the unit direction is undefined.
   *
   * @example
   * ```typescript
   * const ray = new AcDbRay();
   * ray.basePoint = new AcGePoint3d(5, 10, 0);
   * ray.unitDir = new AcGeVector3d(0, 1, 0); // Positive Y direction
   * ```
   */
  constructor() {
    super()
    this._basePoint = new AcGePoint3d()
    this._unitDir = new AcGeVector3d()
  }

  /**
   * Gets the base point of this ray.
   *
   * The base point is the starting point from which the ray extends infinitely.
   *
   * @returns The base point as a 3D point
   *
   * @example
   * ```typescript
   * const basePoint = ray.basePoint;
   * console.log(`Ray base point: ${basePoint.x}, ${basePoint.y}, ${basePoint.z}`);
   * ```
   */
  get basePoint() {
    return this._basePoint
  }

  /**
   * Sets the base point of this ray.
   *
   * @param value - The new base point
   *
   * @example
   * ```typescript
   * ray.basePoint = new AcGePoint3d(10, 20, 0);
   * ```
   */
  set basePoint(value: AcGePoint3d) {
    this._basePoint.copy(value)
  }

  /**
   * Gets the unit direction vector of this ray.
   *
   * The unit direction vector defines the direction in which the ray extends
   * infinitely from the base point.
   *
   * @returns The unit direction vector
   *
   * @example
   * ```typescript
   * const unitDir = ray.unitDir;
   * console.log(`Ray direction: ${unitDir.x}, ${unitDir.y}, ${unitDir.z}`);
   * ```
   */
  get unitDir() {
    return this._unitDir
  }

  /**
   * Sets the unit direction vector of this ray.
   *
   * @param value - The new unit direction vector
   *
   * @example
   * ```typescript
   * ray.unitDir = new AcGeVector3d(0, 0, 1); // Positive Z direction
   * ```
   */
  set unitDir(value: AcGePoint3d) {
    this._unitDir.copy(value)
  }

  /**
   * Gets whether this ray is closed.
   *
   * Rays are always open entities, so this always returns false.
   *
   * @returns Always false for rays
   */
  get closed(): boolean {
    return false
  }

  /** @inheritdoc */
  get area(): number {
    return 0
  }

  /**
   * Gets the geometric extents (bounding box) of this ray.
   *
   * Since rays extend infinitely, this method returns a bounding box that
   * encompasses a finite portion of the ray for practical purposes.
   *
   * @returns The bounding box that encompasses a portion of the ray
   *
   * @example
   * ```typescript
   * const extents = ray.geometricExtents;
   * console.log(`Ray bounds: ${extents.minPoint} to ${extents.maxPoint}`);
   * ```
   */
  get geometricExtents(): AcGeBox3d {
    const extents = new AcGeBox3d()
    extents.expandByPoint(
      this._unitDir.clone().multiplyScalar(10).add(this._basePoint)
    )
    extents.expandByPoint(
      this._unitDir.clone().multiplyScalar(-10).add(this._basePoint)
    )
    return extents
  }

  /** @inheritdoc */
  override subGetIntersectCurves(): AcGeIntersectPrimitive[] {
    const end = this._basePoint.clone().add(this._unitDir)
    return [
      {
        kind: 'line',
        line: new AcGeLine3d(this._basePoint, end),
        extent: 'ray'
      }
    ]
  }

  /**
   * Returns the full property definition for this ray entity, including
   * general group and geometry group.
   *
   * The geometry group exposes editable start/end coordinates via
   * {@link AcDbPropertyAccessor} so the property palette can update
   * the ray in real-time.
   *
   * Each property is an {@link AcDbEntityRuntimeProperty}.
   */
  get properties(): AcDbEntityProperties {
    return {
      type: this.type,
      groups: [
        this.getGeneralProperties(),
        {
          groupName: 'geometry',
          properties: [
            ...acdbPoint3dProperties(
              'basePoint',
              () => this.basePoint,
              value => {
                this.basePoint = value
              }
            ),
            // AutoCAD edits the direction through a second point one unit
            // along the ray; the unit vector itself is read-only.
            ...acdbPoint3dProperties(
              'secondPoint',
              () => new AcGePoint3d(this.basePoint).add(this.unitDir),
              value => {
                const direction = new AcGeVector3d(value).sub(this.basePoint)
                if (direction.lengthSq() === 0) return
                this.unitDir = new AcGePoint3d(direction.normalize())
              }
            ),
            ...acdbVector3dProperties('unitDir', () => this.unitDir)
          ]
        }
      ]
    }
  }

  /**
   * Gets the grip points for this ray.
   *
   * Grip points are control points that can be used to modify the ray.
   * For a ray, the grip point is the base point.
   *
   * @returns Array of grip points (base point)
   *
   * @example
   * ```typescript
   * const gripPoints = ray.subGetGripPoints();
   * // gripPoints contains: [basePoint]
   * ```
   */
  subGetGripPoints() {
    const gripPoints = new Array<AcGePoint3d>()
    gripPoints.push(this.basePoint)
    return gripPoints
  }

  /** @inheritdoc */
  subMoveGripPointsAt(indices: number[], offset: AcGeVector3dLike) {
    acdbMovePrimaryGripPointAt(indices, offset, this.basePoint)
    return this
  }

  /**
   * Gets the object snap points for this trace.
   *
   * Object snap points are precise points that can be used for positioning
   * when drawing or editing. This method provides snap points based on the
   * specified snap mode.
   *
   * @param osnapMode - The object snap mode
   * @param _pickPoint - The point where the user picked
   * @param _lastPoint - The last point
   * @param snapPoints - Array to populate with snap points
   */
  subGetOsnapPoints(
    osnapMode: AcDbOsnapMode,
    pickPoint: AcGePoint3dLike,
    _lastPoint: AcGePoint3dLike,
    snapPoints: AcGePoint3dLike[]
  ) {
    const origin = this.basePoint

    if (osnapMode === AcDbOsnapMode.EndPoint) {
      snapPoints.push(origin)
      return
    }

    const direction = this.unitDir.clone()
    if (direction.lengthSq() === 0) return

    direction.normalize()
    const line = new AcGeLine3d(origin, origin.clone().add(direction))

    switch (osnapMode) {
      case AcDbOsnapMode.Nearest: {
        const projected = line.project(pickPoint)
        const offset = new AcGeVector3d(projected).sub(origin)
        const t = offset.dot(direction)
        snapPoints.push(t < 0 ? origin : projected)
        break
      }
      case AcDbOsnapMode.Perpendicular:
        snapPoints.push(line.perpPoint(pickPoint))
        break
      default:
        break
    }
  }

  /**
   * Transforms this ray by the specified matrix.
   */
  transformBy(matrix: AcGeMatrix3d) {
    this._basePoint.applyMatrix4(matrix)
    this._unitDir.transformDirection(matrix)
    return this
  }

  /**
   * This ray always draws as a single `lineStrip` primitive.
   *
   * @internal
   */
  override get directBatchPrimitive() {
    return 'lineStrip' as const
  }

  /**
   * Draws this ray using the specified renderer.
   *
   * This method renders the ray as a line segment extending from the base point
   * in the direction of the unit vector. For practical purposes, the ray is
   * drawn with a finite length.
   *
   * @param renderer - The renderer to use for drawing
   * @returns The rendered ray entity, or undefined if drawing failed
   */
  subWorldDraw(renderer: AcGiRenderer) {
    const points: AcGePoint3d[] = []
    points.push(this.basePoint)
    points.push(
      this._unitDir.clone().multiplyScalar(1000000).add(this._basePoint)
    )
    return renderer.lines(points)
  }

  /**
   * Writes DXF fields for this object.
   *
   * @param filer - DXF output writer.
   * @returns The instance (for chaining).
   */
  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbRay')
    filer.writePoint3d(10, this.basePoint)
    filer.writeVector3d(11, this.unitDir)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    filer.atSubclassData('AcDbRay')

    let bx = this.basePoint.x
    let by = this.basePoint.y
    let bz = this.basePoint.z
    let dx = this.unitDir.x
    let dy = this.unitDir.y
    let dz = this.unitDir.z

    while (!filer.atEndOfObject && !filer.atEof && !filer.atExtendedData) {
      const item = filer.readItem()
      if (!item) break
      const code = Number(item.code)
      const n = Number(item.value)
      switch (code) {
        case 10:
          bx = n
          break
        case 20:
          by = n
          break
        case 30:
          bz = n
          break
        case 11:
          dx = n
          break
        case 21:
          dy = n
          break
        case 31:
          dz = n
          break
        default:
          break
      }
    }

    this.basePoint = new AcGePoint3d(bx, by, bz)
    this.unitDir = new AcGeVector3d(dx, dy, dz)
    return this
  }

  /**
   * {@inheritDoc AcDbCurve.getOffsetCurves}
   *
   * Returns a parallel ray: the base point shifts perpendicular to the XY projection
   * of {@link unitDir} by `offsetDist`, while direction is unchanged. Fails when the
   * direction is degenerate in the XY plane.
   */
  override getOffsetCurves(offsetDist: number): AcDbCurve[] {
    const curve = this.createOffsetCurve(offsetDist)
    return curve ? [curve] : []
  }

  /**
   * {@inheritDoc AcDbCurve.getOffsetSideAtPoint}
   *
   * Uses the 2D cross product of the ray direction with the vector from
   * {@link basePoint} to `point`, normalized by the XY length of the direction.
   */
  override getOffsetSideAtPoint(point: AcGePoint3dLike): 1 | -1 {
    const bp = this.basePoint
    const dir = this.unitDir
    const len = Math.hypot(dir.x, dir.y)
    if (len <= 1e-9) return 1
    return (dir.x * (point.y - bp.y) - dir.y * (point.x - bp.x)) / len >= 0
      ? 1
      : -1
  }

  /**
   * @param offsetDist - Signed offset distance in drawing units (perpendicular in XY)
   * @returns Parallel ray, or `null` when {@link unitDir} has negligible XY component
   */
  private createOffsetCurve(offsetDist: number): AcDbRay | null {
    const offsetPoint = acgeOffsetPointByDirectionInXY(
      this.basePoint,
      this.unitDir,
      offsetDist
    )
    if (!offsetPoint) return null
    const ray = new AcDbRay()
    ray.basePoint = offsetPoint
    ray.unitDir = this.unitDir.clone()
    return ray
  }

  /** Unit direction, or `undefined` when {@link unitDir} is degenerate. */
  private paramDir(): AcGeVector3d | undefined {
    const dir = this._unitDir.clone()
    const len = dir.length()
    return len > 0 ? dir.divideScalar(len) : undefined
  }

  private onTol() {
    const b = this._basePoint
    return acdbCurveOnTol(Math.max(Math.abs(b.x), Math.abs(b.y), Math.abs(b.z)))
  }

  /**
   * Start parameter (`0`, at {@link basePoint}). The parameter of a ray is
   * the distance from its base point along {@link unitDir}.
   */
  override get startParam(): number {
    return 0
  }

  /** End parameter (`Infinity`). */
  override get endParam(): number {
    return Infinity
  }

  /**
   * Returns the signed distance from {@link basePoint} of a point on the
   * infinite line through this ray (points behind the base point give a
   * negative parameter).
   */
  override getParamAtPoint(point: AcGePoint3dLike): number | undefined {
    const dir = this.paramDir()
    if (!dir) return undefined
    const b = this._basePoint
    const t =
      (point.x - b.x) * dir.x +
      (point.y - b.y) * dir.y +
      ((point.z ?? 0) - b.z) * dir.z
    const foot = b.clone().add(dir.multiplyScalar(t))
    return foot.distanceTo(point) <= this.onTol() ? t : undefined
  }

  /** Point at the given signed distance from {@link basePoint}. */
  override getPointAtParam(param: number): AcGePoint3d | undefined {
    const dir = this.paramDir()
    if (!dir || !Number.isFinite(param)) return undefined
    return this._basePoint.clone().add(dir.multiplyScalar(param))
  }

  /** @inheritdoc */
  override getClosestPointTo(
    point: AcGePoint3dLike,
    extend = false
  ): AcGePoint3d | undefined {
    const dir = this.paramDir()
    if (!dir) return this._basePoint.clone()
    const b = this._basePoint
    let t =
      (point.x - b.x) * dir.x +
      (point.y - b.y) * dir.y +
      ((point.z ?? 0) - b.z) * dir.z
    if (!extend) t = Math.max(0, t)
    return b.clone().add(dir.multiplyScalar(t))
  }

  /** The parameter itself (signed distance from {@link basePoint}). */
  override getDistAtParam(param: number): number | undefined {
    return Number.isFinite(param) ? param : undefined
  }

  /**
   * Splits into {@link AcDbLine} pieces followed by a final {@link AcDbRay}
   * starting at the last split parameter.
   */
  override getSplitCurves(params: readonly number[]): AcDbCurve[] {
    if (!this.paramDir()) return []
    return acdbSplitCurveByParams(
      params,
      0,
      Infinity,
      false,
      this.onTol(),
      (from, to) => {
        const start = this.getPointAtParam(from)!
        if (to === Infinity) {
          const ray = acdbDetachSplitPiece(this.clone())
          ray.basePoint = start
          return ray
        }
        const line = new AcDbLine(start, this.getPointAtParam(to)!)
        line.setPropertiesFrom(this)
        return line
      }
    )
  }
}
