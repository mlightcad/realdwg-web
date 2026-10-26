export { AcDbAngleUnits } from './AcDbAngleUnits.js'
export {
  ACDB_ANNOTATIVE_XDATA_APP,
  ACDB_VIEWPORT_ANNOTATION_SCALE_XREC,
  acdbAnnotativeModelHeight,
  acdbAnnotativePaperHeight,
  acdbBuildAnnotationScaleDrawInfo,
  acdbFindScale,
  acdbGetAnnotationScaleContexts,
  acdbGetViewportAnnotationScale,
  acdbIsAnnotativeObject,
  acdbMatchAnnotationScaleContext
} from './AcDbAnnotationScale.js'
export type {
  AcDbAnnotationScaleContext,
  AcDbAnnotationScaleDrawInfo
} from './AcDbAnnotationScale.js'
export { AcDbFormatter } from './AcDbFormatter.js'
export type { AcDbFormatterOptions } from './AcDbFormatter.js'
export { AcDbLinearUnits } from './AcDbLinearUnits.js'
export { AcDbRenderingCache } from './AcDbRenderingCache.js'
export type { AcDbRenderingCacheProfileStats } from './AcDbRenderingCache.js'
export {
  AcDbCodePage,
  acdbDwgCodePageToEncoding,
  acdbNormalizeTextEncoding,
  acdbResolveDwgCodePage,
  acdbResolveDwgCodePageEncoding
} from './AcDbCodePage.js'
export {
  ACAD_APPID,
  acdbCoerceIntegerSysVar,
  acdbIntegerSysVarIfInRange,
  ACDB_COMPAREHATCH_DEFAULT,
  ACDB_COMPAREHATCH_MAX,
  ACDB_COMPAREHATCH_MIN,
  ACDB_COMPAREPROPS_COLOR,
  ACDB_COMPAREPROPS_DEFAULT,
  ACDB_COMPAREPROPS_LAYER,
  ACDB_COMPAREPROPS_LINETYPE,
  ACDB_COMPAREPROPS_LINETYPESCALE,
  ACDB_COMPAREPROPS_LINEWEIGHT,
  ACDB_COMPAREPROPS_MAX,
  ACDB_COMPAREPROPS_MIN,
  ACDB_COMPAREPROPS_THICKNESS,
  ACDB_COMPAREPROPS_TRANSPARENCY,
  ACDB_COMPARERCMARGIN_DEFAULT,
  ACDB_COMPARERCMARGIN_MAX,
  ACDB_COMPARERCMARGIN_MIN,
  ACDB_COMPARETEXT_DEFAULT,
  ACDB_COMPARETEXT_MAX,
  ACDB_COMPARETEXT_MIN,
  ACDB_COMPARETOLERANCE_DEFAULT,
  ACDB_COMPARETOLERANCE_MAX,
  ACDB_COMPARETOLERANCE_MIN,
  ACDB_GRIPCOLOR_DEFAULT,
  ACDB_GRIPCOLOR_MAX,
  ACDB_GRIPCOLOR_MIN,
  ACDB_GRIPHOT_DEFAULT,
  ACDB_GRIPHOT_MAX,
  ACDB_GRIPHOT_MIN,
  ACDB_GRIPS_MAX,
  ACDB_GRIPS_MIN,
  ACDB_GRIPSIZE_DEFAULT,
  ACDB_GRIPSIZE_MAX,
  ACDB_GRIPSIZE_MIN,
  ACDB_GRIPOBJLIMIT_MAX,
  ACDB_GRIPOBJLIMIT_MIN,
  ACTIVE_VPORT_NAME,
  ByBlock,
  ByLayer,
  DEFAULT_GRADIENT_HATCH_NAME,
  DEFAULT_HATCH_PATTERN_IMPERIAL,
  DEFAULT_HATCH_PATTERN_METRIC,
  DEFAULT_LINE_TYPE,
  DEFAULT_MLEADER_STYLE,
  DEFAULT_MLINE_STYLE,
  DEFAULT_TEXT_STYLE,
  HATCH_PATTERN_SOLID,
  acdbIsSolidHatchPatternName,
  HATCH_PATTERN_USER,
  MLIGHTCAD_APPID,
  VPORT_FALLBACK_CENTER_2D,
  VPORT_FALLBACK_LLC,
  VPORT_FALLBACK_URC,
  VPORT_FALLBACK_VIEW_DIR,
  VPORT_FALLBACK_VIEW_TARGET
} from './AcDbConstants.js'
export { AcDbDataGenerator } from './AcDbDataGenerator.js'
export { AcDbDimArrowType } from './AcDbDimArrowType.js'
export {
  RAW_COLOR_TYPE_ACI,
  RAW_COLOR_TYPE_BY_BLOCK,
  RAW_COLOR_TYPE_BY_LAYER,
  RAW_COLOR_TYPE_RGB,
  RAW_COLOR_TYPE_WINDOW_BG,
  acdbDecodeDimStyleColor,
  acdbDecodeMLeaderStyleRawColor,
  acdbNormalizeDimStyleColorNumber,
  type AcDbDwgColorLike
} from './AcDbMLeaderStyleColorCodec.js'
export {
  ACDB_DRAW_CIRCLE_SIDES_DRAFT,
  ACDB_DRAW_CIRCLE_SIDES_HIGH,
  ACDB_DRAW_CIRCLE_SIDES_STANDARD,
  acdbDrawCircleSides,
  acdbDrawTessellateOptions,
  acdbResolveCircleSides
} from './AcDbDrawTessellate.js'
export {
  acdbEstimateDatabaseMemory,
  acdbFormatMemoryEstimate
} from './AcDbMemoryEstimator.js'
export type {
  AcDbMemoryEstimate,
  AcDbMemoryEstimateBucket,
  AcDbMemoryEstimateOptions
} from './AcDbMemoryEstimator.js'
export { AcDbObjectIterator } from './AcDbObjectIterator.js'
export { AcDbIntersect } from './AcDbIntersect.js'
export {
  ACDB_OLE2FRAME_GEOMETRY_HEADER_SIZE,
  acdbParseOle2FrameGeometryHeader
} from './AcDbOle2FrameGeometry.js'
export type { AcDbOle2FrameGeometryHeader } from './AcDbOle2FrameGeometry.js'
export { acdbExtractOleImageBlob } from './AcDbOleImageExtractor.js'
export {
  ACDB_OLE_METAFILE_EMF_MIME,
  ACDB_OLE_METAFILE_WMF_MIME,
  acdbIsOleMetafileMimeType,
  acdbLooksLikeEmf,
  acdbLooksLikeWmf,
  acdbReassembleEmfFromWmfEscapes
} from './AcDbOleMetafileDetect.js'
export {
  acdbOleBlobNeedsMetafileRasterization,
  acdbRasterizeOleMetafile
} from './AcDbOleMetafileRasterizer.js'
export type { AcDbOleMetafileRasterizeOptions } from './AcDbOleMetafileRasterizer.js'
export {
  AcDbOsnapMode,
  acdbHasOsnapMode,
  acdbMaskToOsnapModes,
  acdbOsnapModesToMask,
  acdbToggleOsnapMode
} from './AcDbOsnapMode.js'
export { AcDbUnitsValue } from './AcDbUnitsValue.js'
export {
  AcDbPatParser,
  AcDbPatSvgRenderer,
  AcDbPredefinedAcadIsoPat,
  AcDbPredefinedAcadPat
} from './pat/index.js'
export {
  AcDbProxyGraphic,
  AcDbProxyGraphicType,
  ACDB_PROXY_GRAPHIC_CHUNK_SIZE
} from './proxyGraphic/index.js'
export {
  AcDbProxyGraphicBitStream,
  AcDbProxyGraphicByteStream,
  AcDbProxyGraphicEndOfBufferError,
  acdbBytesToHexString,
  acdbCombineDxfBinaryChunks,
  acdbHexStringsToBytes
} from './proxyGraphic/index.js'
export { acdbPreviewIconToDataUrl, acdbThumbnailImageToDataUrl } from './AcDbPreviewIcon.js'
export type {
  AcDbPatDocument,
  AcDbPatGradientColor,
  AcDbPatGradientPreviewOptions,
  AcDbPatLine,
  AcDbPatParseIssue,
  AcDbPatPattern,
  AcDbPatPreviewOptions
} from './pat/index.js'
export {
  ACDB_DYN_BLOCK_ENHANCED_BLOCK,
  ACDB_DYN_BLOCK_GUID_APP,
  ACDB_DYN_BLOCK_REP_BTAG_APP,
  ACDB_DYN_BLOCK_REP_DATA,
  ACDB_DYN_BLOCK_REP_ETAG_APP,
  ACDB_DYN_BLOCK_REPRESENTATION_DICT,
  ACDB_DYN_BLOCK_TRUE_NAME_APP,
  acdbIsAnonymousUserBlockName
} from './AcDbDynBlockConstants.js'
export {
  acdbImportDynBlockMetadata,
  acdbNormalizeExtensionDictionaryId
} from './AcDbImportDynBlockMetadata.js'
export type {
  AcDbDynBlockDictionarySource,
  AcDbDynBlockRepresentationSource,
  AcDbImportDynBlockMetadataOptions
} from './AcDbImportDynBlockMetadata.js'
