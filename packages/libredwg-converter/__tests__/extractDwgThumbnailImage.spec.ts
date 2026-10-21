import {
  acdbEnsureDwgThumbnailImage,
  acdbExtractDwgThumbnailImage
} from '../src/extractDwgThumbnailImage'

const PREVIEW_START_SENTINEL = new Uint8Array([
  0x1f, 0x25, 0x6d, 0x07, 0xd4, 0x36, 0x28, 0x28, 0x9d, 0x57, 0xca, 0x3f, 0x9d,
  0x44, 0x10, 0x2b
])

describe('acdbExtractDwgThumbnailImage', () => {
  it('returns undefined for buffers that are too short', () => {
    expect(acdbExtractDwgThumbnailImage(new Uint8Array(8))).toBeUndefined()
  })

  it('reads a BMP/DIB preview from the classic previewAddress', () => {
    const dib = new Uint8Array(40)
    dib[0] = 40 // biSize
    const file = buildDwgWithPreview({
      previewAddress: 0x40,
      entries: [
        { code: 1, data: new Uint8Array(16) },
        { code: 2, data: dib }
      ]
    })

    const thumb = acdbExtractDwgThumbnailImage(file)
    expect(thumb).toBeDefined()
    expect(Array.from(thumb as Uint8Array)).toEqual(Array.from(dib))
  })

  it('prefers PNG over BMP when both preview entries exist', () => {
    const dib = new Uint8Array(40)
    dib[0] = 40
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const file = buildDwgWithPreview({
      previewAddress: 0x40,
      entries: [
        { code: 1, data: new Uint8Array(8) },
        { code: 2, data: dib },
        { code: 6, data: png }
      ]
    })

    const thumb = acdbExtractDwgThumbnailImage(file)
    expect(Array.from(thumb as Uint8Array)).toEqual(Array.from(png))
  })

  it('acdbEnsureDwgThumbnailImage does not overwrite an existing thumbnail', () => {
    const existing = new Uint8Array([1, 2, 3])
    const model = { thumbnailImage: existing } as any
    const file = buildDwgWithPreview({
      previewAddress: 0x40,
      entries: [{ code: 2, data: new Uint8Array([9, 9, 9]) }]
    })
    acdbEnsureDwgThumbnailImage(model, file)
    expect(model.thumbnailImage).toBe(existing)
  })

  it('acdbEnsureDwgThumbnailImage fills an empty model thumbnail', () => {
    const dib = new Uint8Array([40, 0, 0, 0, 1, 2, 3, 4])
    const model = { thumbnailImage: undefined } as any
    const file = buildDwgWithPreview({
      previewAddress: 0x40,
      entries: [{ code: 2, data: dib }]
    })
    acdbEnsureDwgThumbnailImage(model, file)
    expect(Array.from(model.thumbnailImage)).toEqual(Array.from(dib))
  })
})

function buildDwgWithPreview(options: {
  previewAddress: number
  entries: { code: number; data: Uint8Array }[]
}): Uint8Array {
  const { previewAddress, entries } = options
  const descriptorBytes = entries.length * 9
  const payloadBytes = entries.reduce((sum, e) => sum + e.data.length, 0)
  const previewLen =
    PREVIEW_START_SENTINEL.length + 4 + 1 + descriptorBytes + payloadBytes
  const file = new Uint8Array(previewAddress + previewLen + 16)
  const view = new DataView(file.buffer)

  // Minimal AC1015-ish prologue so offset 0x0D is meaningful.
  file.set(new TextEncoder().encode('AC1015'), 0)
  view.setUint32(0x0d, previewAddress, true)

  let pos = previewAddress
  file.set(PREVIEW_START_SENTINEL, pos)
  pos += PREVIEW_START_SENTINEL.length
  const overallSize = previewLen - PREVIEW_START_SENTINEL.length
  view.setInt32(pos, overallSize, true)
  pos += 4
  file[pos++] = entries.length

  // Descriptor start fields use absolute file offsets (matching real DWGs).
  let dataPos = pos + descriptorBytes
  for (const entry of entries) {
    file[pos++] = entry.code
    view.setInt32(pos, dataPos, true)
    pos += 4
    view.setInt32(pos, entry.data.length, true)
    pos += 4
    dataPos += entry.data.length
  }
  for (const entry of entries) {
    file.set(entry.data, pos)
    pos += entry.data.length
  }

  return file
}
