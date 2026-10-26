import { Dwg_File_Type, DwgDatabase, LibreDwg } from '@mlightcad/libredwg-web'

import { acdbEnsureDwgThumbnailImage } from './extractDwgThumbnailImage.js'

type LibreDwgInstance = NonNullable<Awaited<ReturnType<typeof LibreDwg.create>>>

export async function parseDwg(data: string | ArrayBuffer) {
  // LibreDwg.create() loads libredwg-web.wasm via the Emscripten glue's
  // `new URL(..., import.meta.url)`. The worker build emits that wasm as a
  // sibling of libredwg-parser-worker.js (not inlined).
  const libredwg = await LibreDwg.create()
  if (libredwg == null) {
    throw new Error('libredwg is not loaded!')
  }

  const dwgDataPtr = libredwg.dwg_read_data(data, Dwg_File_Type.DWG)
  if (dwgDataPtr == null) {
    throw new Error('Failed to read dwg data!')
  }
  const result = libredwg.convertEx(dwgDataPtr)
  attachDimStyleAnnotationScales(libredwg, dwgDataPtr, result.database)
  libredwg.dwg_free(dwgDataPtr)

  // LibreDWG `dwg_bmp` is empty for some drawings that still embed a classic
  // header previewAddress image (e.g. AC1021). Fill from the raw file bytes.
  const fileBytes =
    typeof data === 'string' ? undefined : new Uint8Array(data)
  if (fileBytes) {
    acdbEnsureDwgThumbnailImage(result.database, fileBytes)
  }

  return result
}

/**
 * Annotative dimensions store a SCALE (drawing units per paper unit) on
 * their context data. LibreDWG's converted database does not include those
 * SCALE objects, so read them here and record one factor per dimension
 * style. Dimension geometry uses that factor instead of DIMSCALE.
 */
function attachDimStyleAnnotationScales(
  libredwg: LibreDwgInstance,
  ptr: number,
  database: DwgDatabase
) {
  const byStyle: Record<string, number> = {}
  const scaleFactorByHandle = new Map<string, number>()
  const dicts = new Map<string, { entries?: Record<string, unknown> }>()
  for (const dict of database.objects.DICTIONARY ?? []) {
    const handle = normHandle(dict.handle)
    if (handle) dicts.set(handle, dict)
  }

  const blocks = database.tables.BLOCK_RECORD?.entries ?? []
  for (const block of blocks) {
    for (const ent of block.entities ?? []) {
      if (ent.type !== 'DIMENSION') continue
      const styleName = (ent as { styleName?: string }).styleName
      if (!styleName || byStyle[styleName] != null) continue
      const factor = dimensionAnnotationScale(
        libredwg,
        ptr,
        ent,
        dicts,
        scaleFactorByHandle
      )
      if (factor != null && factor > 0) byStyle[styleName] = factor
    }
  }
  if (Object.keys(byStyle).length > 0) {
    ;(
      database as DwgDatabase & {
        dimStyleAnnotationScales?: Record<string, number>
      }
    ).dimStyleAnnotationScales = byStyle
  }
}

function dimensionAnnotationScale(
  libredwg: LibreDwgInstance,
  ptr: number,
  ent: { ownerDictionaryHardId?: unknown },
  dicts: Map<string, { entries?: Record<string, unknown> }>,
  scaleFactorByHandle: Map<string, number>
): number | undefined {
  const ext = dicts.get(normHandle(ent.ownerDictionaryHardId))
  const manager = dicts.get(normHandle(ext?.entries?.AcDbContextDataManager))
  const scaleDict = dicts.get(normHandle(manager?.entries?.ACDB_ANNOTATIONSCALES))
  const entries = scaleDict?.entries
  if (!entries) return undefined

  let fallback: number | undefined
  for (const contextHandle of Object.values(entries)) {
    const factor = contextScaleFactor(
      libredwg,
      ptr,
      normHandle(contextHandle),
      scaleFactorByHandle
    )
    if (factor == null) continue
    const isDefault = contextIsDefault(libredwg, ptr, normHandle(contextHandle))
    if (isDefault) return factor
    fallback ??= factor
  }
  return fallback
}

function contextIsDefault(
  libredwg: LibreDwgInstance,
  ptr: number,
  contextHandle: string
): boolean {
  const tio = objectTio(libredwg, ptr, contextHandle)
  if (!tio) return false
  try {
    const value = libredwg.dwg_dynapi_entity_value(tio, 'is_default')
    return !!value?.success && Number(value.data) === 1
  } catch {
    return false
  }
}

function contextScaleFactor(
  libredwg: LibreDwgInstance,
  ptr: number,
  contextHandle: string,
  scaleFactorByHandle: Map<string, number>
): number | undefined {
  const tio = objectTio(libredwg, ptr, contextHandle)
  if (!tio) return undefined
  try {
    const ref = libredwg.dwg_dynapi_entity_value(tio, 'scale')
    if (!ref?.success || ref.data == null) return undefined
    const scaleHandle = normHandle(
      libredwg.dwg_ref_get_id(ref.data as never)
    )
    if (!scaleHandle) return undefined
    const cached = scaleFactorByHandle.get(scaleHandle)
    if (cached != null) return cached
    const scaleTio = objectTio(libredwg, ptr, scaleHandle)
    if (!scaleTio) return undefined
    const paper = libredwg.dwg_dynapi_entity_value(scaleTio, 'paper_units')
    const drawing = libredwg.dwg_dynapi_entity_value(scaleTio, 'drawing_units')
    if (!paper?.success || !drawing?.success) return undefined
    const paperN = Number(paper.data)
    const drawingN = Number(drawing.data)
    if (!(paperN > 0) || !(drawingN > 0)) return undefined
    const factor = drawingN / paperN
    scaleFactorByHandle.set(scaleHandle, factor)
    return factor
  } catch {
    return undefined
  }
}

function objectTio(libredwg: LibreDwgInstance, ptr: number, handle: string) {
  if (!handle || !/^[0-9A-F]+$/i.test(handle)) return undefined
  try {
    const obj = libredwg.dwg_resolve_handle(ptr, BigInt('0x' + handle))
    if (!obj) return undefined
    return libredwg.dwg_object_to_object_tio(obj)
  } catch {
    return undefined
  }
}

function normHandle(value: unknown): string {
  if (value == null || value === '' || value === false || value === 0) return ''
  return String(value).trim().toUpperCase()
}
