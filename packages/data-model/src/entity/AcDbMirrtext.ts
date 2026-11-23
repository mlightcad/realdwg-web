import {
  AcGeMatrix3d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGeVector3d,
  AcGeVector3dLike
} from '@mlightcad/geometry-engine'

import type { AcDbObject } from '../base/AcDbObject.js'
import { ACDB_MIRRTEXT_DEFAULT } from '../misc/AcDbConstants.js'
import { acdbIsMirroring, acdbTransformNormal } from './AcDbTransformHelpers.js'

/** Axis-aligned bounds in a text entity's local frame. */
export interface AcDbTextLocalBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Resolves **MIRRTEXT** for an entity: `1` means truly mirror text, anything
 * else (including missing database) means keep text readable (AutoCAD default).
 */
export function acdbResolveMirrtext(entity: AcDbObject): number {
  try {
    return Number(entity.database.mirrtext) === 1 ? 1 : 0
  } catch {
    return ACDB_MIRRTEXT_DEFAULT
  }
}

/**
 * Builds orthonormal text axes from rotation and optional direction.
 */
function acdbTextAxes(
  rotation: number,
  direction?: AcGeVector3dLike
): { xAxis: AcGeVector3d; yAxis: AcGeVector3d } {
  let xAxis: AcGeVector3d
  if (direction && direction.x * direction.x + direction.y * direction.y > 0) {
    xAxis = new AcGeVector3d(direction.x, direction.y, direction.z ?? 0).normalize()
  } else {
    xAxis = new AcGeVector3d(Math.cos(rotation), Math.sin(rotation), 0)
  }
  const yAxis = new AcGeVector3d(-xAxis.y, xAxis.x, xAxis.z)
  if (yAxis.lengthSq() === 0) {
    yAxis.set(0, 1, 0)
  } else {
    yAxis.normalize()
  }
  return { xAxis, yAxis }
}

/**
 * Computes the readable-text insertion anchor after a mirror so the glyphs
 * occupy the mirrored image of the pre-transform text box.
 *
 * AutoCAD **MIRRTEXT = 0** keeps justification/attachment and reading
 * direction, but relocates the anchor into the mirrored box (e.g. left
 * TEXT at x=10 with width w ends at −(10+w), not −10).
 *
 * @param matrix - Mirroring transform applied to the entity.
 * @param oldAnchor - Pre-transform drawing anchor (insertion / alignment).
 * @param oldRotation - Pre-transform rotation in radians.
 * @param oldDirection - Optional pre-transform direction (MTEXT).
 * @param bounds - Local box relative to `oldAnchor` before the transform.
 * @param newRotation - Post-policy readable rotation.
 * @param newDirection - Optional post-policy readable direction (MTEXT).
 * @returns World-space anchor for the same attachment in the mirrored box.
 */
export function acdbComputeMirroredReadableAnchor(
  matrix: AcGeMatrix3d,
  oldAnchor: AcGePoint3dLike,
  oldRotation: number,
  oldDirection: AcGeVector3dLike | undefined,
  bounds: AcDbTextLocalBounds,
  newRotation: number,
  newDirection?: AcGeVector3dLike
): AcGePoint3d {
  const { xAxis: ox, yAxis: oy } = acdbTextAxes(oldRotation, oldDirection)
  const corners: AcGePoint3d[] = [
    [bounds.minX, bounds.minY],
    [bounds.maxX, bounds.minY],
    [bounds.maxX, bounds.maxY],
    [bounds.minX, bounds.maxY]
  ].map(([u, v]) => {
    const p = new AcGePoint3d(
      oldAnchor.x + u * ox.x + v * oy.x,
      oldAnchor.y + u * ox.y + v * oy.y,
      (oldAnchor.z ?? 0) + u * ox.z + v * oy.z
    )
    return p.applyMatrix4(matrix)
  })

  const { xAxis: nx, yAxis: ny } = acdbTextAxes(newRotation, newDirection)
  let minProjX = Infinity
  let minProjY = Infinity
  let zSum = 0
  for (const c of corners) {
    const px = c.x * nx.x + c.y * nx.y + c.z * nx.z
    const py = c.x * ny.x + c.y * ny.y + c.z * ny.z
    if (px < minProjX) minProjX = px
    if (py < minProjY) minProjY = py
    zSum += c.z
  }

  const ax = minProjX - bounds.minX
  const ay = minProjY - bounds.minY
  return new AcGePoint3d(
    ax * nx.x + ay * ny.x,
    ax * nx.y + ay * ny.y,
    zSum / corners.length
  )
}

/**
 * Applies AutoCAD MIRRTEXT policy to a TEXT-like entity after its geometric
 * axes have already been transformed by a mirroring matrix.
 *
 * - **MIRRTEXT = 0**: reorient so glyphs stay readable (clear generation
 *   flags; add π to rotation when the baseline was reversed). TEXT callers
 *   then swap Left↔Right justification; MTEXT callers rematch the anchor
 *   with {@link acdbComputeMirroredReadableAnchor}.
 * - **MIRRTEXT = 1**: encode the mirror into `isBackward` / `isUpsideDown`.
 *
 * Also updates `normal` via {@link acdbTransformNormal}.
 */
export function acdbApplyTextMirrtextPolicy(
  text: {
    rotation: number
    isBackward: boolean
    isUpsideDown: boolean
    normal: AcGeVector3d
  },
  matrix: AcGeMatrix3d,
  xAxis: AcGeVector3d,
  yAxis: AcGeVector3d,
  mirrtext: number
): void {
  text.normal.copy(acdbTransformNormal(text.normal, matrix))
  if (!acdbIsMirroring(matrix)) return

  const xLen = xAxis.length()
  const yLen = yAxis.length()
  if (xLen === 0 || yLen === 0) return

  const xN = xAxis.clone().multiplyScalar(1 / xLen)
  const yN = yAxis.clone().multiplyScalar(1 / yLen)
  // Perpendicular "up" for the current baseline in XY.
  const up = new AcGeVector3d(-xN.y, xN.x, 0)
  const upFlipped = yN.dot(up) < 0
  const hand = xN.x * yN.y - xN.y * yN.x
  // Vertical-ish mirrors reverse the baseline (x points left); horizontal
  // mirrors keep +X but flip up. Length-based height already drops the Y flip
  // from geometry, so only baseline reversal needs an extra π for readability.
  const baselineReversed = hand < 0 && xN.x < 0

  if (mirrtext === 0) {
    if (baselineReversed) {
      text.rotation += Math.PI
    }
    text.isBackward = false
    text.isUpsideDown = false
    return
  }

  // True mirror: encode orientation into generation flags.
  if (baselineReversed || (hand < 0 && !upFlipped)) {
    text.isBackward = !text.isBackward
  } else if (upFlipped) {
    text.isUpsideDown = !text.isUpsideDown
  }
}

/**
 * Applies AutoCAD MIRRTEXT policy to MTEXT after its geometric transform.
 *
 * - **MIRRTEXT = 0**: if the direction was flipped into a mirrored orientation,
 *   add π so the paragraph stays readable. Callers must then rematch the
 *   insertion point with {@link acdbComputeMirroredReadableAnchor}.
 * - **MIRRTEXT = 1**: leave the geometrically mirrored direction as-is.
 *
 * Normal is already updated by MTEXT `transformBy` via `acdbTransformNormal`.
 */
export function acdbApplyMTextMirrtextPolicy(
  mtext: {
    rotation: number
    direction: AcGeVector3d
  },
  matrix: AcGeMatrix3d,
  xAxis: AcGeVector3d,
  yAxis: AcGeVector3d,
  mirrtext: number
): void {
  if (!acdbIsMirroring(matrix) || mirrtext === 1) return

  const xLen = xAxis.length()
  const yLen = yAxis.length()
  if (xLen === 0 || yLen === 0) return

  const xN = xAxis.clone().multiplyScalar(1 / xLen)
  const yN = yAxis.clone().multiplyScalar(1 / yLen)
  const hand = xN.x * yN.y - xN.y * yN.x
  if (hand < 0 && xN.x < 0) {
    mtext.rotation += Math.PI
    mtext.direction
      .set(Math.cos(mtext.rotation), Math.sin(mtext.rotation), 0)
      .normalize()
  }
}
