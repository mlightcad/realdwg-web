import {
  type AcGeBoundaryEdgeType,
  AcGeCircArc2d,
  AcGeEllipseArc2d,
  AcGeLine2d,
  AcGeSpline3d
} from '@mlightcad/geometry-engine'

import { AcDbArc } from './AcDbArc.js'
import { AcDbCircle } from './AcDbCircle.js'
import { AcDbEllipse } from './AcDbEllipse.js'
import { AcDbEntity } from './AcDbEntity.js'
import { AcDbLine } from './AcDbLine.js'
import { AcDbPolyline } from './AcDbPolyline.js'
import { AcDbSpline } from './AcDbSpline.js'

/**
 * Converts a supported boundary entity into hatch boundary edges.
 *
 * Used when creating associative hatches and when rebuilding loops from
 * source boundary soft-pointers (DXF group 330).
 *
 * A single path may reference several open entities (lines, arcs, elliptical
 * arcs, splines) that together form a closed loop. Closed polylines/circles
 * (and closed arcs/ellipses/splines) may also be the sole source for a path.
 *
 * Supported entities: polyline, circle, arc, line, ellipse, spline.
 */
export function acdbHatchBoundaryEdgesFromEntity(
  entity: AcDbEntity
): AcGeBoundaryEdgeType[] {
  if (entity instanceof AcDbPolyline) {
    return edgesFromPolyline(entity)
  }

  if (entity instanceof AcDbCircle) {
    const center = entity.center
    return [
      new AcGeCircArc2d(
        { x: center.x, y: center.y },
        entity.radius,
        0,
        Math.PI * 2,
        false
      )
    ]
  }

  if (entity instanceof AcDbArc) {
    const center = entity.center
    return [
      new AcGeCircArc2d(
        { x: center.x, y: center.y },
        entity.radius,
        entity.startAngle,
        entity.endAngle,
        false
      )
    ]
  }

  if (entity instanceof AcDbLine) {
    return [new AcGeLine2d(entity.startPoint, entity.endPoint)]
  }

  if (entity instanceof AcDbEllipse) {
    const center = entity.center
    const major = entity.majorAxis
    const rotation = Math.atan2(major.y, major.x)
    return [
      new AcGeEllipseArc2d(
        { x: center.x, y: center.y, z: center.z },
        entity.majorAxisRadius,
        entity.minorAxisRadius,
        entity.startAngle,
        entity.endAngle,
        false,
        rotation
      )
    ]
  }

  if (entity instanceof AcDbSpline) {
    const geo = (entity as unknown as { _geo: AcGeSpline3d })._geo
    return [geo.clone()]
  }

  return []
}

function edgesFromPolyline(entity: AcDbPolyline): AcGeBoundaryEdgeType[] {
  const vertexCount = entity.numberOfVertices
  if (vertexCount < 2) return []

  // Closed polylines contribute every segment including the closing edge.
  // Open polylines contribute consecutive segments only (common when a hatch
  // path lists several partial boundaries).
  const edgeCount = entity.closed ? vertexCount : vertexCount - 1
  const edges: AcGeBoundaryEdgeType[] = []
  for (let i = 0; i < edgeCount; i++) {
    const start = entity.getPoint2dAt(i)
    const end = entity.getPoint2dAt((i + 1) % vertexCount)
    const bulge = entity.getBulgeAt(i)
    if (Math.abs(bulge) > 1e-12) {
      edges.push(new AcGeCircArc2d(start, end, bulge))
    } else {
      edges.push(new AcGeLine2d(start, end))
    }
  }
  return edges
}
