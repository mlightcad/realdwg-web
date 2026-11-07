import { Dwg_File_Type, DwgDatabase, LibreDwg } from '@mlightcad/libredwg-web'

import { acdbEnsureDwgThumbnailImage } from './extractDwgThumbnailImage.js'

type LibreDwgInstance = NonNullable<Awaited<ReturnType<typeof LibreDwg.create>>>

/**
 * Detects whether `data` is a DWG or DXF payload.
 *
 * - Binary DXF starts with `AutoCAD Binary DXF`
 * - ASCII DXF is text of group-code pairs (often starting with `0` / `999`)
 * - DWG starts with an `ACxxxx` version marker
 */
export function detectLibreDwgFileType(
  data: string | ArrayBuffer | Uint8Array
): Dwg_File_Type {
  if (typeof data === 'string') {
    const head = data.slice(0, 64)
    if (/AutoCAD Binary DXF/i.test(head)) return Dwg_File_Type.DXF
    // Strings are treated as ASCII DXF (DWG is binary).
    return Dwg_File_Type.DXF
  }

  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 22))
  if (head.startsWith('AutoCAD Binary DXF')) return Dwg_File_Type.DXF
  if (head.startsWith('AC1') || head.startsWith('AC2')) return Dwg_File_Type.DWG

  // ASCII DXF bytes: leading whitespace + group code 0/999, etc.
  const asciiHead = new TextDecoder('utf-8').decode(bytes.subarray(0, 64))
  if (/^\s*(0|999)\b/.test(asciiHead)) return Dwg_File_Type.DXF
  return Dwg_File_Type.DWG
}

export async function parseDwg(
  data: string | ArrayBuffer,
  fileType: Dwg_File_Type = Dwg_File_Type.DWG
) {
  return parseLibreDwgFile(data, fileType)
}

/** Parses an ASCII or binary DXF file through LibreDWG WASM. */
export async function parseDxf(data: string | ArrayBuffer) {
  return parseLibreDwgFile(data, Dwg_File_Type.DXF)
}

/**
 * Parses DWG or DXF bytes with LibreDWG. When `fileType` is omitted, the
 * payload is sniffed via {@link detectLibreDwgFileType}.
 */
export async function parseLibreDwgFile(
  data: string | ArrayBuffer,
  fileType?: Dwg_File_Type
) {
  // LibreDwg.create() loads libredwg-web.wasm via the Emscripten glue's
  // `new URL(..., import.meta.url)`. The worker build emits that wasm as a
  // sibling of libredwg-parser-worker.js (not inlined).
  const libredwg = await LibreDwg.create()
  if (libredwg == null) {
    throw new Error('libredwg is not loaded!')
  }

  const resolvedType = fileType ?? detectLibreDwgFileType(data)
  const dwgDataPtr = libredwg.dwg_read_data(data, resolvedType)
  if (dwgDataPtr == null) {
    throw new Error(
      resolvedType === Dwg_File_Type.DXF
        ? 'Failed to read dxf data!'
        : 'Failed to read dwg data!'
    )
  }
  const result = libredwg.convertEx(dwgDataPtr)
  attachDimStyleAnnotationScales(libredwg, dwgDataPtr, result.database)
  libredwg.dwg_free(dwgDataPtr)

  // LibreDWG `dwg_bmp` is empty for some drawings that still embed a classic
  // header previewAddress image (e.g. AC1021). Fill from the raw file bytes.
  // Skip for DXF / string payloads — they do not carry the classic DWG
  // previewAddress thumbnail stream.
  if (resolvedType === Dwg_File_Type.DWG && typeof data !== 'string') {
    acdbEnsureDwgThumbnailImage(result.database, new Uint8Array(data))
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
