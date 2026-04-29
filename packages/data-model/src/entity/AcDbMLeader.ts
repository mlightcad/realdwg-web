import {
  AcGeBox3d,
  AcGeMatrix3d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGeVector3d,
  AcGeVector3dLike
} from '@mlightcad/geometry-engine'
import {
  AcGiEntity,
  AcGiMTextAttachmentPoint,
  AcGiMTextData,
  AcGiMTextFlowDirection,
  AcGiRenderer,
  AcGiTextStyle
} from '@mlightcad/graphic-interface'

import { AcDbDxfFiler } from '../base'
import { DEFAULT_TEXT_STYLE } from '../misc'
import { AcDbEntity } from './AcDbEntity'
import { AcDbEntityProperties } from './AcDbEntityProperties'

/**
 * Defines the type of leader line used by a multileader.
 */
export enum AcDbMLeaderLineType {
  /** The leader line is not displayed. */
  InvisibleLeader = 0,
  /** The leader line is drawn using straight segments. */
  StraightLeader = 1,
  /** The leader line is drawn as a spline. */
  SplineLeader = 2
}

/**
 * Defines the annotation content type used by a multileader.
 */
export enum AcDbMLeaderContentType {
  /** No annotation content. */
  NoneContent = 0,
  /** Block annotation content. */
  BlockContent = 1,
  /** MText annotation content. */
  MTextContent = 2,
  /** Tolerance annotation content. */
  ToleranceContent = 3
}

/**
 * Defines the attachment direction of multileader text.
 */
export enum AcDbMLeaderTextAttachmentDirection {
  /** Text is attached horizontally. */
  Horizontal = 0,
  /** Text is attached vertically. */
  Vertical = 1
}

/**
 * Defines the general direction of a leader branch.
 */
export enum AcDbMLeaderDirectionType {
  /** Direction is not known or not applicable. */
  Unknown = 0,
  /** Leader points to the left of the content. */
  Left = 1,
  /** Leader points to the right of the content. */
  Right = 2,
  /** Leader points above the content. */
  Top = 3,
  /** Leader points below the content. */
  Bottom = 4
}

export interface AcDbMLeaderBreakLike {
  index?: number
  start: AcGePoint3dLike
  end: AcGePoint3dLike
}

export interface AcDbMLeaderBreak {
  index?: number
  start: AcGePoint3d
  end: AcGePoint3d
}

export interface AcDbMLeaderLineLike {
  vertices?: AcGePoint3dLike[]
  breakPointIndexes?: number[]
  leaderLineIndex?: number
  breaks?: AcDbMLeaderBreakLike[]
}

export interface AcDbMLeaderLine {
  vertices: AcGePoint3d[]
  breakPointIndexes: number[]
  leaderLineIndex?: number
  breaks: AcDbMLeaderBreak[]
}

export interface AcDbMLeaderLeaderLike {
  lastLeaderLinePoint?: AcGePoint3dLike
  lastLeaderLinePointSet?: boolean
  landingPoint?: AcGePoint3dLike
  doglegVector?: AcGeVector3dLike
  doglegVectorSet?: boolean
  doglegLength?: number
  breaks?: AcDbMLeaderBreakLike[]
  leaderBranchIndex?: number
  directionType?: AcDbMLeaderDirectionType
  leaderLines?: AcDbMLeaderLineLike[]
}

export interface AcDbMLeaderLeader {
  lastLeaderLinePoint?: AcGePoint3d
  lastLeaderLinePointSet?: boolean
  landingPoint?: AcGePoint3d
  doglegVector?: AcGeVector3d
  doglegVectorSet?: boolean
  doglegLength?: number
  breaks: AcDbMLeaderBreak[]
  leaderBranchIndex?: number
  directionType?: AcDbMLeaderDirectionType
  leaderLines: AcDbMLeaderLine[]
}

export interface AcDbMLeaderMTextContentLike {
  text: string
  anchorPoint: AcGePoint3dLike
}

export interface AcDbMLeaderMTextContent {
  text: string
  anchorPoint: AcGePoint3d
}

export interface AcDbMLeaderBlockContentLike {
  blockContentId?: string
  blockHandle?: string
  normal?: AcGeVector3dLike
  position?: AcGePoint3dLike
  scale?: AcGeVector3dLike
  rotation?: number
  color?: number
  transformationMatrix?: number[]
}

export interface AcDbMLeaderBlockContent {
  blockContentId?: string
  blockHandle?: string
  normal?: AcGeVector3d
  position?: AcGePoint3d
  scale: AcGeVector3d
  rotation: number
  color?: number
  transformationMatrix: number[]
}

export interface AcDbMLeaderIndexedHandle {
  index: number
  handle?: string
}

export interface AcDbMLeaderBlockAttribute {
  id?: string
  index?: number
  width?: number
  text?: string
}

/**
 * Represents a multileader entity.
 *
 * A multileader contains one or more leader branches, each of which can contain
 * one or more leader lines, plus optional MText or block content.
 */
export class AcDbMLeader extends AcDbEntity {
  /** The entity type name. */
  static override typeName: string = 'MLeader'

  override get dxfTypeName() {
    return 'MULTILEADER'
  }

  private _leaders: AcDbMLeaderLeader[]
  private _leaderLineType: AcDbMLeaderLineType
  private _contentType: AcDbMLeaderContentType
  private _doglegEnabled: boolean
  private _doglegLength: number
  private _landingPoint?: AcGePoint3d
  private _doglegVector: AcGeVector3d
  private _normal: AcGeVector3d
  private _mleaderStyleId: string
  private _mtextContent?: AcDbMLeaderMTextContent
  private _textHeight: number
  private _textWidth: number
  private _textRotation: number
  private _textDirection: AcGeVector3d
  private _textStyleName: string
  private _textAttachmentPoint: AcGiMTextAttachmentPoint
  private _textDrawingDirection: AcGiMTextFlowDirection
  private _textLineSpacingFactor: number
  private _textAttachmentDirection: AcDbMLeaderTextAttachmentDirection
  private _blockContent?: AcDbMLeaderBlockContent

  version?: number
  leaderStyleId?: string
  propertyOverrideFlag?: number
  leaderLineColor?: number
  leaderLineTypeId?: string
  leaderLineWeight?: number
  landingEnabled?: boolean
  arrowheadId?: string
  arrowheadSize?: number
  textStyleId?: string
  textLeftAttachmentType?: number
  textRightAttachmentType?: number
  textAngleType?: number
  textAlignmentType?: number
  textColor?: number
  textFrameEnabled?: boolean
  landingGap?: number
  textAttachment?: number
  textFlowDirection?: number
  blockContentId?: string
  blockContentColor?: number
  blockContentScale?: AcGeVector3d
  blockContentRotation?: number
  blockContentConnectionType?: number
  annotativeScaleEnabled?: boolean
  arrowheadOverrides: AcDbMLeaderIndexedHandle[]
  blockAttributes: AcDbMLeaderBlockAttribute[]
  textDirectionNegative?: boolean
  textAlignInIPE?: number
  bottomTextAttachmentDirection?: number
  topTextAttachmentDirection?: number
  contentScale?: number
  contentBasePosition?: AcGePoint3d
  textAnchor?: AcGePoint3d
  textLineSpacingStyle?: number
  textBackgroundColor?: number
  textBackgroundScaleFactor?: number
  textBackgroundTransparency?: number
  textBackgroundColorOn?: boolean
  textFillOn?: boolean
  textColumnType?: number
  textUseAutoHeight?: boolean
  textColumnWidth?: number
  textColumnGutterWidth?: number
  textColumnFlowReversed?: boolean
  textColumnHeight?: number
  textUseWordBreak?: boolean
  hasMText?: boolean
  hasBlock?: boolean
  planeOrigin?: AcGePoint3d
  planeXAxisDirection?: AcGeVector3d
  planeYAxisDirection?: AcGeVector3d
  planeNormalReversed?: boolean

  constructor() {
    super()
    this._leaders = []
    this._leaderLineType = AcDbMLeaderLineType.StraightLeader
    this._contentType = AcDbMLeaderContentType.NoneContent
    this._doglegEnabled = false
    this._doglegLength = 0
    this._doglegVector = new AcGeVector3d(1, 0, 0)
    this._normal = new AcGeVector3d(0, 0, 1)
    this._mleaderStyleId = ''
    this._textHeight = 2.5
    this._textWidth = 0
    this._textRotation = 0
    this._textDirection = new AcGeVector3d(1, 0, 0)
    this._textStyleName = ''
    this._textAttachmentPoint = AcGiMTextAttachmentPoint.MiddleLeft
    this._textDrawingDirection = AcGiMTextFlowDirection.LEFT_TO_RIGHT
    this._textLineSpacingFactor = 1
    this._textAttachmentDirection =
      AcDbMLeaderTextAttachmentDirection.Horizontal
    this.arrowheadOverrides = []
    this.blockAttributes = []
  }

  get leaders() {
    return this._leaders.map(leader => this.cloneLeader(leader))
  }

  get numberOfLeaders() {
    return this._leaders.length
  }

  get leaderLineType() {
    return this._leaderLineType
  }
  set leaderLineType(value: AcDbMLeaderLineType) {
    this._leaderLineType = value
  }

  get contentType() {
    return this._contentType
  }
  set contentType(value: AcDbMLeaderContentType) {
    this._contentType = value
  }

  get doglegEnabled() {
    return this._doglegEnabled
  }
  set doglegEnabled(value: boolean) {
    this._doglegEnabled = value
  }

  get doglegLength() {
    return this._doglegLength
  }
  set doglegLength(value: number) {
    this._doglegLength = value
  }

  get doglegVector() {
    return this._doglegVector
  }
  set doglegVector(value: AcGeVector3dLike) {
    this._doglegVector.copy(value)
  }

  get landingPoint() {
    return this._landingPoint
  }
  set landingPoint(value: AcGePoint3dLike | undefined) {
    this._landingPoint = value ? this.createPoint(value) : undefined
  }

  get normal() {
    return this._normal
  }
  set normal(value: AcGeVector3dLike) {
    this._normal.copy(value)
  }

  get mleaderStyleId() {
    return this._mleaderStyleId
  }
  set mleaderStyleId(value: string) {
    this._mleaderStyleId = value
  }

  get leaderSections() {
    return this.leaders
  }

  get blockContentData() {
    return this.blockContent
  }

  get mtextContent() {
    return this._mtextContent
      ? {
          text: this._mtextContent.text,
          anchorPoint: this._mtextContent.anchorPoint.clone()
        }
      : undefined
  }
  set mtextContent(value: AcDbMLeaderMTextContentLike | undefined) {
    if (!value) {
      this._mtextContent = undefined
      if (this._contentType === AcDbMLeaderContentType.MTextContent) {
        this._contentType = AcDbMLeaderContentType.NoneContent
      }
      return
    }
    this._mtextContent = {
      text: value.text,
      anchorPoint: this.createPoint(value.anchorPoint)
    }
    this._contentType = AcDbMLeaderContentType.MTextContent
  }

  get contents() {
    return this._mtextContent?.text ?? ''
  }
  set contents(value: string) {
    if (!this._mtextContent) {
      this._mtextContent = {
        text: value,
        anchorPoint: new AcGePoint3d()
      }
    } else {
      this._mtextContent.text = value
    }
    this._contentType = AcDbMLeaderContentType.MTextContent
  }

  get textLocation() {
    return this._mtextContent?.anchorPoint
  }
  set textLocation(value: AcGePoint3dLike | undefined) {
    if (!value) {
      this._mtextContent = undefined
      return
    }
    if (!this._mtextContent) {
      this._mtextContent = {
        text: '',
        anchorPoint: this.createPoint(value)
      }
    } else {
      this._mtextContent.anchorPoint.copy(value)
    }
    this._contentType = AcDbMLeaderContentType.MTextContent
  }

  get textHeight() {
    return this._textHeight
  }
  set textHeight(value: number) {
    this._textHeight = value
  }

  get textWidth() {
    return this._textWidth
  }
  set textWidth(value: number) {
    this._textWidth = value
  }

  get textRotation() {
    return this._textRotation
  }
  set textRotation(value: number) {
    this._textRotation = value
  }

  get textDirection() {
    return this._textDirection
  }
  set textDirection(value: AcGeVector3dLike) {
    this._textDirection.copy(value)
  }

  get textStyleName() {
    return this._textStyleName
  }
  set textStyleName(value: string) {
    this._textStyleName = value
  }

  get textAttachmentPoint() {
    return this._textAttachmentPoint
  }
  set textAttachmentPoint(value: AcGiMTextAttachmentPoint) {
    this._textAttachmentPoint = value
  }

  get textDrawingDirection() {
    return this._textDrawingDirection
  }
  set textDrawingDirection(value: AcGiMTextFlowDirection) {
    this._textDrawingDirection = value
  }

  get textLineSpacingFactor() {
    return this._textLineSpacingFactor
  }
  set textLineSpacingFactor(value: number) {
    this._textLineSpacingFactor = value
  }

  get textAttachmentDirection() {
    return this._textAttachmentDirection
  }
  set textAttachmentDirection(value: AcDbMLeaderTextAttachmentDirection) {
    this._textAttachmentDirection = value
  }

  get blockContent() {
    return this._blockContent
      ? {
          blockContentId: this._blockContent.blockContentId,
          blockHandle: this._blockContent.blockHandle,
          normal: this._blockContent.normal?.clone(),
          position: this._blockContent.position?.clone(),
          scale: this._blockContent.scale.clone(),
          rotation: this._blockContent.rotation,
          color: this._blockContent.color,
          transformationMatrix: [...this._blockContent.transformationMatrix]
        }
      : undefined
  }
  set blockContent(value: AcDbMLeaderBlockContentLike | undefined) {
    if (!value) {
      this._blockContent = undefined
      if (this._contentType === AcDbMLeaderContentType.BlockContent) {
        this._contentType = AcDbMLeaderContentType.NoneContent
      }
      return
    }
    this._blockContent = {
      blockContentId: value.blockContentId ?? value.blockHandle,
      blockHandle: value.blockHandle,
      normal: value.normal ? new AcGeVector3d(value.normal) : undefined,
      position: value.position ? this.createPoint(value.position) : undefined,
      scale: new AcGeVector3d(value.scale ?? { x: 1, y: 1, z: 1 }),
      rotation: value.rotation ?? 0,
      color: value.color,
      transformationMatrix: value.transformationMatrix
        ? [...value.transformationMatrix]
        : []
    }
    this.blockContentId = this._blockContent.blockContentId
    this._contentType = AcDbMLeaderContentType.BlockContent
  }

  /**
   * Adds a leader branch and returns its index.
   */
  addLeader(leader: AcDbMLeaderLeaderLike = {}) {
    const dbLeader: AcDbMLeaderLeader = {
      lastLeaderLinePoint: leader.lastLeaderLinePoint
        ? this.createPoint(leader.lastLeaderLinePoint)
        : undefined,
      lastLeaderLinePointSet: leader.lastLeaderLinePointSet,
      landingPoint: leader.landingPoint
        ? this.createPoint(leader.landingPoint)
        : undefined,
      doglegVector: leader.doglegVector
        ? new AcGeVector3d(leader.doglegVector)
        : undefined,
      doglegVectorSet: leader.doglegVectorSet,
      doglegLength: leader.doglegLength,
      breaks:
        leader.breaks?.map(item => ({
          index: item.index,
          start: this.createPoint(item.start),
          end: this.createPoint(item.end)
        })) ?? [],
      leaderBranchIndex: leader.leaderBranchIndex,
      directionType: leader.directionType,
      leaderLines: []
    }
    leader.leaderLines?.forEach(line => {
      dbLeader.leaderLines.push(this.createLeaderLine(line))
    })
    this._leaders.push(dbLeader)
    return this._leaders.length - 1
  }

  /**
   * Removes a leader branch.
   */
  removeLeader(leaderIndex: number) {
    this.checkLeaderIndex(leaderIndex)
    this._leaders.splice(leaderIndex, 1)
    return this
  }

  /**
   * Adds a leader line to a leader branch and returns the line index.
   */
  addLeaderLine(leaderIndex: number, vertices: AcGePoint3dLike[] = []): number {
    this.checkLeaderIndex(leaderIndex)
    this._leaders[leaderIndex].leaderLines.push(
      this.createLeaderLine({ vertices })
    )
    return this._leaders[leaderIndex].leaderLines.length - 1
  }

  /**
   * Appends a vertex to one leader line.
   */
  appendVertex(
    leaderIndex: number,
    leaderLineIndex: number,
    point: AcGePoint3dLike
  ) {
    this.getMutableLeaderLine(leaderIndex, leaderLineIndex).vertices.push(
      this.createPoint(point)
    )
    return this
  }

  /**
   * Replaces the vertices of one leader line.
   */
  setLeaderLineVertices(
    leaderIndex: number,
    leaderLineIndex: number,
    vertices: AcGePoint3dLike[]
  ) {
    this.getMutableLeaderLine(leaderIndex, leaderLineIndex).vertices =
      vertices.map(point => this.createPoint(point))
    return this
  }

  getLeaderLineVertices(leaderIndex: number, leaderLineIndex: number) {
    return this.getMutableLeaderLine(leaderIndex, leaderLineIndex).vertices.map(
      point => point.clone()
    )
  }

  addBreak(
    leaderIndex: number,
    leaderLineIndex: number,
    start: AcGePoint3dLike,
    end: AcGePoint3dLike
  ) {
    this.getMutableLeaderLine(leaderIndex, leaderLineIndex).breaks.push({
      start: this.createPoint(start),
      end: this.createPoint(end)
    })
    return this
  }

  setLandingPoint(leaderIndex: number, point: AcGePoint3dLike | undefined) {
    this.checkLeaderIndex(leaderIndex)
    this._leaders[leaderIndex].landingPoint = point
      ? this.createPoint(point)
      : undefined
    return this
  }

  setDoglegDirection(leaderIndex: number, vector: AcGeVector3dLike) {
    this.checkLeaderIndex(leaderIndex)
    this._leaders[leaderIndex].doglegVector = new AcGeVector3d(vector)
    return this
  }

  setDoglegLength(leaderIndex: number, length: number | undefined) {
    this.checkLeaderIndex(leaderIndex)
    this._leaders[leaderIndex].doglegLength = length
    return this
  }

  get geometricExtents() {
    const points = this.collectGeometryPoints()
    return points.length > 0
      ? new AcGeBox3d().setFromPoints(points)
      : new AcGeBox3d()
  }

  subGetGripPoints() {
    return this.collectGeometryPoints().map(point => point.clone())
  }

  transformBy(matrix: AcGeMatrix3d) {
    this._leaders.forEach(leader => {
      leader.lastLeaderLinePoint?.applyMatrix4(matrix)
      leader.landingPoint?.applyMatrix4(matrix)
      if (leader.doglegVector) {
        this.transformVector(leader.doglegVector, matrix)
      }
      leader.breaks.forEach(item => {
        item.start.applyMatrix4(matrix)
        item.end.applyMatrix4(matrix)
      })
      leader.leaderLines.forEach(line => {
        line.vertices.forEach(point => point.applyMatrix4(matrix))
        line.breaks.forEach(item => {
          item.start.applyMatrix4(matrix)
          item.end.applyMatrix4(matrix)
        })
      })
    })
    this._landingPoint?.applyMatrix4(matrix)
    this.contentBasePosition?.applyMatrix4(matrix)
    this.transformVector(this._doglegVector, matrix)
    this.transformVector(this._normal, matrix)
    this.textAnchor?.applyMatrix4(matrix)
    this._mtextContent?.anchorPoint.applyMatrix4(matrix)
    this.transformVector(this._textDirection, matrix)
    this._blockContent?.position?.applyMatrix4(matrix)
    if (this._blockContent?.normal) {
      this.transformVector(this._blockContent.normal, matrix)
    }
    if (this.blockContentScale) {
      this.transformVector(this.blockContentScale, matrix)
    }
    this.planeOrigin?.applyMatrix4(matrix)
    if (this.planeXAxisDirection) {
      this.transformVector(this.planeXAxisDirection, matrix)
    }
    if (this.planeYAxisDirection) {
      this.transformVector(this.planeYAxisDirection, matrix)
    }
    return this
  }

  get properties(): AcDbEntityProperties {
    return {
      type: this.type,
      groups: [
        this.getGeneralProperties(),
        {
          groupName: 'leader',
          properties: [
            {
              name: 'contentType',
              type: 'enum',
              editable: true,
              options: [
                {
                  label:
                    AcDbMLeaderContentType[AcDbMLeaderContentType.NoneContent],
                  value: AcDbMLeaderContentType.NoneContent
                },
                {
                  label:
                    AcDbMLeaderContentType[AcDbMLeaderContentType.BlockContent],
                  value: AcDbMLeaderContentType.BlockContent
                },
                {
                  label:
                    AcDbMLeaderContentType[AcDbMLeaderContentType.MTextContent],
                  value: AcDbMLeaderContentType.MTextContent
                },
                {
                  label:
                    AcDbMLeaderContentType[
                      AcDbMLeaderContentType.ToleranceContent
                    ],
                  value: AcDbMLeaderContentType.ToleranceContent
                }
              ],
              accessor: {
                get: () => this.contentType,
                set: (value: AcDbMLeaderContentType) => {
                  this.contentType = value
                }
              }
            },
            {
              name: 'leaderLineType',
              type: 'enum',
              editable: true,
              options: [
                {
                  label:
                    AcDbMLeaderLineType[AcDbMLeaderLineType.InvisibleLeader],
                  value: AcDbMLeaderLineType.InvisibleLeader
                },
                {
                  label:
                    AcDbMLeaderLineType[AcDbMLeaderLineType.StraightLeader],
                  value: AcDbMLeaderLineType.StraightLeader
                },
                {
                  label: AcDbMLeaderLineType[AcDbMLeaderLineType.SplineLeader],
                  value: AcDbMLeaderLineType.SplineLeader
                }
              ],
              accessor: {
                get: () => this.leaderLineType,
                set: (value: AcDbMLeaderLineType) => {
                  this.leaderLineType = value
                }
              }
            },
            {
              name: 'doglegEnabled',
              type: 'boolean',
              editable: true,
              accessor: {
                get: () => this.doglegEnabled,
                set: (value: boolean) => {
                  this.doglegEnabled = value
                }
              }
            },
            {
              name: 'doglegLength',
              type: 'float',
              editable: true,
              accessor: {
                get: () => this.doglegLength,
                set: (value: number) => {
                  this.doglegLength = value
                }
              }
            },
            {
              name: 'leaderCount',
              type: 'int',
              editable: false,
              accessor: {
                get: () => this.numberOfLeaders
              }
            }
          ]
        },
        {
          groupName: 'text',
          properties: [
            {
              name: 'contents',
              type: 'string',
              editable: true,
              accessor: {
                get: () => this.contents,
                set: (value: string) => {
                  this.contents = value
                }
              }
            },
            {
              name: 'textHeight',
              type: 'float',
              editable: true,
              accessor: {
                get: () => this.textHeight,
                set: (value: number) => {
                  this.textHeight = value
                }
              }
            },
            {
              name: 'textWidth',
              type: 'float',
              editable: true,
              accessor: {
                get: () => this.textWidth,
                set: (value: number) => {
                  this.textWidth = value
                }
              }
            },
            {
              name: 'textStyleName',
              type: 'string',
              editable: true,
              accessor: {
                get: () => this.textStyleName,
                set: (value: string) => {
                  this.textStyleName = value
                }
              }
            }
          ]
        }
      ]
    }
  }

  subWorldDraw(
    renderer: AcGiRenderer
  ): AcGiEntity | undefined {
    const entities: AcGiEntity[] = []
    if (this.leaderLineType !== AcDbMLeaderLineType.InvisibleLeader) {
      this._leaders.forEach(leader => {
        leader.leaderLines.forEach(line => {
          const points = this.getLeaderLineDrawPoints(leader, line)
          if (points.length > 0) {
            entities.push(renderer.lines(points))
            const arrowPoints = this.getArrowheadPoints(points)
            if (arrowPoints) {
              entities.push(renderer.lines(arrowPoints))
            }
          }
        })
        const doglegPoints = this.getDoglegPoints(leader)
        if (doglegPoints) {
          entities.push(renderer.lines(doglegPoints))
        }
      })
    }

    if (
      this.contentType === AcDbMLeaderContentType.MTextContent &&
      this._mtextContent
    ) {
      const mtextData: AcGiMTextData = {
        text: this._mtextContent.text,
        height: this.textHeight,
        width: this.getMTextRenderWidth(),
        position: this._mtextContent.anchorPoint,
        rotation: this.textRotation,
        directionVector: this.textDirection,
        attachmentPoint: this.textAttachmentPoint,
        drawingDirection: this.textDrawingDirection,
        lineSpaceFactor: this.textLineSpacingFactor
      }
      // MLeader draws multiple primitives as a group. Delayed MText rendering is
      // only scheduled for top-level entities, so render nested MText eagerly.
      entities.push(renderer.mtext(mtextData, this.getTextStyle(), false))
    }

    if (entities.length === 0) return undefined
    return entities.length === 1 ? entities[0] : renderer.group(entities)
  }

  /**
   * Writes a compact MULTILEADER representation for DXF export.
   *
   * The data model keeps the full leader graph for consumers even though DXF's
   * native MULTILEADER encoding is much more verbose than most entities.
   */
  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbMLeader')
    filer.writeInt16(170, this.leaderLineType)
    filer.writeBoolean(290, this.doglegEnabled)
    filer.writeDouble(41, this.doglegLength)
    filer.writeInt16(172, this.contentType)
    filer.writeVector3d(210, this.normal)
    filer.writeHandle(340, this.mleaderStyleId)
    if (this._landingPoint) filer.writePoint3d(10, this._landingPoint)
    filer.writeVector3d(11, this.doglegVector)

    if (this._mtextContent) {
      filer.writeString(1, this._mtextContent.text)
      filer.writePoint3d(12, this._mtextContent.anchorPoint)
      filer.writeDouble(40, this.textHeight)
      filer.writeDouble(42, this.textWidth)
      filer.writeAngle(50, this.textRotation)
      filer.writeString(7, this.textStyleName)
    }
    if (this._blockContent) {
      filer.writeHandle(341, this._blockContent.blockContentId ?? '')
      if (this._blockContent.position) {
        filer.writePoint3d(15, this._blockContent.position)
      }
      filer.writeVector3d(16, this._blockContent.scale)
      filer.writeAngle(52, this._blockContent.rotation)
    }

    this._leaders.forEach(leader => {
      if (leader.landingPoint) filer.writePoint3d(110, leader.landingPoint)
      if (leader.doglegVector) filer.writeVector3d(111, leader.doglegVector)
      filer.writeDouble(140, leader.doglegLength)
      filer.writeInt16(171, leader.leaderLines.length)
      leader.leaderLines.forEach(line => {
        filer.writeInt16(90, line.vertices.length)
        line.vertices.forEach(point => filer.writePoint3d(10, point))
      })
    })
    return this
  }

  private createPoint(point: AcGePoint3dLike) {
    return new AcGePoint3d().copy(point)
  }

  private createLeaderLine(line: AcDbMLeaderLineLike): AcDbMLeaderLine {
    return {
      vertices: line.vertices?.map(point => this.createPoint(point)) ?? [],
      breakPointIndexes: line.breakPointIndexes
        ? [...line.breakPointIndexes]
        : [],
      leaderLineIndex: line.leaderLineIndex,
      breaks:
        line.breaks?.map(item => ({
          index: item.index,
          start: this.createPoint(item.start),
          end: this.createPoint(item.end)
        })) ?? []
    }
  }

  private cloneLeader(leader: AcDbMLeaderLeader): AcDbMLeaderLeader {
    return {
      lastLeaderLinePoint: leader.lastLeaderLinePoint?.clone(),
      lastLeaderLinePointSet: leader.lastLeaderLinePointSet,
      landingPoint: leader.landingPoint?.clone(),
      doglegVector: leader.doglegVector?.clone(),
      doglegVectorSet: leader.doglegVectorSet,
      doglegLength: leader.doglegLength,
      breaks: leader.breaks.map(item => ({
        index: item.index,
        start: item.start.clone(),
        end: item.end.clone()
      })),
      leaderBranchIndex: leader.leaderBranchIndex,
      directionType: leader.directionType,
      leaderLines: leader.leaderLines.map(line => ({
        vertices: line.vertices.map(point => point.clone()),
        breakPointIndexes: [...line.breakPointIndexes],
        leaderLineIndex: line.leaderLineIndex,
        breaks: line.breaks.map(item => ({
          index: item.index,
          start: item.start.clone(),
          end: item.end.clone()
        }))
      }))
    }
  }

  private checkLeaderIndex(leaderIndex: number) {
    if (leaderIndex < 0 || leaderIndex >= this._leaders.length) {
      throw new Error('The leader index is out of range!')
    }
  }

  private getMutableLeaderLine(
    leaderIndex: number,
    leaderLineIndex: number
  ): AcDbMLeaderLine {
    this.checkLeaderIndex(leaderIndex)
    const line = this._leaders[leaderIndex].leaderLines[leaderLineIndex]
    if (!line) {
      throw new Error('The leader line index is out of range!')
    }
    return line
  }

  private collectGeometryPoints() {
    const points: AcGePoint3d[] = []
    this._leaders.forEach(leader => {
      if (leader.lastLeaderLinePoint) points.push(leader.lastLeaderLinePoint)
      if (leader.landingPoint) points.push(leader.landingPoint)
      leader.breaks.forEach(item => points.push(item.start, item.end))
      leader.leaderLines.forEach(line => {
        points.push(...line.vertices)
        line.breaks.forEach(item => points.push(item.start, item.end))
      })
      const doglegPoints = this.getDoglegPoints(leader)
      if (doglegPoints) points.push(...doglegPoints)
      leader.leaderLines.forEach(line => {
        const arrowPoints = this.getArrowheadPoints(
          this.getLeaderLineDrawPoints(leader, line)
        )
        if (arrowPoints) points.push(...arrowPoints)
      })
    })
    if (this._landingPoint) points.push(this._landingPoint)
    if (this.contentBasePosition) points.push(this.contentBasePosition)
    if (this.textAnchor) points.push(this.textAnchor)
    if (this._mtextContent) points.push(this._mtextContent.anchorPoint)
    if (this._blockContent?.position) points.push(this._blockContent.position)
    if (this.planeOrigin) points.push(this.planeOrigin)
    return points
  }

  private getLeaderLineDrawPoints(
    leader: AcDbMLeaderLeader,
    line: AcDbMLeaderLine
  ) {
    if (line.vertices.length >= 2) return line.vertices
    if (line.vertices.length === 0) return []

    const end =
      leader.lastLeaderLinePoint ??
      leader.landingPoint ??
      this._landingPoint ??
      this.contentBasePosition
    if (!end || line.vertices[0].equals(end)) return line.vertices
    return [line.vertices[0], end]
  }

  private getDoglegPoints(leader: AcDbMLeaderLeader) {
    if (!this.doglegEnabled) return undefined
    const start =
      leader.lastLeaderLinePoint ??
      leader.landingPoint ??
      this._landingPoint ??
      this.getLastLeaderLineVertex(leader)
    const vector = leader.doglegVector ?? this._doglegVector
    const length = leader.doglegLength ?? this._doglegLength
    if (!start || length === 0 || vector.lengthSq() === 0) return undefined

    const end = start
      .clone()
      .add(vector.clone().normalize().multiplyScalar(length))
    return [start, end]
  }

  private getLastLeaderLineVertex(leader: AcDbMLeaderLeader) {
    for (let i = leader.leaderLines.length - 1; i >= 0; i--) {
      const line = leader.leaderLines[i]
      if (line.vertices.length > 0) {
        return line.vertices[line.vertices.length - 1]
      }
    }
    return undefined
  }

  private getArrowheadPoints(points: AcGePoint3d[]) {
    if (!this.isArrowheadVisible() || points.length < 2) return undefined

    const tip = points[0]
    const next = points.find(point => !point.equals(tip))
    if (!next) return undefined

    const direction = new AcGeVector3d().subVectors(next, tip)
    if (direction.lengthSq() === 0) return undefined

    const size = this.getArrowheadSize()
    const unit = direction.normalize()
    const baseCenter = tip.clone().add(unit.clone().multiplyScalar(size))
    const halfWidth = size / 6
    const perpendicular = new AcGeVector3d(-unit.y, unit.x, 0)

    const left = baseCenter
      .clone()
      .add(perpendicular.clone().multiplyScalar(halfWidth))
    const right = baseCenter
      .clone()
      .add(perpendicular.clone().multiplyScalar(-halfWidth))
    return [tip, left, right, tip]
  }

  private isArrowheadVisible() {
    if (this.arrowheadId === '_NONE') return false
    return this.getArrowheadSize() > 0
  }

  private getArrowheadSize() {
    return this.arrowheadSize ?? this.contentScale ?? this.textHeight
  }

  private getMTextRenderWidth() {
    if (this._textWidth > 0) return this._textWidth
    if (!this._mtextContent) return this._textWidth

    const plainText = this._mtextContent.text
      .replace(/\\[PpNn]/g, '\n')
      .replace(/\\[A-Za-z][^;]*;/g, '')
      .replace(/[{}]/g, '')
    const longestLineLength = Math.max(
      ...plainText.split(/\r\n|\r|\n/g).map(line => line.length),
      1
    )
    return Math.max(this._textHeight, longestLineLength * this._textHeight)
  }

  private transformVector(vector: AcGeVector3d, matrix: AcGeMatrix3d) {
    const origin = new AcGePoint3d()
    const endpoint = new AcGePoint3d(vector.x, vector.y, vector.z)
    origin.applyMatrix4(matrix)
    endpoint.applyMatrix4(matrix)
    vector.set(
      endpoint.x - origin.x,
      endpoint.y - origin.y,
      endpoint.z - origin.z
    )
  }

  private getTextStyle(): AcGiTextStyle {
    const textStyleTable = this.database.tables.textStyleTable
    const style =
      textStyleTable.getAt(this.textStyleName) ??
      textStyleTable.getAt(this.database.textstyle) ??
      textStyleTable.getAt(DEFAULT_TEXT_STYLE)

    if (!style) {
      throw new Error('No valid text style found in text style table.')
    }
    return style.textStyle
  }
}
