import type { DwgDatabase } from '@mlightcad/libredwg-web'

/**
 * Preview section start sentinel (Open Design Spec / AutoCAD DWG).
 */
const PREVIEW_START_SENTINEL = new Uint8Array([
  0x1f, 0x25, 0x6d, 0x07, 0xd4, 0x36, 0x28, 0x28, 0x9d, 0x57, 0xca, 0x3f, 0x9d,
  0x44, 0x10, 0x2b
])

/**
 * Extracts a drawing-level BMP/PNG thumbnail from raw DWG bytes.
 *
 * LibreDWG's `dwg_bmp` misses some files (notably AC1021 drawings that still
 * store the classic header `previewAddress` image). This helper reads that
 * layout so {@link DwgDatabase.thumbnailImage} can be filled when LibreDWG
 * leaves it empty.
 *
 * Preview payloads are usually headerless DIBs (`biSize === 40`), not full BMP
 * files — callers should run them through `acdbThumbnailImageToDataUrl` / a BMP
 * decoder that accepts DIBs.
 *
 * When both BMP (code 2) and PNG (code 6) entries exist, PNG is preferred.
 *
 * @returns Thumbnail bytes (bmp/png entry), or `undefined` when none exist.
 */
export function acdbExtractDwgThumbnailImage(
  fileBytes: Uint8Array
): Uint8Array | undefined {
  if (fileBytes.length < 0x11) return undefined

  const previewAddress = new DataView(
    fileBytes.buffer,
    fileBytes.byteOffset,
    fileBytes.byteLength
  ).getUint32(0x0d, true)

  const fromAddress = tryParsePreviewAt(fileBytes, previewAddress)
  if (fromAddress) return fromAddress

  // Some writers leave previewAddress stale; fall back to a sentinel scan near
  // the start of the file (preview blocks are typically early).
  const scanLimit = Math.min(fileBytes.length, 1024 * 1024)
  for (let i = 0; i + PREVIEW_START_SENTINEL.length <= scanLimit; i++) {
    if (!bytesEqualAt(fileBytes, i, PREVIEW_START_SENTINEL)) continue
    if (i === previewAddress) continue
    const fromScan = tryParsePreviewAt(fileBytes, i)
    if (fromScan) return fromScan
  }

  return undefined
}

/**
 * Ensures {@link DwgDatabase.thumbnailImage} is populated when LibreDWG's
 * `dwg_bmp` / `convert` left it empty but the DWG file still embeds a preview.
 */
export function acdbEnsureDwgThumbnailImage(
  model: DwgDatabase,
  fileBytes: Uint8Array
): void {
  if (model.thumbnailImage?.length) return
  const extracted = acdbExtractDwgThumbnailImage(fileBytes)
  if (extracted?.length) {
    model.thumbnailImage = extracted
  }
}

function tryParsePreviewAt(
  fileBytes: Uint8Array,
  offset: number
): Uint8Array | undefined {
  if (offset <= 0 || offset >= fileBytes.length) return undefined
  if (!bytesEqualAt(fileBytes, offset, PREVIEW_START_SENTINEL)) return undefined

  let pos = offset + PREVIEW_START_SENTINEL.length
  if (pos + 5 > fileBytes.length) return undefined

  const view = new DataView(
    fileBytes.buffer,
    fileBytes.byteOffset,
    fileBytes.byteLength
  )
  // overallSize is recorded but not required to locate entries — truncated
  // writers sometimes disagree with the real byte length.
  view.getInt32(pos, true)
  pos += 4
  const imageCount = fileBytes[pos]!
  pos += 1

  if (imageCount <= 0 || imageCount > 16) return undefined

  const descriptors: { code: number; start: number; size: number }[] = []
  for (let i = 0; i < imageCount; i++) {
    if (pos + 9 > fileBytes.length) return undefined
    const code = fileBytes[pos]!
    pos += 1
    // Absolute file offset historically; some writers stream payloads
    // sequentially after the descriptor table instead.
    const start = view.getInt32(pos, true)
    pos += 4
    const size = view.getInt32(pos, true)
    pos += 4
    descriptors.push({ code, start, size })
  }

  const payloadStart = pos

  // Prefer absolute file offsets from the descriptor table (classic ODA layout).
  const fromAbsolute = pickBmpOrPng(fileBytes, descriptors, 'absolute')
  if (fromAbsolute) return fromAbsolute

  // Some writers leave start offsets unset and stream payloads right after the
  // descriptor table; walk them in order as a fallback.
  return pickBmpOrPng(fileBytes, descriptors, 'sequential', payloadStart)
}

function pickBmpOrPng(
  fileBytes: Uint8Array,
  descriptors: { code: number; start: number; size: number }[],
  mode: 'absolute' | 'sequential',
  sequentialPos = 0
): Uint8Array | undefined {
  let bmp: Uint8Array | undefined
  let pos = sequentialPos

  for (const descriptor of descriptors) {
    const start = mode === 'absolute' ? descriptor.start : pos
    if (mode === 'sequential') pos += Math.max(0, descriptor.size)

    // code 1 = header descriptor, 2 = BMP/DIB, 3 = WMF, 6 = PNG
    if (descriptor.code !== 2 && descriptor.code !== 6) continue

    const data = sliceAt(fileBytes, start, descriptor.size)
    if (!data?.length) continue
    if (descriptor.code === 6) return data.slice()
    if (!bmp) bmp = data.slice()
  }

  return bmp
}

function sliceAt(
  fileBytes: Uint8Array,
  start: number,
  size: number
): Uint8Array | undefined {
  if (start < 0 || size <= 0) return undefined
  if (start + size > fileBytes.length) return undefined
  return fileBytes.subarray(start, start + size)
}

function bytesEqualAt(
  haystack: Uint8Array,
  offset: number,
  needle: Uint8Array
): boolean {
  if (offset + needle.length > haystack.length) return false
  for (let i = 0; i < needle.length; i++) {
    if (haystack[offset + i] !== needle[i]) return false
  }
  return true
}
