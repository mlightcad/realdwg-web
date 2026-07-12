import type {
  AcadEvalGraphDXFObject,
  AcshBoxDXFObject,
  AcshBrepDXFObject,
  AcshConeDXFObject,
  AcshCylinderDXFObject,
  AcshExtrusionDXFObject,
  AcshHistoryDXFObject,
  AcshLoftDXFObject,
  AcshRevolveDXFObject,
  AcshSweepDXFObject,
  CommonDXFObject,
  DxfObjectByHandle,
} from '@mlightcad/dxf-json/types'

/** Local 3D point used when synthesizing SAT from ACSH primitive bounds. */
interface Point3 {
  /** X coordinate in model space. */
  x: number
  /** Y coordinate in model space. */
  y: number
  /** Z coordinate in model space. */
  z: number
}

const ACIS_OBJECT_TYPES = new Set([
  'ACSH_SWEEP_CLASS',
  'ACSH_BREP_CLASS',
  'ACSH_EXTRUSION_CLASS',
  'ACSH_REVOLVE_CLASS',
  'ACSH_LOFT_CLASS',
])

/**
 * Resolves ACIS SAT text for a `3DSOLID` that stores geometry in the OBJECTS
 * section via `ACSH_HISTORY_CLASS` rather than inline groups 1/3.
 *
 * @param historyObjectSoftId - Soft-pointer handle to `ACSH_HISTORY_CLASS`.
 * @param objectByHandle - OBJECTS-section entries keyed by handle.
 * @returns Resolved SAT text, or an empty string when resolution fails.
 */
export function resolveAcshSolidAcisData(
  historyObjectSoftId: string | undefined,
  objectByHandle: DxfObjectByHandle | undefined,
): string {
  if (!historyObjectSoftId || !objectByHandle) {
    return ''
  }

  const history = objectByHandle[normalizeHandle(historyObjectSoftId)]
  if (!history || history.name !== 'ACSH_HISTORY_CLASS') {
    return ''
  }

  const evalGraphId = (history as AcshHistoryDXFObject).evalGraphHardId
  if (!evalGraphId) {
    return ''
  }

  const graph = objectByHandle[normalizeHandle(evalGraphId)]
  if (!graph || graph.name !== 'ACAD_EVALUATION_GRAPH') {
    return ''
  }

  const nodeIds = (graph as AcadEvalGraphDXFObject).nodeObjectHardIds ?? []
  let resolvedAcis = ''

  for (const nodeId of nodeIds) {
    const node = objectByHandle[normalizeHandle(nodeId)]
    if (!node) {
      continue
    }

    const acisFromNode = resolveNodeAcisData(node)
    if (acisFromNode) {
      resolvedAcis = acisFromNode
    }
  }

  if (resolvedAcis) {
    return resolvedAcis
  }

  const points: Point3[] = []
  for (const nodeId of nodeIds) {
    const node = objectByHandle[normalizeHandle(nodeId)]
    if (!node) {
      continue
    }
    points.push(...primitiveCornerPoints(node))
  }

  if (points.length === 0) {
    return ''
  }

  return pointsToSyntheticSat(points)
}

/**
 * Reads inline ACIS data from one ACSH evaluation-graph node when present.
 *
 * @param node - ACSH primitive or B-rep node from the evaluation graph.
 */
function resolveNodeAcisData(node: CommonDXFObject): string {
  if (!ACIS_OBJECT_TYPES.has(node.name)) {
    return ''
  }

  const acisObject = node as
    | AcshSweepDXFObject
    | AcshBrepDXFObject
    | AcshExtrusionDXFObject
    | AcshRevolveDXFObject
    | AcshLoftDXFObject

  return acisObject.acisData ?? ''
}

/**
 * Collects approximate bounding-box corner points for supported ACSH primitives.
 *
 * @param node - ACSH primitive node from the evaluation graph.
 */
function primitiveCornerPoints(node: CommonDXFObject): Point3[] {
  switch (node.name) {
    case 'ACSH_BOX_CLASS':
      return boxCornerPoints(node as AcshBoxDXFObject)
    case 'ACSH_CYLINDER_CLASS':
      return primitiveBoundingBoxPoints(node as AcshCylinderDXFObject, cylinder => {
        const radius = Math.max(
          cylinder.minorRadius ?? 0,
          cylinder.majorRadius ?? 0,
          cylinder.topMajorRadius ?? 0,
        )
        const height = cylinder.height ?? cylinder.topMajorRadius ?? 0
        return { length: radius * 2, width: radius * 2, height }
      })
    case 'ACSH_CONE_CLASS':
      return primitiveBoundingBoxPoints(node as AcshConeDXFObject, cone => {
        const radius = Math.max(
          cone.baseRadius ?? 0,
          cone.minorRadius ?? 0,
          cone.topRadius ?? 0,
          cone.majorRadius ?? 0,
        )
        const height = cone.height ?? cone.topMajorRadius ?? 0
        return { length: radius * 2, width: radius * 2, height }
      })
    case 'ACSH_WEDGE_CLASS':
      return primitiveBoundingBoxPoints(
        node as { transform?: number[]; length?: number; width?: number; height?: number },
        wedge => ({
          length: wedge.length ?? 0,
          width: wedge.width ?? 0,
          height: wedge.height ?? 0,
        }),
      )
    default:
      return []
  }
}

/**
 * Builds eight axis-aligned box corners for a primitive and applies its transform.
 *
 * @param primitive - ACSH primitive with optional 4×4 transform matrix.
 * @param dimensions - Callback that derives local length/width/height.
 */
function primitiveBoundingBoxPoints<T extends { transform?: number[] }>(
  primitive: T,
  dimensions: (primitive: T) => { length: number; width: number; height: number },
): Point3[] {
  const { length, width, height } = dimensions(primitive)
  if (length <= 0 || width <= 0 || height <= 0) {
    return []
  }
  return boxCornerPoints({
    name: 'ACSH_BOX_CLASS',
    handle: '',
    ownerObjectId: '0',
    length,
    width,
    height,
    transform: primitive.transform,
  })
}

/** Normalizes a DXF handle string for map lookups (trim + uppercase). */
function normalizeHandle(handle: string): string {
  return String(handle).trim().toUpperCase()
}

/**
 * Returns eight local box corners for an `ACSH_BOX_CLASS`, transformed when a
 * 4×4 matrix is present.
 *
 * @param box - ACSH box primitive with length, width, height, and transform.
 */
function boxCornerPoints(box: AcshBoxDXFObject): Point3[] {
  const length = box.length ?? 0
  const width = box.width ?? 0
  const height = box.height ?? 0
  if (length <= 0 || width <= 0 || height <= 0) {
    return []
  }

  const halfLength = length / 2
  const halfWidth = width / 2
  const halfHeight = height / 2
  const localCorners: Point3[] = [
    { x: -halfLength, y: -halfWidth, z: -halfHeight },
    { x: halfLength, y: -halfWidth, z: -halfHeight },
    { x: halfLength, y: halfWidth, z: -halfHeight },
    { x: -halfLength, y: halfWidth, z: -halfHeight },
    { x: -halfLength, y: -halfWidth, z: halfHeight },
    { x: halfLength, y: -halfWidth, z: halfHeight },
    { x: halfLength, y: halfWidth, z: halfHeight },
    { x: -halfLength, y: halfWidth, z: halfHeight },
  ]

  const matrix = box.transform
  if (!matrix || matrix.length !== 16) {
    return localCorners
  }

  return localCorners.map(corner => transformPoint(matrix, corner))
}

/**
 * Applies a 4×4 column-major transform matrix to one point.
 *
 * @param matrix - 16-element transform matrix.
 * @param point - Local-space point to transform.
 */
function transformPoint(matrix: number[], point: Point3): Point3 {
  const x = point.x
  const y = point.y
  const z = point.z
  const w = matrix[12] * x + matrix[13] * y + matrix[14] * z + matrix[15]
  const scale = w !== 0 && w !== 1 ? 1 / w : 1
  return {
    x: (matrix[0] * x + matrix[1] * y + matrix[2] * z + matrix[3]) * scale,
    y: (matrix[4] * x + matrix[5] * y + matrix[6] * z + matrix[7]) * scale,
    z: (matrix[8] * x + matrix[9] * y + matrix[10] * z + matrix[11]) * scale,
  }
}

/**
 * Synthesizes minimal SAT `point` records from corner samples for fallback display.
 *
 * @param points - World-space corner points collected from ACSH primitives.
 */
function pointsToSyntheticSat(points: Point3[]): string {
  const lines = points.map(
    point => `point $-1 ${point.x} ${point.y} ${point.z} #`,
  )
  lines.push('End-of-ACIS-data')
  return lines.join('\n')
}

export type { CommonDXFObject, DxfObjectByHandle }
