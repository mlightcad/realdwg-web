import { AcGePoint3d, AcGeVector3d } from '@mlightcad/geometry-engine'

import { AcDbDxfCode } from '../base/AcDbDxfCode.js'
import type { AcDbObject, AcDbObjectId } from '../base/AcDbObject.js'
import { AcDbResultBuffer } from '../base/AcDbResultBuffer.js'
import type { AcDbDatabase } from '../database/AcDbDatabase.js'
import { AcDbAnnotScaleObjectContextData } from '../object/AcDbAnnotScaleObjectContextData.js'
import { AcDbBlkRefObjectContextData } from '../object/AcDbBlkRefObjectContextData.js'
import { AcDbDictionary } from '../object/AcDbDictionary.js'
import { AcDbDimensionObjectContextData } from '../object/AcDbDimensionObjectContextData.js'
import { AcDbHatchScaleContextData } from '../object/AcDbHatchScaleContextData.js'
import { AcDbLeaderObjectContextData } from '../object/AcDbLeaderObjectContextData.js'
import { AcDbMLeaderObjectContextData } from '../object/AcDbMLeaderObjectContextData.js'
import { AcDbMTextAttributeObjectContextData } from '../object/AcDbMTextAttributeObjectContextData.js'
import { AcDbMTextObjectContextData } from '../object/AcDbMTextObjectContextData.js'
import { AcDbScale } from '../object/AcDbScale.js'
import { AcDbTextObjectContextData } from '../object/AcDbTextObjectContextData.js'
import { AcDbXrecord } from '../object/AcDbXrecord.js'

const normalizeHandle = (handle?: string) =>
  handle ? handle.trim().toUpperCase() : ''

/** Extension-dictionary key that stores a viewport's annotation scale. */
export const ACDB_VIEWPORT_ANNOTATION_SCALE_XREC =
  'ASDK_XREC_ANNOTATION_SCALE_INFO'

/** XDATA app name that marks an entity as annotative. */
export const ACDB_ANNOTATIVE_XDATA_APP = 'AcadAnnotative'

/**
 * Runtime annotation-scale metadata attached to drawn annotative entities so
 * paper-space viewports can rescale or hide them for the active scale.
 */
export interface AcDbAnnotationScaleDrawInfo {
  /** Scale factor baked into the drawable geometry. */
  drawnScaleFactor: number
  /** Scale name baked into the drawable (when known). */
  drawnScaleName?: string
  /** Supported annotation scale factors (drawing/paper). */
  supportedScaleFactors: number[]
  /** Supported annotation scale names. */
  supportedScaleNames: string[]
}

/**
 * One per-scale representation resolved from an entity's context-data chain.
 */
export interface AcDbAnnotationScaleContext {
  scale: AcDbScale
  contextData?: AcDbAnnotScaleObjectContextData
  isDefault: boolean
}

/**
 * Returns true when the object carries AcadAnnotative XDATA marking it
 * annotative (`AnnotativeData { 1 … }`).
 */
export function acdbIsAnnotativeObject(object: AcDbObject): boolean {
  const xdata = object.getXData(ACDB_ANNOTATIVE_XDATA_APP)
  if (!xdata) return false
  const values = xdata.toArray()
  // Typical payload: 1000 AnnotativeData, 1002 {, 1070 1, 1070 1, 1002 }
  for (const item of values) {
    if (Number(item.code) === 1070 && Number(item.value) === 1) {
      return true
    }
  }
  return false
}

/**
 * True when the object is annotative via XDATA or has annotation-scale
 * context data in its extension dictionary.
 */
export function acdbGetAnnotative(object: AcDbObject): boolean {
  return (
    acdbIsAnnotativeObject(object) ||
    acdbGetAnnotationScaleContexts(object).length > 0
  )
}

/**
 * Sets or clears the annotative flag on `object`.
 *
 * When `value` is `false`, clears AcadAnnotative XDATA **and** removes all
 * annotation-scale context entries so {@link acdbGetAnnotative} / entity
 * `annotative` getters agree with the setter.
 */
export function acdbSetAnnotative(object: AcDbObject, value: boolean): void {
  if (!value) {
    object.removeXData(ACDB_ANNOTATIVE_XDATA_APP)
    clearAnnotationScaleContexts(object)
    return
  }
  if (acdbIsAnnotativeObject(object)) return

  const rb = new AcDbResultBuffer([
    {
      code: AcDbDxfCode.ExtendedDataRegAppName,
      value: ACDB_ANNOTATIVE_XDATA_APP
    },
    {
      code: AcDbDxfCode.ExtendedDataAsciiString,
      value: 'AnnotativeData'
    },
    { code: AcDbDxfCode.ExtendedDataControlString, value: '{' },
    { code: AcDbDxfCode.ExtendedDataInteger16, value: 1 },
    { code: AcDbDxfCode.ExtendedDataInteger16, value: 1 },
    { code: AcDbDxfCode.ExtendedDataControlString, value: '}' }
  ])
  object.setXData(rb)
}

/**
 * Resolves a SCALE object by handle or by scale name from ACAD_SCALELIST.
 */
export function acdbFindScale(
  db: AcDbDatabase,
  handleOrName?: string
): AcDbScale | undefined {
  if (!handleOrName) return undefined
  const key = normalizeHandle(handleOrName)
  const byId = db.getObjectById(key)
  if (byId instanceof AcDbScale) return byId

  const scaleDict = db.objects.scale
  const byName = scaleDict.getAt(handleOrName)
  if (byName instanceof AcDbScale) return byName

  for (const [, scale] of scaleDict.entries()) {
    if (scale.scaleName === handleOrName) return scale
  }
  return undefined
}

/**
 * Walks an entity's extension dictionary → AcDbContextDataManager →
 * ACDB_ANNOTATIONSCALES and returns linked scale contexts.
 */
export function acdbGetAnnotationScaleContexts(
  object: AcDbObject
): AcDbAnnotationScaleContext[] {
  // Check the extension dictionary before touching `.database` — the latter
  // falls back to the host working database and throws when unset (common for
  // detached entities in unit tests / clone paths).
  const extId = object.extensionDictionary
  if (!extId) return []

  let db: AcDbDatabase | undefined
  try {
    db = object.database
  } catch {
    return []
  }
  if (!db) return []

  const extDict = db.getObjectById(normalizeHandle(extId))
  if (!(extDict instanceof AcDbDictionary)) return []

  const manager = extDict.getAt('AcDbContextDataManager')
  if (!(manager instanceof AcDbDictionary)) return []

  const scalesDict = manager.getAt('ACDB_ANNOTATIONSCALES')
  if (!(scalesDict instanceof AcDbDictionary)) return []

  const result: AcDbAnnotationScaleContext[] = []
  for (const [, entry] of scalesDict.entries()) {
    let contextData: AcDbAnnotScaleObjectContextData | undefined
    let scaleId: AcDbObjectId | undefined
    let isDefault = false

    if (entry instanceof AcDbAnnotScaleObjectContextData) {
      contextData = entry
      scaleId = entry.scaleId
      isDefault = entry.isDefault
    } else {
      // Soft-pointer style: dictionary value may be a bare object with scale.
      scaleId = entry.objectId
    }

    const scale = scaleId ? acdbFindScale(db, scaleId) : undefined
    if (!scale) continue
    result.push({ scale, contextData, isDefault })
  }
  return result
}

/**
 * Paper height implied by the entity's stored model height and its default
 * (or first) annotation scale context.
 */
export function acdbAnnotativePaperHeight(
  modelHeight: number,
  contexts: readonly AcDbAnnotationScaleContext[]
): number {
  if (!(modelHeight > 0) || contexts.length === 0) return modelHeight
  const preferred = contexts.find(c => c.isDefault) ?? contexts[0]
  const factor = preferred.scale.scaleFactor
  return factor > 0 ? modelHeight / factor : modelHeight
}

/**
 * Model-space height for an annotative object at the given scale factor,
 * derived from its paper height.
 */
export function acdbAnnotativeModelHeight(
  paperHeight: number,
  scaleFactor: number
): number {
  if (!(paperHeight > 0)) return paperHeight
  return paperHeight * (scaleFactor > 0 ? scaleFactor : 1)
}

/**
 * Picks the context matching `scaleName` or `scaleFactor`, falling back to
 * the default context when unmatched.
 */
export function acdbMatchAnnotationScaleContext(
  contexts: readonly AcDbAnnotationScaleContext[],
  scaleName?: string,
  scaleFactor?: number
): AcDbAnnotationScaleContext | undefined {
  if (contexts.length === 0) return undefined
  if (scaleName) {
    const byName = contexts.find(c => c.scale.scaleName === scaleName)
    if (byName) return byName
  }
  if (scaleFactor != null && scaleFactor > 0) {
    const byFactor = contexts.find(
      c => Math.abs(c.scale.scaleFactor - scaleFactor) < 1e-9
    )
    if (byFactor) return byFactor
  }
  return contexts.find(c => c.isDefault) ?? contexts[0]
}

/**
 * Reads the viewport annotation scale from
 * `ASDK_XREC_ANNOTATION_SCALE_INFO` in the viewport extension dictionary.
 */
export function acdbGetViewportAnnotationScale(
  viewport: AcDbObject
): AcDbScale | undefined {
  const extId = viewport.extensionDictionary
  if (!extId) return undefined

  let db: AcDbDatabase | undefined
  try {
    db = viewport.database
  } catch {
    return undefined
  }
  if (!db) return undefined

  const extDict = db.getObjectById(normalizeHandle(extId))
  if (!(extDict instanceof AcDbDictionary)) return undefined

  const entry = extDict.getAt(ACDB_VIEWPORT_ANNOTATION_SCALE_XREC)
  if (!entry) return undefined

  let scaleHandle: string | undefined
  if (entry instanceof AcDbXrecord) {
    const data = entry.data?.toArray() ?? []
    for (const item of data) {
      if (Number(item.code) === 340) {
        scaleHandle = String(item.value)
        break
      }
    }
  } else if (entry instanceof AcDbScale) {
    return entry
  }

  return acdbFindScale(db, scaleHandle)
}

/**
 * Builds draw-time metadata for an annotative entity.
 */
export function acdbBuildAnnotationScaleDrawInfo(
  contexts: readonly AcDbAnnotationScaleContext[],
  drawn: AcDbAnnotationScaleContext
): AcDbAnnotationScaleDrawInfo {
  return {
    drawnScaleFactor: drawn.scale.scaleFactor,
    drawnScaleName: drawn.scale.scaleName,
    supportedScaleFactors: contexts.map(c => c.scale.scaleFactor),
    supportedScaleNames: contexts.map(c => c.scale.scaleName)
  }
}

/** Common annotation scales used when a drawing has an empty scale list. */
const ACDB_DEFAULT_ANNOTATION_SCALES: Array<{
  name: string
  drawingUnits: number
}> = [
  { name: '1:1', drawingUnits: 1 },
  { name: '1:2', drawingUnits: 2 },
  { name: '1:5', drawingUnits: 5 },
  { name: '1:10', drawingUnits: 10 },
  { name: '1:20', drawingUnits: 20 },
  { name: '1:50', drawingUnits: 50 },
  { name: '1:100', drawingUnits: 100 },
  { name: '1:200', drawingUnits: 200 },
  { name: '1:500', drawingUnits: 500 },
  { name: '1:1000', drawingUnits: 1000 }
]

/**
 * Returns SCALE objects currently present in `ACAD_SCALELIST` (read-only).
 * Does not seed defaults — use {@link acdbEnsureDefaultAnnotationScales} when
 * the UI needs a non-empty OBJECTSCALE list.
 */
export function acdbListAnnotationScales(db: AcDbDatabase): AcDbScale[] {
  const scales: AcDbScale[] = []
  for (const [, scale] of db.objects.scale.entries()) {
    if (scale instanceof AcDbScale) scales.push(scale)
  }
  return scales.sort((a, b) => a.scaleFactor - b.scaleFactor)
}

/**
 * Ensures the drawing scale list contains the common default annotation
 * scales (`1:1` … `1:1000`). Returns the full scale list afterwards.
 */
export function acdbEnsureDefaultAnnotationScales(
  db: AcDbDatabase
): AcDbScale[] {
  for (const entry of ACDB_DEFAULT_ANNOTATION_SCALES) {
    acdbEnsureNamedScale(db, entry.name, entry.drawingUnits)
  }
  return acdbListAnnotationScales(db)
}

/**
 * Ensures a named {@link AcDbScale} exists in the drawing scale list.
 */
export function acdbEnsureNamedScale(
  db: AcDbDatabase,
  scaleName: string,
  drawingUnits?: number
): AcDbScale {
  const existing = acdbFindScale(db, scaleName)
  if (existing) return existing

  const scale = new AcDbScale()
  scale.database = db
  scale.scaleName = scaleName
  scale.paperUnits = 1
  let factor = drawingUnits
  if (!(factor != null && factor > 0)) {
    const match = /^1\s*:\s*(\d+(?:\.\d+)?)$/i.exec(scaleName.trim())
    factor = match ? Number(match[1]) : 1
  }
  scale.drawingUnits = factor > 0 ? factor : 1
  db.objects.scale.setAt(scaleName, scale)
  return scale
}

function tryObjectDatabase(object: AcDbObject): AcDbDatabase | undefined {
  try {
    return object.database
  } catch {
    return undefined
  }
}

function getAnnotationScalesDict(
  db: AcDbDatabase,
  object: AcDbObject
): AcDbDictionary | undefined {
  const extId = object.extensionDictionary
  if (!extId) return undefined
  const extDict = db.getObjectById(normalizeHandle(extId))
  if (!(extDict instanceof AcDbDictionary)) return undefined
  const manager = extDict.getAt('AcDbContextDataManager')
  if (!(manager instanceof AcDbDictionary)) return undefined
  const scalesDict = manager.getAt('ACDB_ANNOTATIONSCALES')
  return scalesDict instanceof AcDbDictionary ? scalesDict : undefined
}

function ensureAnnotationScalesDict(
  db: AcDbDatabase,
  object: AcDbObject
): AcDbDictionary {
  let extId = object.extensionDictionary
  if (!extId) {
    extId = db.createExtensionDictionaryFor(object)
  }
  if (!extId) {
    throw new Error('Failed to create extension dictionary for object')
  }
  const extDict = db.getObjectById(normalizeHandle(extId))
  if (!(extDict instanceof AcDbDictionary)) {
    throw new Error('Extension dictionary is not an AcDbDictionary')
  }

  let manager = extDict.getAt('AcDbContextDataManager')
  if (!(manager instanceof AcDbDictionary)) {
    manager = new AcDbDictionary(db)
    manager.database = db
    extDict.setAt('AcDbContextDataManager', manager)
  }

  let scalesDict = manager.getAt('ACDB_ANNOTATIONSCALES')
  if (!(scalesDict instanceof AcDbDictionary)) {
    scalesDict = new AcDbDictionary(db)
    scalesDict.database = db
    manager.setAt('ACDB_ANNOTATIONSCALES', scalesDict)
  }
  return scalesDict
}

function removeContextFromObjectContextData(
  db: AcDbDatabase,
  entry: AcDbObject
): void {
  const id = normalizeHandle(entry.objectId)
  if (!id) return
  if (db.objects.objectContextData.getIdAt(id)) {
    db.objects.objectContextData.removeId(id)
    return
  }
  // Helpers may register contexts under `${ownerId}_${scaleName}`.
  for (const [key, value] of [...db.objects.objectContextData.entries()]) {
    if (value === entry || normalizeHandle(value.objectId) === id) {
      db.objects.objectContextData.remove(key)
    }
  }
}

function clearAnnotationScaleContexts(object: AcDbObject): void {
  const db = tryObjectDatabase(object)
  if (!db) return
  const scalesDict = getAnnotationScalesDict(db, object)
  if (!scalesDict) return

  for (const [key, entry] of [...scalesDict.entries()]) {
    scalesDict.remove(key)
    removeContextFromObjectContextData(db, entry)
  }
}

function promoteDefaultAnnotationContext(object: AcDbObject): void {
  const remaining = acdbGetAnnotationScaleContexts(object)
  if (remaining.length === 0 || remaining.some(c => c.isDefault)) return
  const first = remaining[0]?.contextData
  if (first) first.isDefault = true
}

function entityTypeName(object: AcDbObject): string {
  const typed = object as { type?: string }
  return typeof typed.type === 'string' ? typed.type : ''
}

function seedTextContext(
  ctx: AcDbTextObjectContextData,
  object: AcDbObject,
  template?: AcDbAnnotScaleObjectContextData
): void {
  if (template instanceof AcDbTextObjectContextData) {
    ctx.horizontalMode = template.horizontalMode
    ctx.rotation = template.rotation
    ctx.alignmentPoint = template.alignmentPoint
    ctx.position = template.position
    return
  }
  const text = object as {
    horizontalMode?: number
    rotation?: number
    alignmentPoint?: AcGePoint3d
    position?: AcGePoint3d
  }
  if (text.horizontalMode != null) ctx.horizontalMode = text.horizontalMode
  if (text.rotation != null) ctx.rotation = text.rotation
  if (text.alignmentPoint) ctx.alignmentPoint = text.alignmentPoint
  if (text.position) ctx.position = text.position
}

function seedMTextContext(
  ctx: AcDbMTextObjectContextData,
  object: AcDbObject,
  template?: AcDbAnnotScaleObjectContextData
): void {
  if (template instanceof AcDbMTextObjectContextData) {
    ctx.attachmentPoint = template.attachmentPoint
    ctx.direction = template.direction
    ctx.insertionPoint = template.insertionPoint
    ctx.definedWidth = template.definedWidth
    ctx.definedHeight = template.definedHeight
    ctx.extentsWidth = template.extentsWidth
    ctx.extentsHeight = template.extentsHeight
    ctx.columnType = template.columnType
    return
  }
  const mt = object as {
    attachmentPoint?: number
    direction?: AcGeVector3d
    location?: AcGePoint3d
    width?: number
    height?: number
    extentsWidth?: number
    extentsHeight?: number
    columnType?: number
  }
  if (mt.attachmentPoint != null) ctx.attachmentPoint = mt.attachmentPoint
  if (mt.direction) ctx.direction = mt.direction
  if (mt.location) ctx.insertionPoint = mt.location
  if (mt.width != null) ctx.definedWidth = mt.width
  if (mt.height != null) ctx.definedHeight = mt.height
  if (mt.extentsWidth != null) ctx.extentsWidth = mt.extentsWidth
  if (mt.extentsHeight != null) ctx.extentsHeight = mt.extentsHeight
  if (mt.columnType != null) ctx.columnType = mt.columnType
}

function createTypedAnnotScaleContext(
  object: AcDbObject,
  existing: readonly AcDbAnnotationScaleContext[],
  scaleFactor: number
): AcDbAnnotScaleObjectContextData {
  const typeName = entityTypeName(object)
  const template =
    existing.find(c => c.isDefault)?.contextData ?? existing[0]?.contextData
  const hasMtext = !!(object as { mtext?: unknown }).mtext

  if (
    typeName === 'Attrib' &&
    (hasMtext || template instanceof AcDbMTextAttributeObjectContextData)
  ) {
    const ctx = new AcDbMTextAttributeObjectContextData()
    seedMTextContext(ctx, (object as { mtext?: AcDbObject }).mtext ?? object, template)
    return ctx
  }

  if (typeName === 'MText') {
    const ctx = new AcDbMTextObjectContextData()
    seedMTextContext(ctx, object, template)
    return ctx
  }

  if (typeName === 'Text' || typeName === 'Attrib' || typeName === 'AttDef') {
    const ctx = new AcDbTextObjectContextData()
    seedTextContext(ctx, object, template)
    return ctx
  }

  if (typeName.includes('Dimension')) {
    const ctx = new AcDbDimensionObjectContextData()
    if (template instanceof AcDbDimensionObjectContextData) {
      ctx.blockName = template.blockName
      ctx.definitionPoint = template.definitionPoint
      if (template.hasDimLinePoint) ctx.dimLinePoint = template.dimLinePoint
    } else {
      const dim = object as {
        dimBlockId?: string | null
        dimBlockPosition?: AcGePoint3d
      }
      if (dim.dimBlockId) ctx.blockName = dim.dimBlockId
      if (dim.dimBlockPosition) ctx.definitionPoint = dim.dimBlockPosition
    }
    return ctx
  }

  if (typeName === 'Hatch') {
    const ctx = new AcDbHatchScaleContextData()
    if (template instanceof AcDbHatchScaleContextData) {
      ctx.patternScale = template.patternScale
    } else {
      const hatch = object as { patternScale?: number }
      const base =
        hatch.patternScale != null && hatch.patternScale > 0
          ? hatch.patternScale
          : 1
      // New scale representation: paper pattern from default, times target factor.
      const defaultFactor =
        existing.find(c => c.isDefault)?.scale.scaleFactor ??
        existing[0]?.scale.scaleFactor ??
        1
      const paper = defaultFactor > 0 ? base / defaultFactor : base
      ctx.patternScale = paper * (scaleFactor > 0 ? scaleFactor : 1)
    }
    return ctx
  }

  if (typeName === 'BlockReference') {
    const ctx = new AcDbBlkRefObjectContextData()
    if (template instanceof AcDbBlkRefObjectContextData) {
      ctx.position = template.position
      ctx.rotation = template.rotation
      ctx.scaleX = template.scaleX
      ctx.scaleY = template.scaleY
      ctx.scaleZ = template.scaleZ
    } else {
      const br = object as {
        position?: AcGePoint3d
        rotation?: number
        scaleFactors?: AcGePoint3d
      }
      if (br.position) ctx.position = br.position
      if (br.rotation != null) ctx.rotation = br.rotation
      if (br.scaleFactors) {
        ctx.scaleX = br.scaleFactors.x
        ctx.scaleY = br.scaleFactors.y
        ctx.scaleZ = br.scaleFactors.z
      }
    }
    return ctx
  }

  if (typeName === 'MLeader') {
    const ctx = new AcDbMLeaderObjectContextData()
    if (template instanceof AcDbMLeaderObjectContextData) {
      ctx.contentScale = template.contentScale
      ctx.textHeight = template.textHeight
      ctx.arrowheadSize = template.arrowheadSize
      if (template.hasTextAnchor) ctx.textAnchor = template.textAnchor
    } else {
      const ml = object as {
        textHeight?: number
        arrowheadSize?: number
      }
      const defaultFactor =
        existing.find(c => c.isDefault)?.scale.scaleFactor ??
        existing[0]?.scale.scaleFactor ??
        1
      const paperText =
        ml.textHeight != null && defaultFactor > 0
          ? ml.textHeight / defaultFactor
          : ml.textHeight
      const paperArrow =
        ml.arrowheadSize != null && defaultFactor > 0
          ? ml.arrowheadSize / defaultFactor
          : ml.arrowheadSize
      if (paperText != null) {
        ctx.textHeight = paperText * (scaleFactor > 0 ? scaleFactor : 1)
      }
      if (paperArrow != null) {
        ctx.arrowheadSize = paperArrow * (scaleFactor > 0 ? scaleFactor : 1)
      }
      ctx.contentScale = scaleFactor > 0 ? scaleFactor : 1
    }
    return ctx
  }

  if (typeName === 'Leader') {
    return new AcDbLeaderObjectContextData()
  }

  return new AcDbAnnotScaleObjectContextData()
}

/**
 * Adds a supported annotation scale to `object` (OBJECTSCALE Add).
 * Creates a typed per-entity context (when known), seeded from the default
 * context or the entity's current representation.
 */
export function acdbAddAnnotationScaleToObject(
  object: AcDbObject,
  scaleName: string
): boolean {
  const db = tryObjectDatabase(object)
  if (!db) return false
  const scale = acdbEnsureNamedScale(db, scaleName)
  const existing = acdbGetAnnotationScaleContexts(object)
  if (existing.some(c => c.scale.objectId === scale.objectId)) {
    return false
  }

  const scalesDict = ensureAnnotationScalesDict(db, object)
  const ctx = createTypedAnnotScaleContext(
    object,
    existing,
    scale.scaleFactor
  )
  ctx.database = db
  ctx.scaleId = scale.objectId
  ctx.isDefault = existing.length === 0
  const key = scale.scaleName || scale.objectId
  db.objects.objectContextData.setAt(`${object.objectId}_${key}`, ctx)
  scalesDict.setAt(key, ctx)
  // Set XDATA only — do not clear contexts (acdbSetAnnotative(false) would).
  if (!acdbIsAnnotativeObject(object)) {
    acdbSetAnnotative(object, true)
  }
  return true
}

/**
 * Removes a supported annotation scale from `object` (OBJECTSCALE Delete).
 * Also drops the context from `objects.objectContextData` and promotes a new
 * default when the removed scale was the default.
 */
export function acdbRemoveAnnotationScaleFromObject(
  object: AcDbObject,
  scaleName: string
): boolean {
  const db = tryObjectDatabase(object)
  if (!db) return false
  const scalesDict = getAnnotationScalesDict(db, object)
  if (!scalesDict) return false

  let removed = false
  for (const [key, entry] of [...scalesDict.entries()]) {
    let scale: AcDbScale | undefined
    if (entry instanceof AcDbAnnotScaleObjectContextData) {
      scale = acdbFindScale(db, entry.scaleId)
    } else {
      scale = acdbFindScale(db, entry.objectId)
    }
    if (!scale) continue
    if (
      scale.scaleName === scaleName ||
      scale.objectId === normalizeHandle(scaleName)
    ) {
      scalesDict.remove(key)
      removeContextFromObjectContextData(db, entry)
      removed = true
    }
  }

  if (!removed) return false

  const remaining = acdbGetAnnotationScaleContexts(object)
  if (remaining.length === 0) {
    object.removeXData(ACDB_ANNOTATIVE_XDATA_APP)
  } else {
    promoteDefaultAnnotationContext(object)
  }
  return true
}

/**
 * Resolves annotation draw metadata for an annotative object at the database
 * CANNOSCALE (or the default context when unmatched).
 */
export function acdbResolveAnnotationScaleDrawInfo(
  object: AcDbObject
): {
  contexts: AcDbAnnotationScaleContext[]
  preferred?: AcDbAnnotationScaleContext
  annotationScale?: AcDbAnnotationScaleDrawInfo
} {
  const contexts = acdbGetAnnotationScaleContexts(object)
  if (contexts.length === 0) {
    return { contexts }
  }
  const preferred =
    acdbMatchAnnotationScaleContext(
      contexts,
      object.database?.cannoscale
    ) ??
    contexts.find(c => c.isDefault) ??
    contexts[0]
  return {
    contexts,
    preferred,
    annotationScale: acdbBuildAnnotationScaleDrawInfo(contexts, preferred)
  }
}
