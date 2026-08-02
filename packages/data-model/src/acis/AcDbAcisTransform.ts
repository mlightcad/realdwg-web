/**
 * ACIS body `transform` entity parsing and application.
 *
 * Each `body` may reference a `transform` that maps body-space geometry into
 * model space: `p' = scale * (x*px + y*py + z*pz) + translation`. Wireframe
 * extraction must apply this or solids appear far from sibling 2D entities
 * (common when ACIS points stay in a pre-block coordinate frame).
 */

import type { AcDbAcisModel, AcDbAcisNode } from './AcDbAcisEntities'
import type { AcDbAcisSabVector } from './AcDbAcisSab'
import { AcDbAcisSabTag } from './AcDbAcisSab'

/** Affine transform carried by an ACIS `transform` entity. */
export interface AcDbAcisAffineTransform {
  /** Image of the unit X axis. */
  readonly xAxis: AcDbAcisSabVector
  /** Image of the unit Y axis. */
  readonly yAxis: AcDbAcisSabVector
  /** Image of the unit Z axis. */
  readonly zAxis: AcDbAcisSabVector
  /** Translation applied after rotation/scale. */
  readonly translation: AcDbAcisSabVector
  /** Uniform scale factor. */
  readonly scale: number
}

const IDENTITY: AcDbAcisAffineTransform = {
  xAxis: [1, 0, 0],
  yAxis: [0, 1, 0],
  zAxis: [0, 0, 1],
  translation: [0, 0, 0],
  scale: 1,
}

const VEC_TAGS = new Set<number>([
  AcDbAcisSabTag.LocationVec,
  AcDbAcisSabTag.DirectionVec,
])

/**
 * Parses an ACIS `transform` node into an affine transform.
 *
 * SAB layout (after entity-type / pointers): three axis direction vectors,
 * one translation vector, then a scale double. Returns `null` when the record
 * does not carry four vectors.
 *
 * @param node - Resolved `transform` entity node.
 */
export function acdbAcisParseTransform(
  node: AcDbAcisNode,
): AcDbAcisAffineTransform | null {
  const vectors: AcDbAcisSabVector[] = []
  let scale: number | undefined
  for (const token of node.record.tokens) {
    if (VEC_TAGS.has(token.tag)) {
      vectors.push(token.value as AcDbAcisSabVector)
      continue
    }
    if (
      token.tag === AcDbAcisSabTag.Double &&
      vectors.length >= 4 &&
      scale === undefined
    ) {
      scale = token.value as number
    }
  }
  if (vectors.length < 4) return null
  return {
    xAxis: vectors[0]!,
    yAxis: vectors[1]!,
    zAxis: vectors[2]!,
    translation: vectors[3]!,
    scale: scale ?? 1,
  }
}

/**
 * Returns the affine transform referenced by a `body` node, or identity when
 * the body has no resolvable `transform`.
 *
 * @param body - Resolved `body` entity node.
 */
export function acdbAcisTransformFromBody(
  body: AcDbAcisNode,
): AcDbAcisAffineTransform {
  const transformNode = body.refs.find(ref => ref?.type === 'transform')
  if (transformNode == null) return IDENTITY
  return acdbAcisParseTransform(transformNode) ?? IDENTITY
}

/**
 * Returns true when `transform` is (numerically) the identity.
 *
 * @param transform - Affine transform to test.
 */
export function acdbAcisTransformIsIdentity(
  transform: AcDbAcisAffineTransform,
): boolean {
  const near = (a: number, b: number) => Math.abs(a - b) <= 1e-12
  const nearVec = (v: AcDbAcisSabVector, e: AcDbAcisSabVector) =>
    near(v[0], e[0]) && near(v[1], e[1]) && near(v[2], e[2])
  return (
    near(transform.scale, 1) &&
    nearVec(transform.xAxis, IDENTITY.xAxis) &&
    nearVec(transform.yAxis, IDENTITY.yAxis) &&
    nearVec(transform.zAxis, IDENTITY.zAxis) &&
    nearVec(transform.translation, IDENTITY.translation)
  )
}

/**
 * Transforms a point: `scale * (x*px + y*py + z*pz) + translation`.
 *
 * @param point - Body-space point.
 * @param transform - Body transform.
 */
export function acdbAcisTransformPoint(
  point: AcDbAcisSabVector,
  transform: AcDbAcisAffineTransform,
): AcDbAcisSabVector {
  const s = transform.scale
  const [px, py, pz] = point
  const { xAxis: x, yAxis: y, zAxis: z, translation: t } = transform
  return [
    s * (x[0] * px + y[0] * py + z[0] * pz) + t[0],
    s * (x[1] * px + y[1] * py + z[1] * pz) + t[1],
    s * (x[2] * px + y[2] * py + z[2] * pz) + t[2],
  ]
}

/**
 * Transforms a direction / free vector (rotation + scale, no translation).
 *
 * @param direction - Body-space direction.
 * @param transform - Body transform.
 */
export function acdbAcisTransformDirection(
  direction: AcDbAcisSabVector,
  transform: AcDbAcisAffineTransform,
): AcDbAcisSabVector {
  const s = transform.scale
  const [dx, dy, dz] = direction
  const { xAxis: x, yAxis: y, zAxis: z } = transform
  return [
    s * (x[0] * dx + y[0] * dy + z[0] * dz),
    s * (x[1] * dx + y[1] * dy + z[1] * dz),
    s * (x[2] * dx + y[2] * dy + z[2] * dz),
  ]
}

/**
 * Picks the single body transform to apply to a whole model.
 *
 * Returns identity when there is no body, or when bodies disagree on
 * transform (multi-body with distinct transforms is not yet supported for
 * global application — callers keep body-space coords and can specialize).
 *
 * @param model - Resolved ACIS model graph.
 */
export function acdbAcisModelSpaceTransform(
  model: AcDbAcisModel,
): AcDbAcisAffineTransform {
  if (model.bodies.length === 0) return IDENTITY
  const transforms = model.bodies.map(acdbAcisTransformFromBody)
  const first = transforms[0]!
  for (let i = 1; i < transforms.length; i++) {
    const other = transforms[i]!
    if (
      other.scale !== first.scale ||
      other.xAxis[0] !== first.xAxis[0] ||
      other.xAxis[1] !== first.xAxis[1] ||
      other.xAxis[2] !== first.xAxis[2] ||
      other.yAxis[0] !== first.yAxis[0] ||
      other.yAxis[1] !== first.yAxis[1] ||
      other.yAxis[2] !== first.yAxis[2] ||
      other.zAxis[0] !== first.zAxis[0] ||
      other.zAxis[1] !== first.zAxis[1] ||
      other.zAxis[2] !== first.zAxis[2] ||
      other.translation[0] !== first.translation[0] ||
      other.translation[1] !== first.translation[1] ||
      other.translation[2] !== first.translation[2]
    ) {
      return IDENTITY
    }
  }
  return first
}

/**
 * Applies an affine transform to a flat wireframe segment buffer in place
 * style (returns a new buffer).
 *
 * @param segments - `[x,y,z,x,y,z,...]` endpoint pairs.
 * @param transform - Transform to apply to every endpoint.
 */
export function acdbAcisTransformSegments(
  segments: Float32Array,
  transform: AcDbAcisAffineTransform,
): Float32Array {
  if (acdbAcisTransformIsIdentity(transform) || segments.length < 3) {
    return segments
  }
  const out = new Float32Array(segments.length)
  for (let i = 0; i + 2 < segments.length; i += 3) {
    const [x, y, z] = acdbAcisTransformPoint(
      [segments[i]!, segments[i + 1]!, segments[i + 2]!],
      transform,
    )
    out[i] = x
    out[i + 1] = y
    out[i + 2] = z
  }
  return out
}
