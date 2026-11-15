/** The minimal vertex information needed to measure a bulged polyline's area. */
type BulgeVertexLike = {
  x: number
  y: number
  bulge?: number
}

/**
 * Evaluate `theta - sin(theta)` without cancellation for small `theta`.
 *
 * For a short arc the two terms cancel almost completely, so the difference is
 * taken from its Taylor series (`t^3/6 - t^5/120 + ...`) instead. The series
 * drops below the double-precision floor for the cut-off used here, while the
 * direct expression needs no series expansion above it. `theta - sin(theta)` is
 * odd in `theta`, so the series is evaluated on `|theta|` and given its sign
 * back.
 *
 * @param theta Input signed included angle in radians
 * @returns Return `theta - sin(theta)` for the signed angle
 */
function acgeThetaMinusSin(theta: number): number {
  const magnitude = Math.abs(theta)
  if (magnitude < 0.1) {
    const squared = magnitude * magnitude
    // (t^3 / 6) * (1 - t^2 / 20 + t^4 / 840 - t^6 / 60480 + ...)
    const factor =
      1 -
      (squared / 20) *
        (1 - (squared / 42) * (1 - (squared / 72) * (1 - squared / 110)))
    const series = ((magnitude * squared) / 6) * factor
    return theta < 0 ? -series : series
  }
  return theta - Math.sin(theta)
}

/**
 * Compute the area enclosed by a bulged polyline without tessellating its arcs.
 *
 * The signed area is the line integral `0.5 * ∮ (x dy - y dx)` taken along the
 * polyline. Every straight segment contributes the shoelace term of its chord,
 * while each bulged segment contributes the exact signed area of its circular
 * segment (`0.5 * r^2 * (theta - sin(theta))`). Summing those terms makes a
 * closed two-vertex polyline with `bulge = 1` on both vertices — the DXF
 * representation of a circle or a `DONUT` centerline — report exactly
 * `PI * r * r` instead of an approximation.
 *
 * Vertices are measured relative to the first vertex so the result does not
 * depend on where the polyline sits in the drawing, and so no intermediate
 * `r^2` term can swallow the result of a short arc.
 *
 * @param vertices Input polyline vertices; the bulge of a vertex applies to the
 *   segment that starts at it.
 * @param closed Input `true` to include the segment from the last vertex back
 *   to the first one. Open polylines enclose no area and return `0`.
 * @returns Return the absolute enclosed area in squared drawing units.
 */
export function acgeBulgedPolylineArea2d(
  vertices: readonly BulgeVertexLike[],
  closed: boolean
): number {
  const count = vertices.length
  if (!closed || count < 2) return 0

  // Measuring from the first vertex keeps the shoelace and circular-segment
  // terms scale-free, so large coordinates do not lose precision.
  const originX = vertices[0].x
  const originY = vertices[0].y

  let signedArea = 0
  for (let index = 0; index < count; ++index) {
    const from = vertices[index]
    const to = vertices[(index + 1) % count]
    const fromX = from.x - originX
    const fromY = from.y - originY
    const toX = to.x - originX
    const toY = to.y - originY

    signedArea += 0.5 * (fromX * toY - toX * fromY)

    const bulge = from.bulge ?? 0
    const chordX = toX - fromX
    const chordY = toY - fromY
    const chordLengthSquared = chordX * chordX + chordY * chordY
    // A degenerate chord cannot define an arc, so its bulge is ignored and the
    // segment contributes no area beyond the shoelace term above.
    if (bulge === 0 || !(chordLengthSquared > 0)) continue

    // The bulge is the tangent of one fourth of the included angle, so
    // `4 * atan(bulge)` is the signed sweep. It stays strictly inside
    // `(-2 * PI, 2 * PI)`, which a full circle approaches but never reaches.
    const sweep = 4 * Math.atan(bulge)
    const halfSine = Math.sin(sweep / 2)
    const radiusSquared = chordLengthSquared / (4 * halfSine * halfSine)
    signedArea += 0.5 * radiusSquared * acgeThetaMinusSin(sweep)
  }

  return Math.abs(signedArea)
}
