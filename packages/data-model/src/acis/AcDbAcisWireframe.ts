import { acdbDecodeAcisModel } from './AcDbAcisDecode'
import type { AcDbAcisModel, AcDbAcisNode } from './AcDbAcisEntities'
import {
  acdbAcisEdgeParamBounds,
  type AcDbAcisGeometry,
  acdbAcisParseSurfaceParams,
  type AcDbAcisVec3,
  acdbExtractAcisGeometry,
  acdbSampleAcisEllipseArc,
  acdbSampleAcisSphereWireframe,
} from './AcDbAcisGeometry'
import {
  acdbAcisModelSpaceTransform,
  acdbAcisTransformSegments,
} from './AcDbAcisTransform'

/** Default number of samples when tessellating ellipse edges for wireframe output. */
const DEFAULT_ELLIPSE_SAMPLES = 16

const refOfType = (node: AcDbAcisNode, suffix: string): AcDbAcisNode | null =>
  node.refs.find(r => r !== null && (r.type === suffix || r.type.endsWith(suffix))) ?? null

/** Appends one line segment (`a` → `b`) to a flat coordinate buffer. */
function pushSegment(segments: number[], a: AcDbAcisVec3, b: AcDbAcisVec3): void {
  segments.push(a[0], a[1], a[2], b[0], b[1], b[2])
}

/** Appends consecutive point pairs from `points` as line segments. */
function pushPolyline(segments: number[], points: readonly AcDbAcisVec3[]): void {
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (a && b) pushSegment(segments, a, b)
  }
}

/**
 * Builds wireframe rings for sphere faces when edge-based wireframe is empty.
 *
 * @param model - Resolved ACIS model graph.
 * @returns Line-segment endpoint pairs for sphere surface scaffolds.
 */
function acdbAcisWireframeSegmentsFromSphereFaces(model: AcDbAcisModel): Float32Array {
  const segments: number[] = []
  for (const face of model.nodesOfType('face')) {
    const surfaceNode = refOfType(face, '-surface')
    if (surfaceNode?.type !== 'sphere-surface') continue
    const params = acdbAcisParseSurfaceParams(surfaceNode)
    if (params.kind !== 'sphere') continue
    for (const ring of acdbSampleAcisSphereWireframe(params)) {
      pushPolyline(segments, ring)
    }
  }
  return new Float32Array(segments)
}

/**
 * Converts extracted ACIS B-rep geometry into line-segment endpoint pairs
 * suitable for {@link AcGiRenderer.lineSegments}.
 *
 * @param geometry - Geometry extracted from a decoded ACIS model.
 * @param model - Optional source model used to read edge parameter bounds.
 * @returns Flat `Float32Array` of segment endpoint pairs.
 */
export function acdbAcisWireframeSegmentsFromGeometry(
  geometry: AcDbAcisGeometry,
  model?: AcDbAcisModel,
): Float32Array {
  const segments: number[] = []

  for (const edge of geometry.edges) {
    const edgeNode = model?.nodes[edge.nodeIndex]

    if (edge.curve?.kind === 'ellipse') {
      const bounds =
        edgeNode !== undefined ? acdbAcisEdgeParamBounds(edgeNode) : null
      const t0 = bounds?.[0] ?? 0
      const t1 = bounds?.[1] ?? Math.PI * 2
      pushPolyline(
        segments,
        acdbSampleAcisEllipseArc(edge.curve, t0, t1, DEFAULT_ELLIPSE_SAMPLES),
      )
      continue
    }

    if (
      edge.curve?.kind === 'intcurve' &&
      edge.curve.controlPoints.length > 0
    ) {
      pushPolyline(segments, edge.curve.controlPoints)
      continue
    }

    if (edge.start && edge.end) {
      pushSegment(segments, edge.start, edge.end)
    }
  }

  return new Float32Array(segments)
}

/**
 * Decodes a SAB byte stream and returns wireframe line segments, or `null`
 * when decoding fails or no drawable geometry is present.
 *
 * @param sabBytes - Raw SAB/ASM binary payload.
 * @returns Wireframe segment buffer, or `null` when nothing drawable is found.
 */
export function acdbAcisWireframeSegmentsFromSab(
  sabBytes: Uint8Array,
): Float32Array | null {
  const model = acdbDecodeAcisModel(sabBytes)
  if (model === null) return null
  // Edge wireframe uses geometry already mapped to model space by extract.
  const geometry = acdbExtractAcisGeometry(model)
  const edgeWireframe = acdbAcisWireframeSegmentsFromGeometry(geometry, model)
  if (edgeWireframe.length > 0) {
    return edgeWireframe
  }
  // Sphere fallback reads raw surface records — apply the body transform here.
  const sphereWireframe = acdbAcisWireframeSegmentsFromSphereFaces(model)
  if (sphereWireframe.length === 0) return null
  return acdbAcisTransformSegments(
    sphereWireframe,
    acdbAcisModelSpaceTransform(model),
  )
}
