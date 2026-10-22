/**
 * ACIS/ASM geometry decoding, B-rep extraction, and wireframe helpers.
 *
 * @packageDocumentation
 */
export {
  acdbAppendAcisPayloadFragment,
  acdbDecryptAcisData,
  acdbIsEncryptedAcisData,
  acdbJoinAcisObjectChunks,
  acdbJoinAcisPayloadLines,
  acdbNormalizeAcisData
} from './AcDbAcisDecrypt.js'
export { acdbParseAcisSab, AcDbAcisSabTag } from './AcDbAcisSab.js'
export type {
  AcDbAcisSabData,
  AcDbAcisSabHeader,
  AcDbAcisSabRecord,
  AcDbAcisSabToken,
  AcDbAcisSabTokenValue,
  AcDbAcisSabVector,
} from './AcDbAcisSab.js'
export { acdbBuildAcisModel } from './AcDbAcisEntities.js'
export type { AcDbAcisModel, AcDbAcisNode } from './AcDbAcisEntities.js'
export {
  acdbDecodeAcisModel,
  acdbFindAcisSabSignatureOffset,
  acdbIsAcisSabPayload,
} from './AcDbAcisDecode.js'
export {
  acdbAcisEdgeParamBounds,
  acdbAcisParseSurfaceParams,
  acdbExtractAcisGeometry,
  acdbSampleAcisEllipseArc,
  acdbSampleAcisSphereWireframe,
} from './AcDbAcisGeometry.js'
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
} from './AcDbAcisGeometry.js'
export {
  acdbAcisWireframeSegmentsFromGeometry,
  acdbAcisWireframeSegmentsFromSab,
} from './AcDbAcisWireframe.js'
export { acdbAcisWireframeSegmentsFromSatText } from './AcDbAcisSatWireframe.js'
export {
  acdbAcisBuildNodeTransforms,
  acdbAcisIdentityTransform,
  acdbAcisModelSpaceTransform,
  acdbAcisParseTransform,
  acdbAcisTransformDirection,
  acdbAcisTransformFromBody,
  acdbAcisTransformIsIdentity,
  acdbAcisTransformPoint,
  acdbAcisTransformSegments,
  acdbAcisTransformsEqual,
} from './AcDbAcisTransform.js'
export type { AcDbAcisAffineTransform } from './AcDbAcisTransform.js'
