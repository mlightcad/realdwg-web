import {
  AcGeMatrix3d,
  AcGeVector3d,
  AcGeVector3dLike
} from '@mlightcad/geometry-engine'

/**
 * Applies only the linear (rotation / scale / shear) part of `matrix` to
 * `vector`. Unlike {@link AcGeVector3d.transformDirection} the result keeps
 * its length, and unlike `applyMatrix4` the translation is ignored.
 *
 * @param vector - Vector to transform.
 * @param matrix - WCS transformation matrix.
 * @returns A new transformed vector.
 */
export function acdbTransformVector(
  vector: AcGeVector3dLike,
  matrix: AcGeMatrix3d
): AcGeVector3d {
  const e = matrix.elements
  const { x, y, z } = vector
  return new AcGeVector3d(
    e[0] * x + e[4] * y + e[8] * z,
    e[1] * x + e[5] * y + e[9] * z,
    e[2] * x + e[6] * y + e[10] * z
  )
}

/**
 * Transforms a plane normal (extrusion direction) by `matrix` and returns a
 * unit vector.
 *
 * Normals are transformed by the inverse transpose of the linear part, so the
 * result stays perpendicular to the transformed plane even for non-uniform
 * scales. A mirror inside the plane keeps the normal (like AutoCAD MIRROR,
 * which keeps planar entities on +Z); the in-plane orientation flips instead.
 * Falls back to the input normal when the matrix is singular.
 *
 * @param normal - Unit normal to transform.
 * @param matrix - WCS transformation matrix.
 * @returns The transformed unit normal.
 */
export function acdbTransformNormal(
  normal: AcGeVector3dLike,
  matrix: AcGeMatrix3d
): AcGeVector3d {
  const e = matrix.elements
  const c0 = new AcGeVector3d(e[0], e[1], e[2])
  const c1 = new AcGeVector3d(e[4], e[5], e[6])
  const c2 = new AcGeVector3d(e[8], e[9], e[10])
  // Columns of cofactor(L) = det(L) * L^-T.
  const k0 = new AcGeVector3d().crossVectors(c1, c2)
  const k1 = new AcGeVector3d().crossVectors(c2, c0)
  const k2 = new AcGeVector3d().crossVectors(c0, c1)
  const result = k0
    .multiplyScalar(normal.x)
    .addScaledVector(k1, normal.y)
    .addScaledVector(k2, normal.z)
  if (matrix.determinant() < 0) result.negate()
  if (result.lengthSq() === 0) {
    return new AcGeVector3d(normal.x, normal.y, normal.z).normalize()
  }
  return result.normalize()
}

/**
 * Returns the uniform scale factor of `matrix`: the cube root of the absolute
 * determinant of its linear part. It is exactly `k` for
 * `T * R * S(k, k, k) * T⁻¹` and a volume-preserving average otherwise.
 *
 * Used for lengths that have no direction of their own (widths, sizes,
 * dash lengths) and therefore can only follow a uniform scale.
 *
 * @param matrix - WCS transformation matrix.
 * @returns The non-negative uniform scale factor.
 */
export function acdbUniformScaleFactor(matrix: AcGeMatrix3d): number {
  return Math.cbrt(Math.abs(matrix.determinant()))
}

/**
 * Returns how `matrix` scales a length measured along `normal` (thickness,
 * extrusion height), signed so that it stays positive when the normal is
 * transformed with {@link acdbTransformNormal}.
 *
 * @param normal - Unit normal the length is measured along.
 * @param matrix - WCS transformation matrix.
 * @returns The signed scale factor along the normal.
 */
export function acdbScaleAlongNormal(
  normal: AcGeVector3dLike,
  matrix: AcGeMatrix3d
): number {
  return acdbTransformVector(normal, matrix).dot(
    acdbTransformNormal(normal, matrix)
  )
}

/**
 * Returns whether `matrix` reverses orientation (a mirror).
 *
 * @param matrix - WCS transformation matrix.
 */
export function acdbIsMirroring(matrix: AcGeMatrix3d): boolean {
  return matrix.determinant() < 0
}
