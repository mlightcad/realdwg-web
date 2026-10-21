import { Dwg_File_Type, LibreDwg } from '@mlightcad/libredwg-web'

import { acdbEnsureDwgThumbnailImage } from './extractDwgThumbnailImage'

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
