import { AcDbDxfCode } from '../base/AcDbDxfCode.js'
import type { AcDbObject, AcDbObjectId } from '../base/AcDbObject.js'
import { AcDbResultBuffer } from '../base/AcDbResultBuffer.js'
import type { AcDbDatabase } from '../database/AcDbDatabase.js'
import { AcDbAnnotScaleObjectContextData } from '../object/AcDbAnnotScaleObjectContextData.js'
import { AcDbDictionary } from '../object/AcDbDictionary.js'
import { AcDbScale } from '../object/AcDbScale.js'
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
 * Sets or clears the AcadAnnotative XDATA marker on `object`.
 * Does not create or remove annotation-scale context data.
 */
export function acdbSetAnnotative(object: AcDbObject, value: boolean): void {
  if (!value) {
    object.removeXData(ACDB_ANNOTATIVE_XDATA_APP)
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
 * Returns SCALE objects from `ACAD_SCALELIST`, seeding common defaults when
 * the dictionary is empty so UI / OBJECTSCALE always have choices.
 */
export function acdbListAnnotationScales(db: AcDbDatabase): AcDbScale[] {
  const scales: AcDbScale[] = []
  for (const [, scale] of db.objects.scale.entries()) {
    if (scale instanceof AcDbScale) scales.push(scale)
  }
  if (scales.length > 0) {
    return scales.sort((a, b) => a.scaleFactor - b.scaleFactor)
  }
  return ACDB_DEFAULT_ANNOTATION_SCALES.map(entry =>
    acdbEnsureNamedScale(db, entry.name, entry.drawingUnits)
  )
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

/**
 * Adds a supported annotation scale to `object` (OBJECTSCALE Add).
 * Creates a generic annot-scale context when the scale is not already linked.
 */
export function acdbAddAnnotationScaleToObject(
  object: AcDbObject,
  scaleName: string
): boolean {
  let db: AcDbDatabase | undefined
  try {
    db = object.database
  } catch {
    return false
  }
  if (!db) return false
  const scale = acdbEnsureNamedScale(db, scaleName)
  const existing = acdbGetAnnotationScaleContexts(object)
  if (existing.some(c => c.scale.objectId === scale.objectId)) {
    return false
  }

  const scalesDict = ensureAnnotationScalesDict(db, object)
  const ctx = new AcDbAnnotScaleObjectContextData()
  ctx.database = db
  ctx.scaleId = scale.objectId
  ctx.isDefault = existing.length === 0
  const key = scale.scaleName || scale.objectId
  db.objects.objectContextData.setAt(
    `${object.objectId}_${key}`,
    ctx
  )
  scalesDict.setAt(key, ctx)
  acdbSetAnnotative(object, true)
  return true
}

/**
 * Removes a supported annotation scale from `object` (OBJECTSCALE Delete).
 */
export function acdbRemoveAnnotationScaleFromObject(
  object: AcDbObject,
  scaleName: string
): boolean {
  const extId = object.extensionDictionary
  if (!extId) return false

  let db: AcDbDatabase | undefined
  try {
    db = object.database
  } catch {
    return false
  }
  if (!db) return false

  const extDict = db.getObjectById(normalizeHandle(extId))
  if (!(extDict instanceof AcDbDictionary)) return false
  const manager = extDict.getAt('AcDbContextDataManager')
  if (!(manager instanceof AcDbDictionary)) return false
  const scalesDict = manager.getAt('ACDB_ANNOTATIONSCALES')
  if (!(scalesDict instanceof AcDbDictionary)) return false

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
      removed = true
    }
  }

  if (removed && acdbGetAnnotationScaleContexts(object).length === 0) {
    acdbSetAnnotative(object, false)
  }
  return removed
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
