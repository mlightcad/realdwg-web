import {
  AcDbBlkRefObjectContextData,
  acdbDecodeMLeaderStyleRawColor,
  AcDbDictionaryVar,
  AcDbDimensionObjectContextData,
  AcDbHatchScaleContextData,
  AcDbLayerFilter,
  AcDbLayerIndex,
  AcDbLeaderObjectContextData,
  AcDbMLeaderObjectContextData,
  AcDbMLeaderStyle,
  AcDbMTextAttributeObjectContextData,
  AcDbMTextObjectContextData,
  AcDbObject,
  AcDbResultBuffer,
  AcDbScale,
  AcDbTextObjectContextData,
  AcDbXrecord,
  AcGePoint3d,
  AcGeVector3d
} from '@mlightcad/data-model'
import {
  DwgCommonObject,
  DwgLayerFilterObject,
  DwgLayerIndexObject,
  DwgMLeaderStyleObject,
  DwgXRecordObject
} from '@mlightcad/libredwg-web'

/** LibreDWG SCALE object (when exposed by libredwg-web). */
export interface LibreDwgScaleObject extends DwgCommonObject {
  name?: string
  paperUnits?: number
  drawingUnits?: number
  isUnitScale?: boolean
  flag?: number
}

/** LibreDWG DICTIONARYVAR object (when exposed by libredwg-web). */
export interface LibreDwgDictionaryVarObject extends DwgCommonObject {
  schema?: number
  value?: string
  strvalue?: string
}

/** LibreDWG MTEXTOBJECTCONTEXTDATA object (when exposed by libredwg-web). */
export interface LibreDwgMTextObjectContextDataObject extends DwgCommonObject {
  classVersion?: number
  isDefault?: boolean
  scaleId?: string
  scaleHandle?: string
  attachment?: number
  xAxisDir?: { x: number; y: number; z?: number }
  insertionPoint?: { x: number; y: number; z?: number }
  definedWidth?: number
  definedHeight?: number
  extentsWidth?: number
  extentsHeight?: number
  columnType?: number
}

/** LibreDWG dimension object-context-data (when exposed by libredwg-web). */
export interface LibreDwgDimensionObjectContextDataObject
  extends DwgCommonObject {
  classVersion?: number
  isDefault?: boolean
  scaleId?: string
  scaleHandle?: string
  /** Anonymous dim block name for this scale (DXF 2). */
  name?: string
  blockName?: string
  defPt?: { x: number; y: number; z?: number }
  definitionPoint?: { x: number; y: number; z?: number }
  dimLinePoint?: { x: number; y: number; z?: number }
  _11pt?: { x: number; y: number; z?: number }
}

/** Shared annot-scale context fields exposed by LibreDWG. */
export interface LibreDwgAnnotScaleContextDataObject extends DwgCommonObject {
  classVersion?: number
  isDefault?: boolean
  scaleId?: string
  scaleHandle?: string
}

export interface LibreDwgTextObjectContextDataObject
  extends LibreDwgAnnotScaleContextDataObject {
  horizontalMode?: number
  rotation?: number
  alignmentPoint?: { x: number; y: number; z?: number }
  position?: { x: number; y: number; z?: number }
}

export interface LibreDwgHatchScaleContextDataObject
  extends LibreDwgAnnotScaleContextDataObject {
  patternScale?: number
  scale?: number
}

export interface LibreDwgBlkRefObjectContextDataObject
  extends LibreDwgAnnotScaleContextDataObject {
  position?: { x: number; y: number; z?: number }
  insertionPoint?: { x: number; y: number; z?: number }
  rotation?: number
  scaleX?: number
  scaleY?: number
  scaleZ?: number
  xScale?: number
  yScale?: number
  zScale?: number
}

export interface LibreDwgMLeaderObjectContextDataObject
  extends LibreDwgAnnotScaleContextDataObject {
  contentScale?: number
  textHeight?: number
  arrowheadSize?: number
  arrowSize?: number
  textAnchor?: { x: number; y: number; z?: number }
  landingPoint?: { x: number; y: number; z?: number }
}

/**
 * Converts libredwg object records to AcDbObject instances.
 */
export class AcDbObjectConverter {
  /**
   * Converts a DWG MLEADERSTYLE object to an AcDbMLeaderStyle.
   */
  convertMLeaderStyle(style: DwgMLeaderStyleObject) {
    const dbObject = new AcDbMLeaderStyle()
    dbObject.unknown1 = style.unknown1
    if (style.contentType != null) dbObject.contentType = style.contentType
    if (style.drawMLeaderOrderType != null) {
      dbObject.drawMLeaderOrderType = style.drawMLeaderOrderType
    }
    if (style.drawLeaderOrderType != null) {
      dbObject.drawLeaderOrderType = style.drawLeaderOrderType
    }
    if (style.maxLeaderSegmentPoints != null) {
      dbObject.maxLeaderSegmentPoints = style.maxLeaderSegmentPoints
    }
    if (style.firstSegmentAngleConstraint != null) {
      dbObject.firstSegmentAngleConstraint = style.firstSegmentAngleConstraint
    }
    if (style.secondSegmentAngleConstraint != null) {
      dbObject.secondSegmentAngleConstraint = style.secondSegmentAngleConstraint
    }
    if (style.leaderLineType != null) {
      dbObject.leaderLineType = style.leaderLineType
    }
    if (style.leaderLineColor != null) {
      dbObject.leaderLineColor = acdbDecodeMLeaderStyleRawColor(
        style.leaderLineColor
      )
    }
    dbObject.leaderLineTypeId = style.leaderLineTypeId
    if (style.leaderLineWeight != null) {
      dbObject.leaderLineWeight = style.leaderLineWeight
    }
    if (style.landingEnabled != null) {
      dbObject.landingEnabled = style.landingEnabled
    }
    if (style.landingGap != null) dbObject.landingGap = style.landingGap
    if (style.doglegEnabled != null)
      dbObject.doglegEnabled = style.doglegEnabled
    if (style.doglegLength != null) dbObject.doglegLength = style.doglegLength
    if (style.description != null) dbObject.description = style.description
    dbObject.arrowheadId = style.arrowheadId
    if (style.arrowheadSize != null)
      dbObject.arrowheadSize = style.arrowheadSize
    if (style.defaultMTextContents != null) {
      dbObject.defaultMTextContents = style.defaultMTextContents
    }
    dbObject.textStyleId = style.textStyleId
    if (style.textLeftAttachmentType != null) {
      dbObject.textLeftAttachmentType = style.textLeftAttachmentType
    }
    if (style.textAngleType != null)
      dbObject.textAngleType = style.textAngleType
    if (style.textAlignmentType != null) {
      dbObject.textAlignmentType = style.textAlignmentType
    }
    if (style.textRightAttachmentType != null) {
      dbObject.textRightAttachmentType = style.textRightAttachmentType
    }
    if (style.textColor != null) {
      dbObject.textColor = acdbDecodeMLeaderStyleRawColor(style.textColor)
    }
    if (style.textHeight != null) dbObject.textHeight = style.textHeight
    if (style.textFrameEnabled != null) {
      dbObject.textFrameEnabled = style.textFrameEnabled
    }
    if (style.textAlignAlwaysLeft != null) {
      dbObject.textAlignAlwaysLeft = style.textAlignAlwaysLeft
    }
    if (style.alignSpace != null) dbObject.alignSpace = style.alignSpace
    dbObject.blockContentId = style.blockContentId
    if (style.blockContentColor != null) {
      dbObject.blockContentColor = acdbDecodeMLeaderStyleRawColor(
        style.blockContentColor
      )
    }
    if (style.blockContentScale) {
      dbObject.blockContentScale = {
        x: style.blockContentScale.x,
        y: style.blockContentScale.y,
        z: style.blockContentScale.z ?? 1
      }
    }
    if (style.blockContentScaleEnabled != null) {
      dbObject.blockContentScaleEnabled = style.blockContentScaleEnabled
    }
    if (style.blockContentRotation != null) {
      dbObject.blockContentRotation = style.blockContentRotation
    }
    if (style.blockContentRotationEnabled != null) {
      dbObject.blockContentRotationEnabled = style.blockContentRotationEnabled
    }
    if (style.blockContentConnectionType != null) {
      dbObject.blockContentConnectionType = style.blockContentConnectionType
    }
    if (style.scale != null) dbObject.scale = style.scale
    if (style.overwritePropertyValue != null) {
      dbObject.overwritePropertyValue = style.overwritePropertyValue
    }
    if (style.annotative != null) dbObject.annotative = style.annotative
    if (style.breakGapSize != null) dbObject.breakGapSize = style.breakGapSize
    if (style.textAttachmentDirection != null) {
      dbObject.textAttachmentDirection = style.textAttachmentDirection
    }
    if (style.bottomTextAttachmentDirection != null) {
      dbObject.bottomTextAttachmentDirection =
        style.bottomTextAttachmentDirection
    }
    if (style.topTextAttachmentDirection != null) {
      dbObject.topTextAttachmentDirection = style.topTextAttachmentDirection
    }
    dbObject.unknown2 = style.unknown2
    this.processCommonAttrs(style, dbObject)
    return dbObject
  }

  /**
   * Converts a DWG LAYER_FILTER object to an AcDbLayerFilter.
   *
   * @param filter - The DWG layer filter object to convert
   * @returns The converted AcDbLayerFilter instance
   */
  convertLayerFilter(filter: DwgLayerFilterObject) {
    const dbObject = new AcDbLayerFilter()
    if (filter.layerNames?.length) {
      dbObject.layerNames = filter.layerNames
    }
    this.processCommonAttrs(filter, dbObject)
    return dbObject
  }

  /**
   * Converts a DWG LAYER_INDEX object to an AcDbLayerIndex.
   *
   * @param index - The DWG layer index object to convert
   * @returns The converted AcDbLayerIndex instance
   */
  convertLayerIndex(index: DwgLayerIndexObject) {
    const dbObject = new AcDbLayerIndex()
    if (index.timeStamp != null) {
      dbObject.lastUpdatedAt = index.timeStamp
      dbObject.lastUpdatedAtU = index.timeStamp
    }
    if (index.layerNames?.length) {
      dbObject.layerNames = index.layerNames
    }
    if (index.idBufferIds?.length) {
      dbObject.idBufferIds = index.idBufferIds
    }
    if (index.idBufferEntryCounts?.length) {
      dbObject.idBufferEntryCounts = index.idBufferEntryCounts
    }
    dbObject.isUptoDate = true
    this.processCommonAttrs(index, dbObject)
    return dbObject
  }

  convertScale(scale: LibreDwgScaleObject) {
    const dbObject = new AcDbScale()
    if (scale.flag != null) dbObject.classVersion = scale.flag
    dbObject.scaleName = scale.name ?? ''
    dbObject.paperUnits = scale.paperUnits ?? 1
    dbObject.drawingUnits = scale.drawingUnits ?? 1
    dbObject.isUnitScale = !!scale.isUnitScale
    this.processCommonAttrs(scale, dbObject)
    return dbObject
  }

  convertDictionaryVar(dictVar: LibreDwgDictionaryVarObject) {
    const dbObject = new AcDbDictionaryVar()
    if (dictVar.schema != null) dbObject.schema = dictVar.schema
    dbObject.value = dictVar.value ?? dictVar.strvalue ?? ''
    this.processCommonAttrs(dictVar, dbObject)
    return dbObject
  }

  convertMTextObjectContextData(
    context: LibreDwgMTextObjectContextDataObject
  ) {
    const dbObject = new AcDbMTextObjectContextData()
    if (context.classVersion != null) dbObject.classVersion = context.classVersion
    dbObject.isDefault = !!context.isDefault
    dbObject.scaleId = context.scaleId ?? context.scaleHandle ?? ''
    if (context.attachment != null) dbObject.attachmentPoint = context.attachment
    if (context.xAxisDir) {
      dbObject.direction = new AcGeVector3d(
        context.xAxisDir.x,
        context.xAxisDir.y,
        context.xAxisDir.z ?? 0
      )
    }
    if (context.insertionPoint) {
      dbObject.insertionPoint = new AcGePoint3d(
        context.insertionPoint.x,
        context.insertionPoint.y,
        context.insertionPoint.z ?? 0
      )
    }
    if (context.definedWidth != null) dbObject.definedWidth = context.definedWidth
    if (context.definedHeight != null) {
      dbObject.definedHeight = context.definedHeight
    }
    if (context.extentsWidth != null) dbObject.extentsWidth = context.extentsWidth
    if (context.extentsHeight != null) {
      dbObject.extentsHeight = context.extentsHeight
    }
    if (context.columnType != null) dbObject.columnType = context.columnType
    this.processCommonAttrs(context, dbObject)
    return dbObject
  }

  convertDimensionObjectContextData(
    context: LibreDwgDimensionObjectContextDataObject
  ) {
    const dbObject = new AcDbDimensionObjectContextData()
    if (context.classVersion != null) {
      dbObject.classVersion = context.classVersion
    }
    dbObject.isDefault = !!context.isDefault
    dbObject.scaleId = context.scaleId ?? context.scaleHandle ?? ''
    dbObject.blockName = context.blockName ?? context.name ?? ''
    const def = context.definitionPoint ?? context.defPt
    if (def) {
      dbObject.definitionPoint = new AcGePoint3d(def.x, def.y, def.z ?? 0)
    }
    const dimLine = context.dimLinePoint ?? context._11pt
    if (dimLine) {
      dbObject.dimLinePoint = new AcGePoint3d(
        dimLine.x,
        dimLine.y,
        dimLine.z ?? 0
      )
    }
    this.processCommonAttrs(context, dbObject)
    return dbObject
  }

  convertTextObjectContextData(context: LibreDwgTextObjectContextDataObject) {
    const dbObject = new AcDbTextObjectContextData()
    this.applyAnnotScaleContextBase(context, dbObject)
    if (context.horizontalMode != null) {
      dbObject.horizontalMode = context.horizontalMode
    }
    if (context.rotation != null) dbObject.rotation = context.rotation
    if (context.alignmentPoint) {
      dbObject.alignmentPoint = new AcGePoint3d(
        context.alignmentPoint.x,
        context.alignmentPoint.y,
        context.alignmentPoint.z ?? 0
      )
    }
    if (context.position) {
      dbObject.position = new AcGePoint3d(
        context.position.x,
        context.position.y,
        context.position.z ?? 0
      )
    }
    this.processCommonAttrs(context, dbObject)
    return dbObject
  }

  convertHatchScaleContextData(
    context: LibreDwgHatchScaleContextDataObject
  ) {
    const dbObject = new AcDbHatchScaleContextData()
    this.applyAnnotScaleContextBase(context, dbObject)
    const patternScale = context.patternScale ?? context.scale
    if (patternScale != null && patternScale > 0) {
      dbObject.patternScale = patternScale
    }
    this.processCommonAttrs(context, dbObject)
    return dbObject
  }

  convertBlkRefObjectContextData(
    context: LibreDwgBlkRefObjectContextDataObject
  ) {
    const dbObject = new AcDbBlkRefObjectContextData()
    this.applyAnnotScaleContextBase(context, dbObject)
    const pos = context.position ?? context.insertionPoint
    if (pos) {
      dbObject.position = new AcGePoint3d(pos.x, pos.y, pos.z ?? 0)
    }
    if (context.rotation != null) dbObject.rotation = context.rotation
    const sx = context.scaleX ?? context.xScale
    const sy = context.scaleY ?? context.yScale
    const sz = context.scaleZ ?? context.zScale
    if (sx != null) dbObject.scaleX = sx
    if (sy != null) dbObject.scaleY = sy
    if (sz != null) dbObject.scaleZ = sz
    this.processCommonAttrs(context, dbObject)
    return dbObject
  }

  convertLeaderObjectContextData(
    context: LibreDwgAnnotScaleContextDataObject
  ) {
    const dbObject = new AcDbLeaderObjectContextData()
    this.applyAnnotScaleContextBase(context, dbObject)
    this.processCommonAttrs(context, dbObject)
    return dbObject
  }

  convertMLeaderObjectContextData(
    context: LibreDwgMLeaderObjectContextDataObject
  ) {
    const dbObject = new AcDbMLeaderObjectContextData()
    this.applyAnnotScaleContextBase(context, dbObject)
    if (context.contentScale != null && context.contentScale > 0) {
      dbObject.contentScale = context.contentScale
    }
    if (context.textHeight != null && context.textHeight > 0) {
      dbObject.textHeight = context.textHeight
    }
    const arrow = context.arrowheadSize ?? context.arrowSize
    if (arrow != null && arrow > 0) dbObject.arrowheadSize = arrow
    const anchor = context.textAnchor ?? context.landingPoint
    if (anchor) {
      dbObject.textAnchor = new AcGePoint3d(
        anchor.x,
        anchor.y,
        anchor.z ?? 0
      )
    }
    this.processCommonAttrs(context, dbObject)
    return dbObject
  }

  convertMTextAttributeObjectContextData(
    context: LibreDwgMTextObjectContextDataObject
  ) {
    const dbObject = new AcDbMTextAttributeObjectContextData()
    if (context.classVersion != null) dbObject.classVersion = context.classVersion
    dbObject.isDefault = !!context.isDefault
    dbObject.scaleId = context.scaleId ?? context.scaleHandle ?? ''
    if (context.attachment != null) dbObject.attachmentPoint = context.attachment
    if (context.xAxisDir) {
      dbObject.direction = new AcGeVector3d(
        context.xAxisDir.x,
        context.xAxisDir.y,
        context.xAxisDir.z ?? 0
      )
    }
    if (context.insertionPoint) {
      dbObject.insertionPoint = new AcGePoint3d(
        context.insertionPoint.x,
        context.insertionPoint.y,
        context.insertionPoint.z ?? 0
      )
    }
    if (context.definedWidth != null) dbObject.definedWidth = context.definedWidth
    if (context.definedHeight != null) {
      dbObject.definedHeight = context.definedHeight
    }
    if (context.extentsWidth != null) dbObject.extentsWidth = context.extentsWidth
    if (context.extentsHeight != null) {
      dbObject.extentsHeight = context.extentsHeight
    }
    if (context.columnType != null) dbObject.columnType = context.columnType
    this.processCommonAttrs(context, dbObject)
    return dbObject
  }

  convertXRecord(xrecord: DwgXRecordObject) {
    const dbObject = new AcDbXrecord()
    this.processCommonAttrs(xrecord, dbObject)
    if (xrecord.extensionDictionary) {
      dbObject.extensionDictionary = xrecord.extensionDictionary
    }
    dbObject.data = new AcDbResultBuffer(
      (xrecord.data ?? []).map(group => ({
        code: Number(group.code),
        value: group.value
      }))
    )
    return dbObject
  }

  private applyAnnotScaleContextBase(
    context: LibreDwgAnnotScaleContextDataObject,
    dbObject: {
      classVersion: number
      isDefault: boolean
      scaleId: string
    }
  ) {
    if (context.classVersion != null) {
      dbObject.classVersion = context.classVersion
    }
    dbObject.isDefault = !!context.isDefault
    dbObject.scaleId = context.scaleId ?? context.scaleHandle ?? ''
  }

  private processCommonAttrs(object: DwgCommonObject, dbObject: AcDbObject) {
    dbObject.objectId = object.handle
    if (object.ownerHandle != null) {
      dbObject.ownerId = object.ownerHandle
    }
  }
}
