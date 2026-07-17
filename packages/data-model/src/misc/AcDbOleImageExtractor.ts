/**
 * Extracts a renderable image {@link Blob} from AutoCAD OLE frame binary
 * payloads (OLE2FRAME / OLEFRAME).
 *
 * AutoCAD stores OLE 2 items as a short geometry header followed by an OLE
 * Compound File Binary (CFB) document. Embedded pictures (for example
 * "Paintbrush Picture") typically expose either:
 * - a `CONTENTS` stream containing a full BMP / PNG / JPEG file, or
 * - a `\2OlePres###` presentation stream with a CF_DIB / CF_BITMAP payload
 *
 * This extractor prefers CFB streams when present, then falls back to scanning
 * the raw buffer for common image signatures and packed DIBs.
 */

const CFB_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const

/** Standard clipboard format identifiers used in OLE presentation streams. */
const CF_BITMAP = 2
const CF_DIB = 8

const DIRECTORY_ENTRY_SIZE = 128
const MAX_STREAM_BYTES = 64 * 1024 * 1024

/**
 * Attempts to extract an image blob from OLE binary data.
 *
 * @param data - Raw OLE payload from {@link AcDbOleFrame.getOleObject}.
 * @returns A browser-decodable image blob, or `undefined` when no image is found.
 */
export function acdbExtractOleImageBlob(
  data?: Uint8Array | null
): Blob | undefined {
  if (!data?.length) {
    return undefined
  }

  const fromCfb = extractImageFromCfb(data)
  if (fromCfb) {
    return fromCfb
  }

  return extractImageFromRawBytes(data)
}

/**
 * Locates an embedded CFB document inside `data` and tries to pull an image
 * from preferred streams (`CONTENTS`, `Ole10Native`, OlePres, …), then from
 * every remaining stream as a last resort.
 *
 * @param data - Full OLE payload that may contain a CFB compound file.
 * @returns An image blob when one is found, otherwise `undefined`.
 */
function extractImageFromCfb(data: Uint8Array): Blob | undefined {
  const cfbOffset = findSignature(data, CFB_SIGNATURE)
  if (cfbOffset < 0) {
    return undefined
  }

  const cfb = data.subarray(cfbOffset)
  let file: CfbFile
  try {
    file = openCfb(cfb)
  } catch {
    return undefined
  }

  const preferredNames = [
    'CONTENTS',
    'Package',
    'Ole10Native',
    '\x01Ole10Native'
  ]

  for (const name of preferredNames) {
    const stream = file.readStream(name)
    if (!stream?.length) continue
    const blob = extractImageFromRawBytes(stream)
    if (blob) return blob
  }

  for (const entry of file.entries()) {
    if (entry.type !== 'stream') continue
    if (!/olepres/i.test(entry.name) && !entry.name.includes('OlePres')) {
      continue
    }
    const stream = file.readStream(entry.name)
    if (!stream?.length) continue
    const fromPres = extractImageFromOlePresentation(stream)
    if (fromPres) return fromPres
    const fromRaw = extractImageFromRawBytes(stream)
    if (fromRaw) return fromRaw
  }

  // Last resort: scan every stream for embedded image bytes.
  for (const entry of file.entries()) {
    if (entry.type !== 'stream') continue
    const stream = file.readStream(entry.name)
    if (!stream?.length) continue
    const blob = extractImageFromRawBytes(stream)
    if (blob) return blob
  }

  return undefined
}

/**
 * Parses an OLE presentation stream (`\2OlePres000`, …) and extracts a DIB /
 * bitmap when the clipboard format is CF_DIB or CF_BITMAP.
 *
 * @param stream - Bytes of a `\2OlePres###` (or similarly named) stream.
 * @returns A BMP image blob for CF_DIB / CF_BITMAP payloads, or `undefined`.
 *
 * @see https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-oleds/78ab0f5c-ad1b-41b4-bb5e-1eea2cd13a6c
 */
function extractImageFromOlePresentation(stream: Uint8Array): Blob | undefined {
  if (stream.length < 28) {
    return undefined
  }

  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength)
  let offset = 0
  const markerOrLength = view.getUint32(offset, true)
  offset += 4

  let clipboardFormat = 0
  if (markerOrLength === 0xffffffff) {
    clipboardFormat = view.getUint32(offset, true)
    offset += 4
  } else if (markerOrLength === 0xfffffffe) {
    // Unicode clipboard format name — skip string and try raw scan later.
    return undefined
  } else if (markerOrLength > 0 && markerOrLength < 0xffff) {
    // ANSI clipboard format name
    offset += markerOrLength
  } else {
    return undefined
  }

  // TargetDevice.Size
  if (offset + 4 > stream.length) return undefined
  const targetDeviceSize = view.getUint32(offset, true)
  offset += 4
  if (targetDeviceSize > 4) {
    offset += targetDeviceSize - 4
  }

  // Aspect, lindex, advf, reserved1, width, height
  offset += 4 * 6
  if (offset + 4 > stream.length) return undefined
  const dataSize = view.getUint32(offset, true)
  offset += 4
  if (dataSize <= 0 || offset + dataSize > stream.length) {
    return undefined
  }

  const presentationData = stream.subarray(offset, offset + dataSize)
  if (clipboardFormat === CF_DIB) {
    return dibToBmpBlob(presentationData)
  }
  if (clipboardFormat === CF_BITMAP) {
    return extractImageFromRawBytes(presentationData)
  }
  return extractImageFromRawBytes(presentationData)
}

/**
 * Scans a byte buffer for common image file signatures (BMP, PNG, JPEG, GIF)
 * and packed DIB structures.
 *
 * @param data - Arbitrary bytes that may contain an embedded image.
 * @returns The first recognized image blob, or `undefined` if none is found.
 */
function extractImageFromRawBytes(data: Uint8Array): Blob | undefined {
  const bmp = findBmpBlob(data)
  if (bmp) return bmp

  const png = findPngBlob(data)
  if (png) return png

  const jpeg = findJpegBlob(data)
  if (jpeg) return jpeg

  const gif = findGifBlob(data)
  if (gif) return gif

  const dib = findPackedDibBlob(data)
  if (dib) return dib

  return undefined
}

/**
 * Finds a Windows BMP file (`BM` magic) inside `data` and returns it as a blob.
 *
 * @param data - Buffer to search for a BITMAPFILEHEADER.
 * @returns An `image/bmp` blob when a valid BMP is found, otherwise `undefined`.
 */
function findBmpBlob(data: Uint8Array): Blob | undefined {
  for (let i = 0; i < data.length - 14; i++) {
    if (data[i] !== 0x42 || data[i + 1] !== 0x4d) continue
    const view = new DataView(data.buffer, data.byteOffset + i, data.length - i)
    const fileSize = view.getUint32(2, true)
    if (fileSize < 14 || fileSize > data.length - i) continue
    const dibOffset = view.getUint32(10, true)
    if (dibOffset < 14 || dibOffset >= fileSize) continue
    return new Blob([data.subarray(i, i + fileSize)], { type: 'image/bmp' })
  }
  return undefined
}

/**
 * Finds a PNG file inside `data`, preferably bounded by an `IEND` chunk.
 *
 * @param data - Buffer to search for a PNG signature.
 * @returns An `image/png` blob when found, otherwise `undefined`.
 */
function findPngBlob(data: Uint8Array): Blob | undefined {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const start = findSignature(data, sig)
  if (start < 0) return undefined

  // Scan for IEND chunk to bound the PNG.
  for (let i = start + 8; i + 12 <= data.length; i++) {
    if (
      data[i + 4] === 0x49 &&
      data[i + 5] === 0x45 &&
      data[i + 6] === 0x4e &&
      data[i + 7] === 0x44
    ) {
      const end = i + 12
      return new Blob([data.subarray(start, end)], { type: 'image/png' })
    }
  }
  return new Blob([data.subarray(start)], { type: 'image/png' })
}

/**
 * Finds a JPEG file inside `data` by locating SOI (`FF D8 FF`) and EOI
 * (`FF D9`) markers.
 *
 * @param data - Buffer to search for JPEG markers.
 * @returns An `image/jpeg` blob when a complete JPEG is found, otherwise
 *   `undefined`.
 */
function findJpegBlob(data: Uint8Array): Blob | undefined {
  const start = findSignature(data, [0xff, 0xd8, 0xff])
  if (start < 0) return undefined
  for (let i = start + 3; i + 1 < data.length; i++) {
    if (data[i] === 0xff && data[i + 1] === 0xd9) {
      return new Blob([data.subarray(start, i + 2)], { type: 'image/jpeg' })
    }
  }
  return undefined
}

/**
 * Finds a GIF87a / GIF89a file inside `data`, preferably bounded by a trailer
 * byte (`0x3B`).
 *
 * @param data - Buffer to search for a GIF signature.
 * @returns An `image/gif` blob when found, otherwise `undefined`.
 */
function findGifBlob(data: Uint8Array): Blob | undefined {
  const start87 = findSignature(data, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61])
  const start89 = findSignature(data, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  const start = start87 >= 0 ? start87 : start89
  if (start < 0) return undefined
  for (let i = start + 6; i < data.length; i++) {
    if (data[i] === 0x3b) {
      return new Blob([data.subarray(start, i + 1)], { type: 'image/gif' })
    }
  }
  return new Blob([data.subarray(start)], { type: 'image/gif' })
}

/**
 * Locates a packed DIB (BITMAPINFOHEADER with `biSize === 40`) and wraps it as
 * a BMP file by prepending a BITMAPFILEHEADER.
 *
 * @param data - Buffer that may contain a packed device-independent bitmap.
 * @returns An `image/bmp` blob when a plausible DIB is found, otherwise
 *   `undefined`.
 */
function findPackedDibBlob(data: Uint8Array): Blob | undefined {
  for (let i = 0; i + 40 <= data.length; i++) {
    const view = new DataView(data.buffer, data.byteOffset + i, data.length - i)
    const biSize = view.getUint32(0, true)
    if (biSize !== 40) continue

    const width = view.getInt32(4, true)
    const height = view.getInt32(8, true)
    const planes = view.getUint16(12, true)
    const bitCount = view.getUint16(14, true)
    const compression = view.getUint32(16, true)
    const sizeImage = view.getUint32(20, true)
    const clrUsed = view.getUint32(32, true)

    if (width <= 0 || width > 65536) continue
    if (height === 0 || Math.abs(height) > 65536) continue
    if (planes !== 1) continue
    if (![1, 4, 8, 16, 24, 32].includes(bitCount)) continue
    // BI_RGB / BI_BITFIELDS only
    if (compression !== 0 && compression !== 3) continue

    const pixelOffset = getPackedDibPixelOffset(
      biSize,
      bitCount,
      compression,
      clrUsed
    )
    const absHeight = Math.abs(height)
    const rowSize = ((width * bitCount + 31) >> 5) << 2
    const expectedPixels = sizeImage > 0 ? sizeImage : rowSize * absHeight
    const totalSize = pixelOffset + expectedPixels
    if (totalSize <= 40 || i + totalSize > data.length) continue

    return dibToBmpBlob(data.subarray(i, i + totalSize))
  }
  return undefined
}

/**
 * Computes the byte offset from the start of a packed BITMAPINFOHEADER DIB to
 * the first pixel byte, accounting for color tables and BI_BITFIELDS masks.
 *
 * @param biSize - Size of the bitmap info header (typically 40).
 * @param bitCount - Bits per pixel.
 * @param compression - Compression type (`0` = BI_RGB, `3` = BI_BITFIELDS).
 * @param clrUsed - Number of color-table entries, or `0` for the default.
 * @returns Offset in bytes from the DIB start to pixel data.
 */
function getPackedDibPixelOffset(
  biSize: number,
  bitCount: number,
  compression: number,
  clrUsed: number
): number {
  let extra = 0
  if (bitCount > 8 && compression === 3) {
    extra += 12
  }
  if (clrUsed > 0) {
    extra += clrUsed * 4
  } else if (bitCount <= 8) {
    extra += (1 << bitCount) * 4
  }
  return biSize + extra
}

/**
 * Wraps packed DIB bytes as a Windows BMP by prepending a 14-byte
 * BITMAPFILEHEADER.
 *
 * @param dib - Packed DIB starting with BITMAPINFOHEADER / BITMAPCOREHEADER.
 * @returns An `image/bmp` blob, or `undefined` when the header is invalid.
 */
function dibToBmpBlob(dib: Uint8Array): Blob | undefined {
  if (dib.length < 40) return undefined
  const view = new DataView(dib.buffer, dib.byteOffset, dib.byteLength)
  const biSize = view.getUint32(0, true)
  if (biSize !== 40 && biSize !== 12) return undefined

  const fileSize = 14 + dib.length
  const header = new Uint8Array(14)
  const headerView = new DataView(header.buffer)
  header[0] = 0x42 // 'B'
  header[1] = 0x4d // 'M'
  headerView.setUint32(2, fileSize, true)
  headerView.setUint32(10, 14 + getPixelDataOffsetFromDib(dib), true)

  const combined = new Uint8Array(fileSize)
  combined.set(header, 0)
  combined.set(dib, 14)
  return new Blob([combined], { type: 'image/bmp' })
}

/**
 * Returns the offset from the start of a DIB to its pixel array, for use as
 * `bfOffBits` after a 14-byte BITMAPFILEHEADER is prepended.
 *
 * @param dib - Packed DIB starting with BITMAPINFOHEADER or BITMAPCOREHEADER.
 * @returns Pixel-data offset relative to the DIB start (not including the
 *   file header).
 */
function getPixelDataOffsetFromDib(dib: Uint8Array): number {
  const view = new DataView(dib.buffer, dib.byteOffset, dib.byteLength)
  const biSize = view.getUint32(0, true)
  if (biSize === 12) {
    const bitCount = view.getUint16(10, true)
    const colors = bitCount <= 8 ? 1 << bitCount : 0
    return biSize + colors * 3
  }
  const bitCount = view.getUint16(14, true)
  const compression = view.getUint32(16, true)
  const clrUsed = view.getUint32(32, true)
  return getPackedDibPixelOffset(biSize, bitCount, compression, clrUsed)
}

/**
 * Searches `data` for the first occurrence of `signature`.
 *
 * @param data - Buffer to search.
 * @param signature - Byte sequence to locate.
 * @returns Index of the first match, or `-1` if not found.
 */
function findSignature(data: Uint8Array, signature: readonly number[]): number {
  outer: for (let i = 0; i <= data.length - signature.length; i++) {
    for (let j = 0; j < signature.length; j++) {
      if (data[i + j] !== signature[j]) continue outer
    }
    return i
  }
  return -1
}

/* -------------------------------------------------------------------------- */
/* Minimal CFB (Compound File Binary) reader                                  */
/* -------------------------------------------------------------------------- */

interface CfbEntry {
  name: string
  type: 'root' | 'storage' | 'stream' | 'unknown'
  size: number
  startSector: number
}

interface CfbFile {
  entries(): CfbEntry[]
  readStream(name: string): Uint8Array | undefined
}

/**
 * Opens a Compound File Binary (OLE2) document and exposes directory entries
 * plus named stream reads.
 *
 * @param data - Bytes starting at a valid CFB signature.
 * @returns A lightweight CFB reader for stream extraction.
 * @throws If the buffer is too small, not a CFB, or has an unsupported sector
 *   size.
 */
function openCfb(data: Uint8Array): CfbFile {
  if (data.length < 512) {
    throw new Error('CFB too small')
  }
  for (let i = 0; i < CFB_SIGNATURE.length; i++) {
    if (data[i] !== CFB_SIGNATURE[i]) {
      throw new Error('Not a CFB document')
    }
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const sectorShift = view.getUint16(30, true)
  const sectorSize = 1 << sectorShift
  if (sectorSize !== 512 && sectorSize !== 4096) {
    throw new Error('Unsupported CFB sector size')
  }

  const fatCount = view.getUint32(44, true)
  const firstDirSector = view.getUint32(48, true)
  const miniStreamCutoff = view.getUint32(56, true)
  const firstMiniFatSector = view.getUint32(60, true)
  const miniFatCount = view.getUint32(64, true)
  const firstDifatSector = view.getUint32(68, true)
  const difatCount = view.getUint32(72, true)

  const difat: number[] = []
  for (let i = 0; i < 109; i++) {
    const sector = view.getUint32(76 + i * 4, true)
    if (sector <= 0xfffffffa) {
      difat.push(sector)
    }
  }

  let difatSector = firstDifatSector
  for (let n = 0; n < difatCount && difatSector <= 0xfffffffa; n++) {
    const offset = (difatSector + 1) * sectorSize
    if (offset + sectorSize > data.length) break
    const entriesPerSector = sectorSize / 4 - 1
    for (let i = 0; i < entriesPerSector; i++) {
      const sector = view.getUint32(offset + i * 4, true)
      if (sector <= 0xfffffffa) {
        difat.push(sector)
      }
    }
    difatSector = view.getUint32(offset + entriesPerSector * 4, true)
  }

  const fat: number[] = []
  for (let i = 0; i < Math.min(fatCount, difat.length); i++) {
    const fatSector = difat[i]
    const offset = (fatSector + 1) * sectorSize
    if (offset + sectorSize > data.length) break
    const entries = sectorSize / 4
    for (let j = 0; j < entries; j++) {
      fat.push(view.getUint32(offset + j * 4, true))
    }
  }

  const directorySectors = followFatChain(fat, firstDirSector, 4096)
  const directoryBytes = readSectorChain(data, directorySectors, sectorSize)
  const entries: CfbEntry[] = []
  const entryCount = Math.floor(directoryBytes.length / DIRECTORY_ENTRY_SIZE)
  for (let i = 0; i < entryCount; i++) {
    const entryOffset = i * DIRECTORY_ENTRY_SIZE
    const entryView = new DataView(
      directoryBytes.buffer,
      directoryBytes.byteOffset + entryOffset,
      DIRECTORY_ENTRY_SIZE
    )
    const nameLength = entryView.getUint16(64, true)
    if (nameLength < 2 || nameLength > 64) continue
    const charCount = Math.floor((nameLength - 2) / 2)
    let name = ''
    for (let c = 0; c < charCount; c++) {
      name += String.fromCharCode(entryView.getUint16(c * 2, true))
    }
    const objectType = entryView.getUint8(66)
    const startSector = entryView.getUint32(116, true)
    const sizeLow = entryView.getUint32(120, true)
    const sizeHigh = entryView.getUint32(124, true)
    const size = sizeHigh === 0 ? sizeLow : sizeLow + sizeHigh * 0x100000000
    let type: CfbEntry['type'] = 'unknown'
    if (objectType === 5) type = 'root'
    else if (objectType === 1) type = 'storage'
    else if (objectType === 2) type = 'stream'
    entries.push({ name, type, size, startSector })
  }

  const root = entries.find(e => e.type === 'root')
  const miniFat: number[] = []
  if (miniFatCount > 0 && firstMiniFatSector <= 0xfffffffa) {
    const miniFatSectors = followFatChain(fat, firstMiniFatSector, miniFatCount)
    const miniFatBytes = readSectorChain(data, miniFatSectors, sectorSize)
    const miniView = new DataView(
      miniFatBytes.buffer,
      miniFatBytes.byteOffset,
      miniFatBytes.byteLength
    )
    for (let i = 0; i + 4 <= miniFatBytes.length; i += 4) {
      miniFat.push(miniView.getUint32(i, true))
    }
  }

  let miniStream: Uint8Array | undefined
  if (root && root.size > 0) {
    const miniStreamSectors = followFatChain(fat, root.startSector, 65536)
    miniStream = readSectorChain(data, miniStreamSectors, sectorSize).subarray(
      0,
      root.size
    )
  }

  const readStream = (name: string): Uint8Array | undefined => {
    const entry = entries.find(
      e =>
        e.type === 'stream' &&
        (e.name === name || e.name.toLowerCase() === name.toLowerCase())
    )
    if (!entry || entry.size <= 0 || entry.size > MAX_STREAM_BYTES) {
      return undefined
    }

    if (entry.size < miniStreamCutoff && miniStream && miniFat.length > 0) {
      const miniSectorSize = 64
      const sectors = followChain(miniFat, entry.startSector, 65536)
      const out = new Uint8Array(entry.size)
      let written = 0
      for (const sector of sectors) {
        if (written >= entry.size) break
        const start = sector * miniSectorSize
        const end = Math.min(start + miniSectorSize, miniStream.length)
        if (start >= miniStream.length) break
        const chunk = miniStream.subarray(start, end)
        out.set(
          chunk.subarray(0, Math.min(chunk.length, entry.size - written)),
          written
        )
        written += chunk.length
      }
      return out.subarray(0, Math.min(written, entry.size))
    }

    const sectors = followFatChain(fat, entry.startSector, 65536)
    return readSectorChain(data, sectors, sectorSize).subarray(0, entry.size)
  }

  return {
    entries: () => entries,
    readStream
  }
}

/**
 * Walks the CFB File Allocation Table starting at `start` and returns the
 * sector chain.
 *
 * @param fat - FAT sector index table.
 * @param start - First sector index in the chain.
 * @param maxSectors - Safety cap on chain length.
 * @returns Ordered list of sector indices.
 */
function followFatChain(
  fat: number[],
  start: number,
  maxSectors: number
): number[] {
  return followChain(fat, start, maxSectors)
}

/**
 * Walks a sector-chain table (FAT or MiniFAT) until an end-of-chain marker,
 * a cycle, or `maxSectors` is reached.
 *
 * @param table - Sector chain table (FAT or MiniFAT).
 * @param start - First sector index.
 * @param maxSectors - Maximum number of sectors to follow.
 * @returns Ordered list of sector indices visited.
 */
function followChain(
  table: number[],
  start: number,
  maxSectors: number
): number[] {
  const sectors: number[] = []
  let sector = start
  const seen = new Set<number>()
  while (sector <= 0xfffffffa && sectors.length < maxSectors) {
    if (seen.has(sector)) break
    seen.add(sector)
    sectors.push(sector)
    if (sector >= table.length) break
    sector = table[sector]
  }
  return sectors
}

/**
 * Reads and concatenates CFB sectors into a single contiguous buffer.
 *
 * @param data - Full CFB document bytes.
 * @param sectors - Sector indices to read (0-based within the file body).
 * @param sectorSize - Bytes per sector (512 or 4096).
 * @returns Concatenated sector data (may be truncated if past EOF).
 */
function readSectorChain(
  data: Uint8Array,
  sectors: number[],
  sectorSize: number
): Uint8Array {
  const out = new Uint8Array(sectors.length * sectorSize)
  let offset = 0
  for (const sector of sectors) {
    const start = (sector + 1) * sectorSize
    const end = Math.min(start + sectorSize, data.length)
    if (start >= data.length) break
    out.set(data.subarray(start, end), offset)
    offset += sectorSize
  }
  return out
}
