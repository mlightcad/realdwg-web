import { AcGePoint3d, AcGeVector3d } from '@mlightcad/geometry-engine'
import {
  AcGiEntity,
  AcGiMTextAttachmentPoint,
  AcGiMTextData,
  AcGiRenderer
} from '@mlightcad/graphic-interface'

import { AcDbDxfFiler } from '../base/AcDbDxfFiler.js'
import {
  type AcDbAnnotationScaleContext,
  type AcDbAnnotationScaleDrawInfo,
  acdbAnnotativeModelHeight,
  acdbAnnotativePaperHeight,
  acdbBuildAnnotationScaleDrawInfo,
  acdbGetAnnotationScaleContexts,
  acdbIsAnnotativeObject,
  acdbMatchAnnotationScaleContext
} from '../misc/AcDbAnnotationScale.js'
import { AcDbMTextObjectContextData } from '../object/AcDbMTextObjectContextData.js'
import {
  AcDbAttributeFlags,
  AcDbAttributeMTextFlag
} from './AcDbAttributeDefinition.js'
import { AcDbEntity } from './AcDbEntity.js'
import { AcDbMText } from './AcDbMText.js'
import { AcDbText } from './AcDbText.js'

function isBlockReferenceOwner(
  owner: unknown
): owner is AcDbEntity & { blockTableRecord: unknown } {
  return (
    owner != null && typeof owner === 'object' && 'blockTableRecord' in owner
  )
}

/**
 * Represents an attribute entity attached to a block reference (INSERT).
 *
 * An `AcDbAttribute` stores textual data associated with a block reference
 * and is typically created from an attribute definition (ATTDEF) when
 * the block is inserted.
 *
 * This class closely follows the behavior and semantics of
 * `AcDbAttribute` in AutoCAD ObjectARX.
 */
export class AcDbAttribute extends AcDbText {
  /** The DXF entity type name. */
  static override typeName: string = 'Attrib'

  override get dxfTypeName() {
    return 'ATTRIB'
  }

  /**
   * Resolves ByBlock color against the owning INSERT, not CECOLOR.
   *
   * AutoCAD attributes inherit block-reference traits for ByBlock color. When
   * the INSERT sits on a layer such as `Viewport` with ACI 7, attribute text
   * must follow that foreground colour (inverted on paper) rather than the
   * current-entity colour sysvar.
   */
  override get resolvedColor() {
    if (this.color.isByBlock) {
      const owner = this.database?.tables.blockTable.getEntityById(this.ownerId)
      if (isBlockReferenceOwner(owner)) {
        return owner.resolvedColor
      }
    }
    return this.resolveStandardColor()
  }

  /**
   * Attribute behavior flags.
   * @see AcDbAttributeFlags
   */
  private _flags: number

  /**
   * Multi-line attribute flags.
   * @see AcDbAttributeMTextFlag
   */
  private _mtextFlag: number

  /** Attribute tag string (identifier). */
  private _tag: string

  /**
   * Field length value.
   *
   * This value is preserved for compatibility but is not actively
   * used by AutoCAD.
   */
  private _fieldLength: number

  /**
   * Indicates whether the attribute position is locked relative
   * to the block geometry.
   */
  private _lockPositionInBlock: boolean

  /**
   * Indicates whether the attribute is currently locked.
   */
  private _isReallyLocked: boolean

  /**
   * Internal MText representation for multi-line attributes.
   * Undefined for single-line attributes.
   */
  private _mtext?: AcDbMText

  constructor() {
    super()
    this._flags = 0
    this._mtextFlag = 0
    this._tag = ''
    this._fieldLength = 0
    this._lockPositionInBlock = false
    this._isReallyLocked = false
  }

  /**
   * Gets whether the attribute is invisible.
   */
  get isInvisible(): boolean {
    return (this._flags & AcDbAttributeFlags.Invisible) !== 0
  }

  /**
   * Sets whether the attribute is invisible.
   */
  set isInvisible(value: boolean) {
    if (value) {
      this._flags |= AcDbAttributeFlags.Invisible
    } else {
      this._flags &= ~AcDbAttributeFlags.Invisible
    }
  }

  /**
   * Gets whether the attribute is constant.
   */
  get isConst(): boolean {
    return (this._flags & AcDbAttributeFlags.Const) !== 0
  }

  /**
   * Sets whether the attribute is constant.
   */
  set isConst(value: boolean) {
    if (value) {
      this._flags |= AcDbAttributeFlags.Const
    } else {
      this._flags &= ~AcDbAttributeFlags.Const
    }
  }

  /**
   * Gets whether the attribute requires verification on input.
   */
  get isVerifiable(): boolean {
    return (this._flags & AcDbAttributeFlags.Verifiable) !== 0
  }

  /**
   * Sets whether the attribute requires verification on input.
   */
  set isVerifiable(value: boolean) {
    if (value) {
      this._flags |= AcDbAttributeFlags.Verifiable
    } else {
      this._flags &= ~AcDbAttributeFlags.Verifiable
    }
  }

  /**
   * Gets whether the attribute has a preset value and does not prompt
   * the user during block insertion.
   */
  get isPreset(): boolean {
    return (this._flags & AcDbAttributeFlags.Preset) !== 0
  }

  /**
   * Sets whether the attribute has a preset value.
   */
  set isPreset(value: boolean) {
    if (value) {
      this._flags |= AcDbAttributeFlags.Preset
    } else {
      this._flags &= ~AcDbAttributeFlags.Preset
    }
  }

  /**
   * Gets whether this attribute is a multi-line (MText-based) attribute.
   */
  get isMTextAttribute(): boolean {
    return (this._mtextFlag & AcDbAttributeMTextFlag.MultiLine) !== 0
  }

  /**
   * Sets whether this attribute is a multi-line (MText-based) attribute.
   */
  set isMTextAttribute(value: boolean) {
    if (value) {
      this._mtextFlag |= AcDbAttributeMTextFlag.MultiLine
    } else {
      this._mtextFlag &= ~AcDbAttributeMTextFlag.MultiLine
    }
  }

  /**
   * Gets whether this attribute is a constant multi-line attribute.
   */
  get isConstMTextAttribute(): boolean {
    return (this._mtextFlag & AcDbAttributeMTextFlag.ConstMultiLine) !== 0
  }

  /**
   * Sets whether this attribute is a constant multi-line attribute.
   */
  set isConstMTextAttribute(value: boolean) {
    if (value) {
      this._mtextFlag |= AcDbAttributeMTextFlag.ConstMultiLine
    } else {
      this._mtextFlag &= ~AcDbAttributeMTextFlag.ConstMultiLine
    }
  }

  /**
   * Gets the attribute tag.
   *
   * The tag uniquely identifies the attribute within a block.
   */
  get tag(): string {
    return this._tag
  }

  /**
   * Sets the attribute tag.
   */
  set tag(value: string) {
    this._tag = value
  }

  /**
   * Gets the attribute field length.
   *
   * This value is not currently used by AutoCAD.
   */
  get fieldLength(): number {
    return this._fieldLength
  }

  /**
   * Sets the attribute field length.
   */
  set fieldLength(value: number) {
    this._fieldLength = value
  }

  /**
   * Gets whether the attribute position is locked relative to
   * the block geometry.
   */
  get lockPositionInBlock(): boolean {
    return this._lockPositionInBlock
  }

  /**
   * Sets whether the attribute position is locked relative to
   * the block geometry.
   */
  set lockPositionInBlock(value: boolean) {
    this._lockPositionInBlock = value
  }

  /**
   * Gets whether the attribute is currently locked.
   */
  get isReallyLocked(): boolean {
    return this._isReallyLocked
  }

  /**
   * Sets whether the attribute is currently locked.
   */
  set isReallyLocked(value: boolean) {
    this._isReallyLocked = value
  }

  /**
   * Gets the internal `AcDbMText` used to represent this attribute
   * when it is a multi-line attribute.
   *
   * Returns `undefined` for single-line attributes.
   */
  get mtext(): AcDbMText | undefined {
    return this._mtext
  }

  /**
   * Sets the internal `AcDbMText` used to represent this attribute
   * as a multi-line attribute.
   *
   * Setting this value automatically marks the attribute as
   * a multi-line attribute.
   */
  set mtext(value: AcDbMText | undefined) {
    this._mtext = value
    this.isMTextAttribute = value != null
  }

  /**
   * Resolves height / insertion for multi-line attributes at CANNOSCALE.
   * Single-line attributes use {@link AcDbText.resolveAnnotativePresentation}.
   */
  resolveMTextAnnotativePresentation(contents: string): {
    contents: string
    height: number
    width: number
    position: AcGePoint3d
    direction: AcGeVector3d
    attachmentPoint: AcGiMTextAttachmentPoint
    preferred?: AcDbAnnotationScaleContext
    annotationScale?: AcDbAnnotationScaleDrawInfo
  } {
    const mt = this.mtext
    const baseHeight = mt?.height ?? this.height
    const baseWidth = mt?.width ?? 0
    const basePosition = mt?.location
      ? new AcGePoint3d(mt.location)
      : this.position.clone()
    const baseDirection = mt?.direction
      ? new AcGeVector3d(mt.direction)
      : new AcGeVector3d(1, 0, 0)
    const baseAttachment =
      (mt?.attachmentPoint as AcGiMTextAttachmentPoint | undefined) ??
      AcGiMTextAttachmentPoint.TopLeft

    const contexts = acdbGetAnnotationScaleContexts(this)
    const isAnnotative =
      contexts.length > 0 || acdbIsAnnotativeObject(this)

    let height = baseHeight
    let width = baseWidth
    let position = basePosition
    let direction = baseDirection
    let attachmentPoint = baseAttachment
    let preferred: AcDbAnnotationScaleContext | undefined
    let annotationScale: AcDbAnnotationScaleDrawInfo | undefined

    if (isAnnotative && contexts.length > 0) {
      preferred =
        acdbMatchAnnotationScaleContext(
          contexts,
          this.database?.cannoscale
        ) ??
        contexts.find(c => c.isDefault) ??
        contexts[0]
      height = acdbAnnotativeModelHeight(
        acdbAnnotativePaperHeight(baseHeight, contexts),
        preferred.scale.scaleFactor
      )
      const ctx = preferred.contextData
      if (ctx instanceof AcDbMTextObjectContextData) {
        position = ctx.insertionPoint.clone()
        direction = ctx.direction.clone()
        attachmentPoint = ctx.attachmentPoint as AcGiMTextAttachmentPoint
        if (ctx.definedWidth > 0) width = ctx.definedWidth
      }
      annotationScale = acdbBuildAnnotationScaleDrawInfo(contexts, preferred)
    }

    return {
      contents,
      height,
      width,
      position,
      direction,
      attachmentPoint,
      preferred,
      annotationScale
    }
  }

  /**
   * Draws single-line attributes via TEXT path; multi-line via embedded MTEXT
   * with attribute-level annotation contexts.
   */
  override subWorldDraw(
    renderer: AcGiRenderer,
    delay?: boolean
  ): AcGiEntity | undefined {
    if (this.isInvisible) return undefined
    if (this.isMTextAttribute && this.mtext) {
      const presentation = this.resolveMTextAnnotativePresentation(
        this.mtext.contents || this.textString
      )
      const mtextData: AcGiMTextData = {
        text: presentation.contents,
        height: presentation.height,
        width: presentation.width,
        position: presentation.position,
        rotation: this.mtext.rotation,
        directionVector: presentation.direction,
        attachmentPoint: presentation.attachmentPoint,
        drawingDirection: this.mtext.drawingDirection,
        lineSpaceFactor: this.mtext.lineSpacingFactor,
        lineSpaceStyle: this.mtext.lineSpacingStyle
      }
      const drawable = renderer.mtext(mtextData, this.getTextStyle(), delay)
      if (drawable && presentation.annotationScale) {
        const userData = (drawable.userData ??= {}) as {
          annotationScale?: AcDbAnnotationScaleDrawInfo
        }
        userData.annotationScale = presentation.annotationScale
      }
      return drawable
    }
    return super.subWorldDraw(renderer, delay)
  }

  /**
   * Writes DXF fields for this object.
   *
   * @param filer - DXF output writer.
   * @returns The instance (for chaining).
   */
  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbAttribute')
    filer.writeInt16(70, this.isInvisible ? 1 : 0)
    filer.writeInt16(73, this.fieldLength)
    filer.writeString(2, this.tag)
    filer.writeInt16(74, this.isReallyLocked ? 1 : 0)
    if (this.mtext) {
      filer.writeInt16(71, this.isMTextAttribute ? 1 : 0)
    }
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    filer.atSubclassData('AcDbAttribute')

    while (!filer.atEndOfObject && !filer.atEof && !filer.atExtendedData) {
      const item = filer.readItem()
      if (!item) break
      const code = Number(item.code)
      if (code === 100) {
        // Embedded objects (e.g. AcDbXrecord) share group 70/280 with ATTRIB.
        // Skip their payload so those codes are not applied as attribute flags,
        // but keep scanning until XData so dxfInXData can still run.
        if (String(item.value) === 'AcDbAttribute') {
          continue
        }
        while (!filer.atEndOfObject && !filer.atEof && !filer.atExtendedData) {
          if (!filer.readItem()) break
        }
        break
      }
      const n = Number(item.value)
      switch (code) {
        case 2:
          this.tag = String(item.value)
          break
        case 70:
          this.isInvisible = (n & AcDbAttributeFlags.Invisible) !== 0
          this.isConst = (n & AcDbAttributeFlags.Const) !== 0
          this.isVerifiable = (n & AcDbAttributeFlags.Verifiable) !== 0
          this.isPreset = (n & AcDbAttributeFlags.Preset) !== 0
          break
        case 71:
          this.isMTextAttribute =
            (n & AcDbAttributeMTextFlag.MultiLine) !== 0
          this.isConstMTextAttribute =
            (n & AcDbAttributeMTextFlag.ConstMultiLine) !== 0
          break
        case 73:
          this.fieldLength = n
          break
        case 74:
          // DXF: vertical text justification for ATTRIB.
          this.verticalMode = n
          break
        case 280:
          this.lockPositionInBlock = n !== 0
          break
        case 340:
          // Soft-pointer ID to FIELD object — optional; keep scanning.
          break
        default:
          break
      }
    }
    return this
  }
}

