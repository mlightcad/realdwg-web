/**
 * ACIS/ASM geometry decoding, B-rep extraction, and wireframe helpers.
 *
 * @packageDocumentation
 */
export { parseAcDbAcisSab, AcDbAcisSabTag } from './AcDbAcisSab'
export type {
  AcDbAcisSabData,
  AcDbAcisSabHeader,
  AcDbAcisSabRecord,
  AcDbAcisSabToken,
  AcDbAcisSabTokenValue,
  AcDbAcisSabVector,
} from './AcDbAcisSab'
export { buildAcDbAcisModel } from './AcDbAcisEntities'
export type { AcDbAcisModel, AcDbAcisNode } from './AcDbAcisEntities'
export {
  decodeAcDbAcisModel,
  findAcDbAcisSabSignatureOffset,
  isAcDbAcisSabPayload,
} from './AcDbAcisDecode'
export {
  acDbAcisEdgeParamBounds,
  acDbAcisParseSurfaceParams,
  extractAcDbAcisGeometry,
  sampleAcDbAcisEllipseArc,
  sampleAcDbAcisSphereWireframe,
} from './AcDbAcisGeometry'
export type {
  AcDbAcisBBox,
  AcDbAcisConeParams,
  AcDbAcisCurveKind,
  AcDbAcisCurveParams,
  AcDbAcisEdge,
  AcDbAcisEllipseCurveParams,
  AcDbAcisFace,
  AcDbAcisFaceLoop,
  AcDbAcisGeometry,
  AcDbAcisGeometrySummary,
  AcDbAcisIntCurveParams,
  AcDbAcisMesh,
  AcDbAcisPlaneParams,
  AcDbAcisSphereParams,
  AcDbAcisStraightCurveParams,
  AcDbAcisSurfaceKind,
  AcDbAcisSurfaceParams,
  AcDbAcisTessellationOptions,
  AcDbAcisTorusParams,
  AcDbAcisTriangleMesh,
  AcDbAcisVec3,
  AcDbAcisVertex,
} from './AcDbAcisGeometry'
export {
  acdbAcisWireframeSegmentsFromGeometry as acDbAcisWireframeSegmentsFromGeometry,
  acdbAcisWireframeSegmentsFromSab as acDbAcisWireframeSegmentsFromSab,
} from './AcDbAcisWireframe'
export { acDbAcisWireframeSegmentsFromSatText } from './AcDbAcisSatWireframe'
