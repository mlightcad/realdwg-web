import {
  AcGeMatrix3d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGeVector3d,
  AcGeVector3dLike,
  TAU
} from '@mlightcad/geometry-engine'
import { AcGiLineWeight } from '@mlightcad/graphic-interface'

import type { AcDbBlockTableRecord } from '../database/AcDbBlockTableRecord.js'
import { ByBlock } from '../misc/AcDbConstants.js'
import { AcDb2dPolyline } from './AcDb2dPolyline.js'
import { AcDbArc } from './AcDbArc.js'
import { AcDbCircle } from './AcDbCircle.js'
import { AcDbEllipse } from './AcDbEllipse.js'
import { AcDbEntity } from './AcDbEntity.js'
import { acdbGetOcsAxes } from './AcDbExplodeHelpers.js'
import { AcDbPolyline } from './AcDbPolyline.js'
import {
  acdbTransformNormal,
  acdbTransformVector
} from './AcDbTransformHelpers.js'

/** Relative tolerance of the conformal (similarity) test. */
const CONFORMAL_TOLERANCE = 1e-9

/**
 * Returns whether `matrix` maps the plane with `normal` conformally, i.e.
 * without non-uniform scaling or shear inside that plane. Circles and arcs in
 * such a plane stay circles and arcs under `matrix`.
 *
 * Only the in-plane behavior matters: a block inserted with scale
 * `(2, 2, 1)` is conformal for the planar entities drawn in its XY plane.
 *
 * @param matrix - Transformation matrix.
 * @param normal - Normal of the plane to test.
 * @returns `true` when the plane is scaled uniformly (rotation, mirror and
 *          uniform scale only).
 */
export function acdbIsConformalInPlane(
  matrix: AcGeMatrix3d,
  normal: AcGeVector3dLike
): boolean {
  const { xAxis, yAxis } = acdbGetOcsAxes(normal)
  const a = acdbTransformVector(xAxis, matrix)
  const b = acdbTransformVector(yAxis, matrix)
  const la = a.length()
  const lb = b.length()
  const scale = Math.max(la, lb)
  if (scale === 0) return true
  return (
    Math.abs(la - lb) <= CONFORMAL_TOLERANCE * scale &&
    Math.abs(a.dot(b)) <= CONFORMAL_TOLERANCE * scale * scale
  )
}

/**
 * Builds the exact image of a planar elliptical arc
 * `center + a·cos(t) + b·sin(t)`, `t ∈ [startParam, endParam]`, under an
 * affine map whose linear part already produced `a` and `b`.
 *
 * The images of two perpendicular radii are conjugate diameters, not the
 * principal axes, so the principal axes are recovered from them (a 2×2
 * eigen decomposition) instead of assuming they stay aligned.
 *
 * @returns The ellipse, or `undefined` when the image degenerates to a line.
 */
function createEllipseFromConjugateAxes(
  center: AcGePoint3dLike,
  a: AcGeVector3d,
  b: AcGeVector3d,
  startParam: number,
  endParam: number,
  preferredNormal: AcGeVector3dLike
): AcDbEllipse | undefined {
  const aa = a.dot(a)
  const bb = b.dot(b)
  const ab = a.dot(b)
  // |a·cos t + b·sin t|² is maximal at t0.
  const t0 = 0.5 * Math.atan2(2 * ab, aa - bb)
  const cos0 = Math.cos(t0)
  const sin0 = Math.sin(t0)
  const major = a.clone().multiplyScalar(cos0).addScaledVector(b, sin0)
  const minor = a.clone().multiplyScalar(-sin0).addScaledVector(b, cos0)
  const majorRadius = major.length()
  const minorRadius = minor.length()
  if (majorRadius === 0 || minorRadius <= majorRadius * 1e-12) return undefined

  // With normal = major × minor, minor = normal × major (the convention of
  // AcGeEllipseArc3d) and the parameter is simply shifted by t0.
  let normal = new AcGeVector3d().crossVectors(major, minor).normalize()
  let start = startParam - t0
  let end = endParam - t0
  // Keep the normal on the side AutoCAD would use (e.g. +Z after a mirror):
  // flipping the normal reverses the parameter direction.
  if (
    normal.dot(
      new AcGeVector3d(preferredNormal.x, preferredNormal.y, preferredNormal.z)
    ) < 0
  ) {
    normal = normal.negate()
    ;[start, end] = [-end, -start]
  }
  return new AcDbEllipse(
    center,
    normal,
    major.normalize(),
    majorRadius,
    minorRadius,
    start,
    end
  )
}

/**
 * Transforms an elliptical arc given by its center, two conjugate radius
 * vectors and parameter range, and copies the properties of `source`.
 */
function transformToEllipse(
  source: AcDbEntity,
  matrix: AcGeMatrix3d,
  center: AcGePoint3dLike,
  normal: AcGeVector3dLike,
  a: AcGeVector3dLike,
  b: AcGeVector3dLike,
  startParam: number,
  endParam: number
): AcDbEntity[] {
  const ellipse = createEllipseFromConjugateAxes(
    new AcGePoint3d(center).applyMatrix4(matrix),
    acdbTransformVector(a, matrix),
    acdbTransformVector(b, matrix),
    startParam,
    endParam,
    acdbTransformNormal(normal, matrix)
  )
  return ellipse ? [ellipse.setPropertiesFrom(source)] : []
}

/**
 * Returns whether a bulge path has at least one arc segment.
 */
function hasArcSegment(polyline: AcDbPolyline | AcDb2dPolyline): boolean {
  for (let i = 0; i < polyline.numberOfVertices; i++) {
    if (polyline.getBulgeAt(i) !== 0) return true
  }
  return false
}

/**
 * Returns a transformed copy of `entity` for exploding a block-like container
 * (INSERT, dimension, table, ...) whose content is mapped by `matrix`.
 *
 * Most entities are simply cloned and passed to
 * {@link AcDbEntity.transformBy}. When the transform scales the entity plane
 * non-uniformly, entities that cannot represent the result are converted
 * exactly, the way AutoCAD EXPLODE does for non-uniformly scaled blocks:
 *
 * - circles and arcs become ellipses / elliptical arcs
 * - ellipses get correct principal axes
 * - polylines with arc segments are exploded first and their arcs become
 *   elliptical arcs (a polyline cannot hold an elliptical segment)
 *
 * Other entities (text, nested block references, hatches, ...) fall back to
 * their own `transformBy`, which approximates a non-uniform scale.
 *
 * @param entity - Source entity, typically owned by a block table record. It
 *   is not modified.
 * @param matrix - Transform from the container's local space to WCS.
 * @returns The transformed, non-database-resident entities.
 */
export function acdbTransformForExplode(
  entity: AcDbEntity,
  matrix: AcGeMatrix3d
): AcDbEntity[] {
  if (entity instanceof AcDbCircle || entity instanceof AcDbArc) {
    if (!acdbIsConformalInPlane(matrix, entity.normal)) {
      const normal = entity.normal
      const { xAxis, yAxis } = acdbGetOcsAxes(normal)
      let u = xAxis
      let v = yAxis
      let sweep = TAU
      if (entity instanceof AcDbArc) {
        // Measure the parameter from the start point so the result does not
        // depend on how the arc stores its reference vector.
        u = new AcGeVector3d(entity.startPoint).sub(entity.center).normalize()
        v = new AcGeVector3d()
          .crossVectors(new AcGeVector3d(normal).normalize(), u)
          .normalize()
        sweep = entity.endAngle - entity.startAngle
        sweep = ((sweep % TAU) + TAU) % TAU
        if (sweep === 0) sweep = TAU
      }
      const r = entity.radius
      return transformToEllipse(
        entity,
        matrix,
        entity.center,
        normal,
        u.multiplyScalar(r),
        v.multiplyScalar(r),
        0,
        sweep
      )
    }
  } else if (entity instanceof AcDbEllipse) {
    if (!acdbIsConformalInPlane(matrix, entity.normal)) {
      const normal = new AcGeVector3d(entity.normal).normalize()
      const major = new AcGeVector3d(entity.majorAxis).normalize()
      const minor = new AcGeVector3d().crossVectors(normal, major).normalize()
      return transformToEllipse(
        entity,
        matrix,
        entity.center,
        normal,
        major.multiplyScalar(entity.majorAxisRadius),
        minor.multiplyScalar(entity.minorAxisRadius),
        entity.startAngle,
        entity.endAngle
      )
    }
  } else if (
    entity instanceof AcDbPolyline ||
    entity instanceof AcDb2dPolyline
  ) {
    if (
      hasArcSegment(entity) &&
      !acdbIsConformalInPlane(matrix, entity.normal)
    ) {
      return entity
        .explode()
        .flatMap(part => acdbTransformForExplode(part, matrix))
    }
  }
  return [entity.clone().transformBy(matrix)]
}

/**
 * Explodes the content of a block table record mapped into WCS by `matrix`:
 * every entity of the block is transformed with
 * {@link acdbTransformForExplode}.
 *
 * @param block - Block whose entities are exploded.
 * @param matrix - Transform from block space to WCS (including the block base
 *   point compensation).
 * @param filter - Optional predicate that skips entities returning `false`.
 * @returns The transformed, non-database-resident entities.
 */
export function acdbExplodeBlockContent(
  block: AcDbBlockTableRecord,
  matrix: AcGeMatrix3d,
  filter?: (entity: AcDbEntity) => boolean
): AcDbEntity[] {
  const result: AcDbEntity[] = []
  for (const entity of block.newIterator()) {
    if (filter && !filter(entity)) continue
    result.push(...acdbTransformForExplode(entity, matrix))
  }
  return result
}

/**
 * Resolves the layer-0 / ByBlock properties of an entity exploded out of an
 * annotation object (dimension, leader, table, ...) against that object.
 *
 * The anonymous blocks of annotation objects are drawn with layer `0` and
 * ByBlock properties so that they follow the owning object. AutoCAD EXPLODE
 * keeps the look of such objects: the parts end up on the object's layer with
 * its color, linetype and lineweight.
 *
 * Block references are deliberately not resolved this way: exploding an
 * INSERT keeps layer `0` and ByBlock values unchanged, as in AutoCAD.
 *
 * @param entity - Exploded entity to update.
 * @param owner - Annotation object it was exploded from.
 * @returns The updated entity.
 */
export function acdbResolveByBlockProperties<T extends AcDbEntity>(
  entity: T,
  owner: AcDbEntity
): T {
  if (entity.layer === '0') entity.layer = owner.layer
  if (entity.color.isByBlock) entity.color = owner.color
  if (entity.lineType === ByBlock) entity.lineType = owner.lineType
  if (entity.lineWeight === AcGiLineWeight.ByBlock) {
    entity.lineWeight = owner.lineWeight
  }
  return entity
}
