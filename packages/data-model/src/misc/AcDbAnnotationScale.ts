import type { AcDbObject, AcDbObjectId } from '../base/AcDbObject'
import type { AcDbDatabase } from '../database/AcDbDatabase'
import { AcDbDictionary } from '../object/AcDbDictionary'
import { AcDbMTextObjectContextData } from '../object/AcDbMTextObjectContextData'
import { AcDbScale } from '../object/AcDbScale'
import { AcDbXrecord } from '../object/AcDbXrecord'

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
  contextData?: AcDbMTextObjectContextData
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
  const db = object.database
  const extId = object.extensionDictionary
  if (!db || !extId) return []

  const extDict = db.getObjectById(normalizeHandle(extId))
  if (!(extDict instanceof AcDbDictionary)) return []

  const manager = extDict.getAt('AcDbContextDataManager')
  if (!(manager instanceof AcDbDictionary)) return []

  const scalesDict = manager.getAt('ACDB_ANNOTATIONSCALES')
  if (!(scalesDict instanceof AcDbDictionary)) return []

  const result: AcDbAnnotationScaleContext[] = []
  for (const [, entry] of scalesDict.entries()) {
    let contextData: AcDbMTextObjectContextData | undefined
    let scaleId: AcDbObjectId | undefined
    let isDefault = false

    if (entry instanceof AcDbMTextObjectContextData) {
      contextData = entry
      scaleId = entry.scaleId
      isDefault = entry.isDefault
    } else {
      // Soft-pointer style: dictionary value may be a bare object with scale.
      scaleId = entry.objectId
    }

    const scale = scaleId
      ? acdbFindScale(db, scaleId)
      : undefined
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
  const preferred =
    contexts.find(c => c.isDefault) ?? contexts[0]
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
  const db = viewport.database
  const extId = viewport.extensionDictionary
  if (!db || !extId) return undefined

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
