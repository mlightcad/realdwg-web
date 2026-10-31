import {
  AcGeArea2d,
  AcGeBox3d,
  AcGeIntersectPrimitive,
  AcGeMatrix3d,
  AcGePoint2d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGePolyline2d,
  AcGeSpline3d,
  AcGeVector3d,
  AcGeVector3dLike
} from '@mlightcad/geometry-engine'
import { AcGiEntity, AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbDxfFiler } from '../base/AcDbDxfFiler.js'
import {
  AcDbBlockTableRecord,
  AcDbDimStyleTableRecord
} from '../database/index.js'
import {
  ACDB_DSTYLE_XDATA_APP,
  acdbResolveEffectiveDimStyle
} from '../misc/AcDbDimStyleOverrides.js'
import { acdbDrawTessellateOptions } from '../misc/AcDbDrawTessellate.js'
import { AcDbOsnapMode } from '../misc/AcDbOsnapMode.js'
import { AcDbRenderingCache } from '../misc/AcDbRenderingCache.js'
import { AcDbCurve } from './AcDbCurve.js'
import { acdbMovePointArrayGripAt } from './AcDbGripHelpers.js'
import { acdbIntersectPrimitivesFromPointPath } from './AcDbIntersectHelpers.js'
import { AcDbMText } from './AcDbMText.js'
import {
  acdbCollectLineSegmentOsnapPoints,
  acdbPickNearestOsnapPoint
} from './AcDbOsnapHelpers.js'
import { acdbOffsetVertexPathAsPolyline, AcDbPolyline } from './AcDbPolyline.js'
import {
  acdbCollectMTextOrientedCorners,
  acdbEstimatePlainTextWidth,
  acdbResolveMTextLayoutMetrics,
  acdbScorePointAgainstMTextLayout,
  acdbStripMTextControlCodes
} from './AcDbTextExtentsHelpers.js'
import {
  acdbEnsureDimArrowBlocks,
  acdbResolveArrowBlockName,
  CLOSED_FILLED_ARROW_BLOCK
} from './dimension/AcDbDimBlockBuilder.js'
import { acdbDimFeatureScale } from './dimension/AcDbDimFeatureScale.js'

/**
 * Defines the annotation type for leader entities.
 */
export enum AcDbLeaderAnnotationType {
  /** Multiline text annotation */
  MText = 0,
  /** Feature control frame annotation */
  Fcf = 1,
  /** Block reference annotation */
  BlockReference = 2,
  /** No annotation */
  NoAnnotation = 3
}

/**
 * Represents a leader entity in AutoCAD.
 *
 * A leader is a dimension-like entity that consists of a line or spline with an arrowhead
 * pointing to a specific object or location, and an annotation (text, block, or feature
 * control frame) at the other end. Leaders are controlled by dimension variable settings
 * and dimension styles.
 *
 * @example
 * ```typescript
 * // Create a leader entity
 * const leader = new AcDbLeader();
 * leader.appendVertex(new AcGePoint3d(0, 0, 0));
 * leader.appendVertex(new AcGePoint3d(5, 5, 0));
 * leader.appendVertex(new AcGePoint3d(10, 5, 0));
 * leader.hasArrowHead = true;
 * leader.hasHookLine = true;
 * leader.annoType = AcDbLeaderAnnotationType.MText;
 *
 * // Access leader properties
 * console.log(`Number of vertices: ${leader.numVertices}`);
 * console.log(`Has arrow head: ${leader.hasArrowHead}`);
 * console.log(`Has hook line: ${leader.hasHookLine}`);
 * ```
 */
export class AcDbLeader extends AcDbCurve {
  /** The entity type name */
  static override typeName: string = 'Leader'

  override get dxfTypeName() {
    return 'LEADER'
  }

  /** Whether this leader is spline-fit */
  private _isSplined: boolean
  /** The spline geometry if this leader is spline-fit */
  private _splineGeo?: AcGeSpline3d
  /** Whether this leader has been updated */
  private _updated: boolean
  /** Whether this leader has an arrowhead */
  private _hasArrowHead: boolean
  /** The vertices of the leader line */
  private _vertices: AcGePoint3d[]
  /** The dimension style applied to this leader */
  private _dimensionStyle: string
  /** Memoized effective style (table record plus `ACAD`/`DSTYLE` overrides). */
  private _dimStyle?: AcDbDimStyleTableRecord
  /** Name the memoized {@link _dimStyle} was resolved for. */
  private _dimStyleName?: string
  /** Whether this leader has a hook line */
  private _hasHookLine: boolean
  /** Whether the hook line has the same direction as the horizontal vector */
  private _isHookLineSameDirection: boolean
  /** The annotation type for this leader */
  private _annoType: AcDbLeaderAnnotationType
  private _textHeight: number
  private _textWidth: number
  private _byBlockColor?: number
  private _associatedAnnotation: string
  private _normal: AcGeVector3d
  private _horizontalDirection: AcGeVector3d
  private _offsetFromBlock?: AcGeVector3d
  private _offsetFromAnnotation?: AcGeVector3d

  /**
   * Creates a new leader entity.
   *
   * This constructor initializes a leader with default values.
   * The leader is not spline-fit, has no arrowhead, no hook line,
   * and no annotation type.
   *
   * @example
   * ```typescript
   * const leader = new AcDbLeader();
   * leader.appendVertex(new AcGePoint3d(0, 0, 0));
   * leader.appendVertex(new AcGePoint3d(5, 5, 0));
   * ```
   */
  constructor() {
    super()
    this._isSplined = false
    this._updated = false
    this._hasArrowHead = false
    this._vertices = []
    this._dimensionStyle = ''
    this._hasHookLine = false
    this._isHookLineSameDirection = false
    this._annoType = AcDbLeaderAnnotationType.NoAnnotation
    this._textHeight = 0
    this._textWidth = 0
    this._associatedAnnotation = ''
    this._normal = new AcGeVector3d(0, 0, 1)
    this._horizontalDirection = new AcGeVector3d(1, 0, 0)
  }

  /**
   * Gets whether this leader is spline-fit.
   *
   * @returns True if the leader is spline-fit, false otherwise
   *
   * @example
   * ```typescript
   * const isSplined = leader.isSplined;
   * console.log(`Leader is spline-fit: ${isSplined}`);
   * ```
   */
  get isSplined() {
    return this._isSplined
  }

  /**
   * Sets whether this leader is spline-fit.
   *
   * @param value - True to make the leader spline-fit, false otherwise
   *
   * @example
   * ```typescript
   * leader.isSplined = true;
   * ```
   */
  set isSplined(value: boolean) {
    this._isSplined = value
  }

  /**
   * Gets whether this leader has an arrowhead.
   *
   * @returns True if the leader has an arrowhead, false otherwise
   *
   * @example
   * ```typescript
   * const hasArrowHead = leader.hasArrowHead;
   * console.log(`Leader has arrowhead: ${hasArrowHead}`);
   * ```
   */
  get hasArrowHead() {
    return this._hasArrowHead
  }

  /**
   * Sets whether this leader has an arrowhead.
   *
   * @param value - True to enable arrowhead, false to disable
   *
   * @example
   * ```typescript
   * leader.hasArrowHead = true;
   * ```
   */
  set hasArrowHead(value: boolean) {
    this._hasArrowHead = value
  }

  /**
   * Gets whether this leader has a hook line.
   *
   * The "hookline" is the small horizontal line at the end of the leader line
   * just before the annotation.
   *
   * @returns True if the leader has a hook line, false otherwise
   *
   * @example
   * ```typescript
   * const hasHookLine = leader.hasHookLine;
   * console.log(`Leader has hook line: ${hasHookLine}`);
   * ```
   */
  get hasHookLine() {
    return this._hasHookLine
  }

  /**
   * Sets whether this leader has a hook line.
   *
   * @param value - True to enable hook line, false to disable
   *
   * @example
   * ```typescript
   * leader.hasHookLine = true;
   * ```
   */
  set hasHookLine(value: boolean) {
    this._hasHookLine = value
  }

  get isHookLineSameDirection() {
    return this._isHookLineSameDirection
  }
  set isHookLineSameDirection(value: boolean) {
    this._isHookLineSameDirection = value
  }

  /**
   * Gets the number of vertices in the leader's vertex list.
   *
   * @returns The number of vertices
   *
   * @example
   * ```typescript
   * const numVertices = leader.numVertices;
   * console.log(`Number of vertices: ${numVertices}`);
   * ```
   */
  get numVertices(): number {
    return this._vertices.length
  }

  get vertices() {
    return this._vertices.map(point => point.clone())
  }

  /**
   * Gets the dimension style applied to this leader.
   *
   * @returns The dimension style name
   *
   * @example
   * ```typescript
   * const dimensionStyle = leader.dimensionStyle;
   * console.log(`Dimension style: ${dimensionStyle}`);
   * ```
   */
  get dimensionStyle() {
    return this._dimensionStyle
  }

  /**
   * Sets the dimension style applied to this leader.
   *
   * @param value - The new dimension style name
   *
   * @example
   * ```typescript
   * leader.dimensionStyle = "Standard";
   * ```
   */
  set dimensionStyle(value: string) {
    this._dimensionStyle = value
    this._dimStyle = undefined
    this._dimStyleName = undefined
  }

  /**
   * Gets the leader's annotation type.
   *
   * @returns The annotation type
   *
   * @example
   * ```typescript
   * const annoType = leader.annoType;
   * console.log(`Annotation type: ${annoType}`);
   * ```
   */
  get annoType() {
    return this._annoType
  }

  /**
   * Sets the leader's annotation type.
   *
   * @param value - The new annotation type
   *
   * @example
   * ```typescript
   * leader.annoType = AcDbLeaderAnnotationType.MText;
   * ```
   */
  set annoType(value: AcDbLeaderAnnotationType) {
    this._annoType = value
  }

  get textHeight() {
    return this._textHeight
  }
  set textHeight(value: number) {
    this._textHeight = value
  }

  get textWidth() {
    return this._textWidth
  }
  set textWidth(value: number) {
    this._textWidth = value
  }

  get byBlockColor() {
    return this._byBlockColor
  }
  set byBlockColor(value: number | undefined) {
    this._byBlockColor = value
  }

  get associatedAnnotation() {
    return this._associatedAnnotation
  }
  set associatedAnnotation(value: string) {
    this._associatedAnnotation = value
  }

  get normal() {
    return this._normal
  }
  set normal(value: AcGeVector3dLike) {
    this._normal.copy(value)
  }

  get horizontalDirection() {
    return this._horizontalDirection
  }
  set horizontalDirection(value: AcGeVector3dLike) {
    this._horizontalDirection.copy(value)
  }

  get offsetFromBlock() {
    return this._offsetFromBlock?.clone()
  }
  set offsetFromBlock(value: AcGeVector3dLike | undefined) {
    this._offsetFromBlock = value ? new AcGeVector3d(value) : undefined
  }

  get offsetFromAnnotation() {
    return this._offsetFromAnnotation?.clone()
  }
  set offsetFromAnnotation(value: AcGeVector3dLike | undefined) {
    this._offsetFromAnnotation = value ? new AcGeVector3d(value) : undefined
  }

  /**
   * Appends vertex to the end of the vertex list for this leader. If vertex is not in the plane of the
   * leader, then it will be projected parallel the leader's normal onto the leader's plane and the
   * projection will be appended to the leader's vertex list. If the new vertex is too close to the one
   * next to it (that is, within 1.e-10 for X, Y, and Z), the new vertex will not be appended.
   * @param point Input point (in WCS coordinates) to add to the vertex list
   */
  appendVertex(point: AcGePoint3dLike) {
    this._vertices.push(new AcGePoint3d().copy(point))
    this._updated = true
  }

  /**
   * Reset the vertex at index to the point point projected (along the plane normal) onto the plane
   * containing the leader. It doesn't reset the vertex if that would cause one of the segments to
   * become zero length (within 1e-10).
   * @param index Input index number (0 based) of the vertex to change
   * @param point Input new point value (in WCS) to use
   */
  setVertexAt(index: number, point: AcGePoint3dLike) {
    if (index < 0 || index >= this._vertices.length) {
      throw new Error('The vertex index is out of range!')
    }
    // TODO: Project the point onto the plane containing the leader
    this._vertices[index].copy(point)
    this._updated = true
    return this
  }

  /**
   * Get the point that is the vertex at the location index (0 based) in this leader's vertex array.
   * @param index Input index number (0 based) of the vertex desired
   */
  vertexAt(index: number) {
    if (index < 0 || index >= this._vertices.length) {
      throw new Error('The vertex index is out of range!')
    }
    return this._vertices[index].clone()
  }

  /**
   * Gets the grip points for this leader.
   *
   * @returns Array of grip points at each leader vertex.
   */
  subGetGripPoints() {
    return this._vertices.map(vertex => vertex.clone())
  }

  /** @inheritdoc */
  subMoveGripPointsAt(indices: number[], offset: AcGeVector3dLike) {
    acdbMovePointArrayGripAt(indices, offset, this._vertices)
    return this
  }

  /**
   * Gets the object snap points for this leader.
   */
  subGetOsnapPoints(
    osnapMode: AcDbOsnapMode,
    pickPoint: AcGePoint3dLike,
    _lastPoint: AcGePoint3dLike,
    snapPoints: AcGePoint3dLike[]
  ) {
    if (this.numVertices === 0) return

    if (this.isSplined && this.splineGeo) {
      switch (osnapMode) {
        case AcDbOsnapMode.EndPoint:
          snapPoints.push(this._vertices[0])
          snapPoints.push(this._vertices[this.numVertices - 1])
          break
        case AcDbOsnapMode.Nearest:
          snapPoints.push(this.splineGeo.nearestPoint(pickPoint))
          break
        default:
          break
      }
      return
    }

    const vertices = this._vertices
    switch (osnapMode) {
      case AcDbOsnapMode.EndPoint:
        snapPoints.push(...vertices)
        break
      case AcDbOsnapMode.MidPoint:
      case AcDbOsnapMode.Nearest:
      case AcDbOsnapMode.Perpendicular: {
        const candidates: AcGePoint3d[] = []
        for (let index = 0; index < vertices.length - 1; index++) {
          const segmentSnaps: AcGePoint3d[] = []
          acdbCollectLineSegmentOsnapPoints(
            vertices[index],
            vertices[index + 1],
            osnapMode,
            pickPoint,
            segmentSnaps
          )
          candidates.push(...segmentSnaps)
        }
        if (osnapMode === AcDbOsnapMode.MidPoint) {
          snapPoints.push(...candidates)
        } else {
          const nearest = acdbPickNearestOsnapPoint(pickPoint, candidates)
          if (nearest) snapPoints.push(nearest)
        }
        break
      }
      default:
        break
    }
  }

  /**
   * @inheritdoc
   */
  get geometricExtents() {
    if (this._isSplined && this.splineGeo) {
      return this.splineGeo.calculateBoundingBox()
    }
    const box = new AcGeBox3d()
    return box.setFromPoints(this.collectDrawPoints())
  }

  /** @inheritdoc */
  override subGetIntersectCurves(): AcGeIntersectPrimitive[] {
    if (this.isSplined && this.splineGeo) {
      return [
        {
          kind: 'spline',
          spline: this.splineGeo.clone(),
          extendable: false
        }
      ]
    }
    return acdbIntersectPrimitivesFromPointPath(this._vertices, false)
  }

  /**
   * @inheritdoc
   */
  get closed(): boolean {
    return false
  }
  set closed(_value: boolean) {
    // TODO: Not sure whether the leader really support setting value of property 'closed'
  }

  /** @inheritdoc */
  get area(): number {
    return 0
  }

  /**
   * Transforms this leader by the specified matrix.
   */
  transformBy(matrix: AcGeMatrix3d) {
    this._vertices.forEach(point => point.applyMatrix4(matrix))
    this.transformVector(this._normal, matrix)
    this.transformVector(this._horizontalDirection, matrix)
    if (this._offsetFromBlock)
      this.transformVector(this._offsetFromBlock, matrix)
    if (this._offsetFromAnnotation) {
      this.transformVector(this._offsetFromAnnotation, matrix)
    }
    if (this._splineGeo) {
      this._splineGeo.transform(matrix)
      this._updated = false
    } else {
      this._updated = true
    }
    return this
  }

  /**
   * This leader draws as a single `lineStrip` primitive unless an arrowhead
   * may add a second primitive.
   *
   * The check deliberately stays cheap (no dimension-style lookup): a leader
   * that advertises an arrowhead (DXF 71) simply falls back to the legacy draw
   * path so renderers never see an unexpected multi-primitive batch payload.
   *
   * @internal
   */
  override get directBatchPrimitive() {
    const mayDrawArrowHead = this._hasArrowHead && this._vertices.length >= 2
    return mayDrawArrowHead ? null : ('lineStrip' as const)
  }

  /**
   * @inheritdoc
   */
  subWorldDraw(renderer: AcGiRenderer) {
    const entities: AcGiEntity[] = []
    const points = this.collectDrawPoints(renderer)
    if (points.length > 0) {
      entities.push(renderer.lines(points))
    }
    const arrowHead = this.drawArrowHead(renderer, points)
    if (arrowHead) entities.push(arrowHead)
    if (entities.length === 0) return renderer.lines([])
    return entities.length === 1 ? entities[0] : renderer.group(entities)
  }

  /**
   * Whether an arrowhead primitive is emitted at the leader start.
   *
   * DXF group code 71 (`hasArrowHead`) is authoritative: when it is 0 AutoCAD
   * draws no arrowhead at all. The arrow geometry itself comes from the
   * dimension style (DIMLDRBLK arrow block scaled by DIMASZ).
   */
  private get hasRenderableArrowHead() {
    if (!this._hasArrowHead || this.numVertices < 2) return false
    if (this.resolveArrowHeadBlockName() === '') return false
    return this.resolveArrowHeadSize() > 0
  }

  /**
   * Draws the arrowhead (DXF group code 71) at the first leader vertex.
   *
   * The tip sits on the first vertex and the tail points toward the second
   * vertex. Arrow blocks are authored with the tip at the block origin and the
   * tail along -X, so the insert angle maps block +X onto the outward leader
   * direction. When the referenced block is missing, the built-in AutoCAD
   * arrow blocks are generated on demand; only the default closed filled arrow
   * can still be reproduced procedurally if that lookup also fails.
   *
   * @param renderer - Renderer used to create the primitive.
   * @param points - Leader draw points whose first entry is the arrow tip.
   * @returns The arrowhead primitive, or `undefined` when none is drawn.
   */
  private drawArrowHead(
    renderer: AcGiRenderer,
    points: AcGePoint3d[]
  ): AcGiEntity | undefined {
    if (!this.hasRenderableArrowHead || points.length < 2) return undefined

    const tip = points[0]
    const next = points.find(point => !point.equals(tip))
    if (!next) return undefined

    const intoBody = new AcGeVector3d().subVectors(next, tip)
    if (intoBody.lengthSq() === 0) return undefined
    intoBody.normalize()

    const size = this.resolveArrowHeadSize()
    const angle = Math.atan2(-intoBody.y, -intoBody.x)
    const blockName = this.resolveArrowHeadBlockName()
    const blockTableRecord = this.resolveArrowHeadBlock(blockName)

    if (blockTableRecord) {
      const basePoint = blockTableRecord.origin ?? AcGePoint3d.ORIGIN
      const mBase = new AcGeMatrix3d().makeTranslation(
        -basePoint.x,
        -basePoint.y,
        -basePoint.z
      )
      const mScale = new AcGeMatrix3d().makeScale(size, size, size)
      const mRot = new AcGeMatrix3d().makeRotationZ(angle)
      const mInsert = new AcGeMatrix3d().makeTranslation(tip.x, tip.y, tip.z)
      const matrix = new AcGeMatrix3d()
        .multiplyMatrices(mInsert, mRot)
        .multiply(mScale)
        .multiply(mBase)
      return AcDbRenderingCache.instance.draw(
        renderer,
        blockTableRecord,
        this.resolvedColor,
        [],
        true,
        matrix,
        new AcGeVector3d(this.normal)
      )
    }

    // Only the default closed-filled arrow can be reproduced procedurally.
    if (blockName !== CLOSED_FILLED_ARROW_BLOCK) return undefined

    const baseCenter = tip.clone().addScaledVector(intoBody, size)
    const halfWidth = size / 6
    const perpendicular = new AcGeVector3d(-intoBody.y, intoBody.x, intoBody.z)
    const left = baseCenter.clone().addScaledVector(perpendicular, halfWidth)
    const right = baseCenter.clone().addScaledVector(perpendicular, -halfWidth)

    const area = new AcGeArea2d()
    area.add(new AcGePolyline2d([tip, left, right, tip], true))
    const traits = renderer.subEntityTraits
    const originalFillType = traits.fillType
    traits.fillType = {
      solidFill: true,
      patternAngle: 0,
      definitionLines: []
    }
    const entity = renderer.area(area)
    traits.fillType = originalFillType
    return entity
  }

  /**
   * Resolves the arrowhead size in drawing units.
   *
   * AutoCAD documents DIMASZ as "the size of dimension line **and leader line**
   * arrowheads", so leaders always use DIMASZ (not the DIMTSZ oblique-tick size,
   * which only replaces terminators on linear/radius/diameter dimensions).
   * DIMASZ is scaled by the effective dimension/annotation scale.
   */
  private resolveArrowHeadSize(): number {
    const dimStyle = this.resolveDimensionStyle()
    if (!dimStyle) {
      return AcDbDimStyleTableRecord.DEFAULT_DIM_VALUES.dimasz
    }
    const scale = acdbDimFeatureScale(dimStyle, this)
    const size = (dimStyle.dimasz ?? 0) * (scale > 0 ? scale : 1)
    return size > 0 ? size : 0
  }

  /**
   * Resolves the leader arrowhead block name from DIMLDRBLK.
   *
   * An empty DIMLDRBLK means the default closed filled arrow; `_NONE` resolves
   * to an empty name so no arrowhead is drawn.
   */
  private resolveArrowHeadBlockName(): string {
    const dimStyle = this.resolveDimensionStyle()
    return acdbResolveArrowBlockName(dimStyle?.dimldrblk)
  }

  /**
   * Looks up the arrowhead block table record by name.
   */
  private resolveArrowHeadBlock(name: string) {
    if (!name) return undefined
    const database = this.tryGetDatabase()
    if (!database) return undefined
    const existing = database.tables.blockTable.getAt(name)
    if (existing) return existing
    // Arrowhead blocks such as `_DOT` / `_ARCHTICK` are AutoCAD built-ins and
    // are often missing from the drawing's block table; dimension entities
    // generate them on demand, so leaders must do the same before giving up.
    const dimStyle = this.resolveDimensionStyle()
    if (dimStyle) acdbEnsureDimArrowBlocks(database, dimStyle)
    return database.tables.blockTable.getAt(name)
  }

  /**
   * Builds the leader polyline including the optional horizontal hook line
   * segment that spans the associated annotation width.
   */
  private collectDrawPoints(renderer?: AcGiRenderer): AcGePoint3d[] {
    if (this.isSplined && this.splineGeo) {
      return this.splineGeo.tessellate(acdbDrawTessellateOptions(renderer))
    }

    const points = this._vertices.map(vertex => vertex.clone())
    // Splined leaders do not render a horizontal hook line segment.
    if (points.length > 0 && !this._isSplined) {
      const lastVertex = points[points.length - 1]
      if (this.shouldDrawHookLine(lastVertex)) {
        const hookEnd = this.computeHookLineEndPoint(lastVertex)
        if (hookEnd) {
          points.push(hookEnd)
        }
      }
    }
    return points
  }

  /**
   * Whether a hook line (the landing segment at the annotation end) should be
   * rendered for the landing vertex.
   *
   * DXF group code 75 (and its DWG equivalent `hookline_on`) is authoritative:
   * when it is 0 AutoCAD does not draw any landing segment, even if the leader
   * happens to sit next to a text entity. Only a leader that advertises a hook
   * line is extended here.
   */
  private shouldDrawHookLine(lastVertex: AcGePoint3d): boolean {
    if (!this._hasHookLine) {
      return false
    }
    return this.resolveHookLineLength(lastVertex) > 0
  }

  /**
   * Computes the hook-line endpoint from the last leader vertex.
   */
  private computeHookLineEndPoint(lastVertex: AcGePoint3d): AcGePoint3d | null {
    const hookLength = this.resolveHookLineLength(lastVertex)
    if (hookLength <= 0) {
      return null
    }

    const direction = this.resolveHookAxis()
    return lastVertex.clone().addScaledVector(direction, hookLength)
  }

  /**
   * Resolves the hook-line (landing segment) length and side.
   *
   * The landing segment spans the annotation box (DXF 41 / associated MTEXT
   * width) plus the dimension-style gap. A negative DXF 41 means the author
   * flipped the landing to the opposite side, which matches AutoCAD. When no
   * annotation width can be resolved there is nothing to land under, so the
   * hook line is skipped instead of drawing a gap-sized stub past the author's
   * own geometry.
   *
   * @returns The absolute landing length.
   */
  private resolveHookLineLength(lastVertex: AcGePoint3d): number {
    const dimStyle = this.resolveDimensionStyle()
    const gap =
      (dimStyle?.dimgap ?? AcDbDimStyleTableRecord.DEFAULT_DIM_VALUES.dimgap) *
      (dimStyle ? acdbDimFeatureScale(dimStyle, this) : 1)
    const declaredWidth = Math.abs(this._textWidth)
    let length = declaredWidth > 0 ? declaredWidth + gap : 0

    const mtext = this.resolveAssociatedMText()
    if (mtext) {
      const span = this.resolveHookSpanFromMText(mtext, lastVertex)
      if (span > length) {
        length = span
      } else {
        const width = this.resolveAnnotationWidth(mtext)
        if (width > length) length = width
      }
    }

    return length
  }

  /**
   * Returns the signed axis along which the hook line extends.
   *
   * DXF 74 gives the hook-line direction relative to the horizontal vector and
   * a negative DXF 41 (annotation box width) flips it once more.
   */
  private resolveHookAxis(): AcGeVector3d {
    const direction = this._horizontalDirection.clone()
    if (direction.lengthSq() === 0) {
      direction.set(1, 0, 0)
    } else {
      direction.normalize()
    }
    // Same direction as the horizontal vector → +1; a negative DXF 41 flips it.
    let sign = this._isHookLineSameDirection ? 1 : -1
    if (this._textWidth < 0) sign = -sign
    direction.multiplyScalar(sign)
    return direction
  }

  /**
   * Computes hook span from the landing vertex to the far edge of MTEXT bounds.
   *
   * The span is measured along the resolved landing axis, which already folds
   * in the DXF 74 direction and a negative DXF 41 flip.
   */
  private resolveHookSpanFromMText(
    mtext: AcDbMText,
    lastVertex: AcGePoint3d
  ): number {
    const axis = this.resolveHookAxis()
    const layout = this.resolveMTextLayoutMetrics(mtext)
    let maxSpan = 0

    for (const corner of acdbCollectMTextOrientedCorners(layout)) {
      const span =
        (corner.x - lastVertex.x) * axis.x +
        (corner.y - lastVertex.y) * axis.y +
        (corner.z - lastVertex.z) * axis.z
      if (span > maxSpan) {
        maxSpan = span
      }
    }

    return maxSpan
  }

  /**
   * Estimates annotation width from MTEXT content when extents are unavailable.
   */
  private resolveAnnotationWidth(mtext: AcDbMText): number {
    if (mtext.extentsWidth > 0) {
      return mtext.extentsWidth
    }

    const lines = acdbStripMTextControlCodes(mtext.contents).split('\n')
    return Math.max(
      ...lines.map(line =>
        acdbEstimatePlainTextWidth(line.trim(), mtext.height)
      ),
      0
    )
  }

  private resolveMTextLayoutMetrics(mtext: AcDbMText) {
    return acdbResolveMTextLayoutMetrics({
      contents: mtext.contents,
      height: mtext.height,
      width: mtext.width,
      extentsWidth: mtext.extentsWidth,
      lineSpacingFactor: mtext.lineSpacingFactor,
      lineSpacingStyle: mtext.lineSpacingStyle,
      attachmentPoint: mtext.attachmentPoint,
      rotation: mtext.rotation,
      direction: mtext.direction,
      location: mtext.location
    })
  }

  /**
   * Scores how closely one MTEXT annotation matches a leader landing vertex.
   */
  private scoreMTextAssociation(
    mtext: AcDbMText,
    lastVertex: AcGePoint3d
  ): number | null {
    const layout = this.resolveMTextLayoutMetrics(mtext)
    const padX = Math.max(mtext.height * 2, 1)
    const padYAbove = Math.max(mtext.height, 1)
    const padYBelow = Math.max(layout.height, mtext.height * 4, 10)

    return acdbScorePointAgainstMTextLayout(lastVertex, layout, {
      padX,
      padYAbove,
      padYBelow
    })
  }

  /**
   * Resolves the dimension style referenced by this leader.
   *
   * Entity-level `ACAD`/`DSTYLE` XData overrides are layered on top of the
   * referenced table record, so per-leader changes to DIMASZ / DIMGAP /
   * DIMLDRBLK take effect the way AutoCAD draws them.
   *
   * The resolved record is memoized: a leader with overrides needs the
   * detached style copy, and `subWorldDraw` asks for the style several times
   * per frame (arrow size, arrow block name, hook gap).
   */
  private resolveDimensionStyle(): AcDbDimStyleTableRecord | undefined {
    const styleName = this._dimensionStyle?.trim()
    const database = this.tryGetDatabase()
    if (!styleName || !database) {
      return undefined
    }
    if (this._dimStyle && this._dimStyleName === styleName) {
      return this._dimStyle
    }
    const base = database.tables.dimStyleTable.getAt(styleName)
    const resolved = acdbResolveEffectiveDimStyle(this, base, database)
    this._dimStyle = resolved
    this._dimStyleName = styleName
    return resolved
  }

  /**
   * Drops the memoized effective style when `ACAD` XData changes.
   */
  protected override onXDataChanged(appId: string): void {
    if (appId === ACDB_DSTYLE_XDATA_APP) {
      this._dimStyle = undefined
      this._dimStyleName = undefined
    }
  }

  /**
   * Drops the memoized effective style when the leader moves to another
   * database, because the referenced style record belongs to the previous one.
   */
  protected override onDatabaseChanged(): void {
    this._dimStyle = undefined
    this._dimStyleName = undefined
  }

  /**
   * Resolves the MTEXT annotation associated with this leader.
   *
   * An explicit `associatedAnnotation` hard pointer (DXF 340) always wins.
   * The spatial search is only a fallback for leaders that were created with an
   * MTEXT annotation (DXF 73 = 0); a standalone leader (DXF 73 = 3) has no
   * annotation, so borrowing an unrelated nearby MTEXT would corrupt its
   * landing geometry.
   */
  private resolveAssociatedMText(): AcDbMText | undefined {
    const database = this.tryGetDatabase()
    if (!database) {
      return undefined
    }

    if (this._associatedAnnotation) {
      const object = database.getObjectById(this._associatedAnnotation)
      return object instanceof AcDbMText ? object : undefined
    }

    if (
      this._annoType !== AcDbLeaderAnnotationType.MText ||
      this._vertices.length === 0
    ) {
      return undefined
    }

    const ownerId = this.getAttrWithoutException('ownerId')
    if (!ownerId) {
      return undefined
    }

    const owner = database.getObjectById(ownerId)
    if (!(owner instanceof AcDbBlockTableRecord)) {
      return undefined
    }

    const lastVertex = this._vertices[this._vertices.length - 1]
    let bestMatch: AcDbMText | undefined
    let bestScore = Number.POSITIVE_INFINITY

    for (const entity of owner.newIterator()) {
      if (!(entity instanceof AcDbMText)) {
        continue
      }

      const score = this.scoreMTextAssociation(entity, lastVertex)
      if (score == null || score >= bestScore) {
        continue
      }

      bestScore = score
      bestMatch = entity
    }

    return bestMatch
  }

  private tryGetDatabase() {
    try {
      return this.database
    } catch {
      return undefined
    }
  }

  private get splineGeo() {
    this.createSplineIfNeeded()
    return this._splineGeo
  }

  private createSplineIfNeeded() {
    if (
      this.isSplined &&
      this.numVertices >= 2 &&
      (this._splineGeo == null || this._updated)
    ) {
      this._splineGeo = new AcGeSpline3d(this._vertices, 'Uniform')
      this._updated = false
    }
  }

  /**
   * Writes DXF fields for this object.
   *
   * @param filer - DXF output writer.
   * @returns The instance (for chaining).
   */
  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbLeader')
    filer.writeString(3, this.dimensionStyle)
    filer.writeInt16(71, this.hasArrowHead ? 1 : 0)
    filer.writeInt16(72, this.isSplined ? 1 : 0)
    filer.writeInt16(73, this.annoType)
    filer.writeInt16(74, this.isHookLineSameDirection ? 1 : 0)
    filer.writeInt16(75, this.hasHookLine ? 1 : 0)
    filer.writeInt16(76, this.numVertices)
    if (this.textHeight !== 0) filer.writeDouble(40, this.textHeight)
    if (this.textWidth !== 0) filer.writeDouble(41, this.textWidth)
    if (this.byBlockColor != null) filer.writeInt16(77, this.byBlockColor)
    if (this.associatedAnnotation) {
      filer.writeHandle(340, this.associatedAnnotation)
    }
    for (const point of this.vertices) {
      filer.writePoint3d(10, point)
    }
    filer.writeVector3d(210, this.normal)
    filer.writeVector3d(211, this.horizontalDirection)
    if (this._offsetFromBlock) filer.writeVector3d(212, this._offsetFromBlock)
    if (this._offsetFromAnnotation) {
      filer.writeVector3d(213, this._offsetFromAnnotation)
    }
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    filer.atSubclassData('AcDbLeader')

    this._vertices.length = 0
    let pending: { x: number; y: number; z: number } | null = null
    let nx = this.normal.x
    let ny = this.normal.y
    let nz = this.normal.z
    let hx = this.horizontalDirection.x
    let hy = this.horizontalDirection.y
    let hz = this.horizontalDirection.z
    let obx = 0
    let oby = 0
    let obz = 0
    let oax = 0
    let oay = 0
    let oaz = 0
    let hasOffsetBlock = false
    let hasOffsetAnno = false

    const flushVertex = () => {
      if (pending) {
        this.appendVertex(pending)
        pending = null
      }
    }

    while (!filer.atEndOfObject && !filer.atEof && !filer.atExtendedData) {
      const item = filer.readItem()
      if (!item) break
      const code = Number(item.code)
      const n = Number(item.value)
      switch (code) {
        case 3:
          this.dimensionStyle = String(item.value)
          break
        case 10:
          flushVertex()
          pending = { x: n, y: 0, z: 0 }
          break
        case 20:
          if (pending) pending.y = n
          break
        case 30:
          if (pending) pending.z = n
          break
        case 40:
          this.textHeight = n
          break
        case 41:
          this.textWidth = n
          break
        case 71:
          this.hasArrowHead = n !== 0
          break
        case 72:
          this.isSplined = n !== 0
          break
        case 73:
          this.annoType = n as AcDbLeaderAnnotationType
          break
        case 74:
          this.isHookLineSameDirection = n !== 0
          break
        case 75:
          this.hasHookLine = n !== 0
          break
        case 76:
          // Vertex count — informational.
          break
        case 77:
          this.byBlockColor = n
          break
        case 210:
          nx = n
          break
        case 220:
          ny = n
          break
        case 230:
          nz = n
          break
        case 211:
          hx = n
          break
        case 221:
          hy = n
          break
        case 231:
          hz = n
          break
        case 212:
          obx = n
          hasOffsetBlock = true
          break
        case 222:
          oby = n
          hasOffsetBlock = true
          break
        case 232:
          obz = n
          hasOffsetBlock = true
          break
        case 213:
          oax = n
          hasOffsetAnno = true
          break
        case 223:
          oay = n
          hasOffsetAnno = true
          break
        case 233:
          oaz = n
          hasOffsetAnno = true
          break
        case 340:
          this.associatedAnnotation = String(item.value)
          break
        default:
          break
      }
    }

    flushVertex()
    this.normal = { x: nx, y: ny, z: nz }
    this.horizontalDirection = { x: hx, y: hy, z: hz }
    if (hasOffsetBlock) {
      this.offsetFromBlock = { x: obx, y: oby, z: obz }
    }
    if (hasOffsetAnno) {
      this.offsetFromAnnotation = { x: oax, y: oay, z: oaz }
    }
    return this
  }

  /**
   * {@inheritDoc AcDbCurve.getOffsetCurves}
   *
   * Offsets the leader's vertex path in the XY plane and returns an {@link AcDbPolyline}.
   * Splined leaders are sampled before offsetting; the leader is always treated as an
   * open path.
   */
  override getOffsetCurves(offsetDist: number): AcDbCurve[] {
    const curve = this.createOffsetCurve(offsetDist)
    return curve ? [curve] : []
  }

  /**
   * {@inheritDoc AcDbCurve.getOffsetSideAtPoint}
   *
   * Side test follows the straight or sampled spline path as an open polyline.
   */
  override getOffsetSideAtPoint(point: AcGePoint3dLike): 1 | -1 {
    const path = this.collectPath2d()
    if (path.length < 2) return 1
    return AcDbPolyline.from2dPoints(path, false).getOffsetSideAtPoint(point)
  }

  /**
   * @param offsetDist - Signed offset distance in drawing units
   * @returns Offset polyline along the leader path, or `null` when offset fails
   */
  private createOffsetCurve(offsetDist: number): AcDbCurve | null {
    return acdbOffsetVertexPathAsPolyline(
      this.collectPath2d(),
      false,
      offsetDist
    )
  }

  /**
   * Flattens the leader geometry to a 2D vertex list for offset operations.
   *
   * Uses 64 samples from the fit spline when {@link isSplined} is true; otherwise
   * returns the stored WCS vertices projected to XY.
   *
   * @returns Leader path in the XY plane
   */
  private collectPath2d(): AcGePoint2d[] {
    if (this.isSplined && this.splineGeo) {
      return this.splineGeo
        .getPoints(64)
        .map(point => new AcGePoint2d(point.x, point.y))
    }
    return this._vertices.map(vertex => new AcGePoint2d(vertex.x, vertex.y))
  }

  private transformVector(vector: AcGeVector3d, matrix: AcGeMatrix3d) {
    const origin = new AcGePoint3d()
    const endpoint = new AcGePoint3d(vector.x, vector.y, vector.z)
    origin.applyMatrix4(matrix)
    endpoint.applyMatrix4(matrix)
    vector.set(
      endpoint.x - origin.x,
      endpoint.y - origin.y,
      endpoint.z - origin.z
    )
  }
}
