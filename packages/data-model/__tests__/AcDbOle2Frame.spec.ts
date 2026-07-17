import { AcGeMatrix3d, AcGePoint3d } from '@mlightcad/geometry-engine'

import { AcDbOle2Frame } from '../src/entity'
import { acdbExtractOleImageBlob } from '../src/misc/AcDbOleImageExtractor'

/**
 * Builds a minimal 1x1 24-bit BMP (white pixel).
 */
function createMinimalBmp() {
  // BITMAPFILEHEADER (14) + BITMAPINFOHEADER (40) + pixel row (4 bytes padded)
  const bmp = new Uint8Array(58)
  const view = new DataView(bmp.buffer)
  bmp[0] = 0x42 // B
  bmp[1] = 0x4d // M
  view.setUint32(2, 58, true) // bfSize
  view.setUint32(10, 54, true) // bfOffBits
  view.setUint32(14, 40, true) // biSize
  view.setInt32(18, 1, true) // biWidth
  view.setInt32(22, 1, true) // biHeight
  view.setUint16(26, 1, true) // biPlanes
  view.setUint16(28, 24, true) // biBitCount
  view.setUint32(34, 4, true) // biSizeImage
  // Pixel BGR + pad
  bmp[54] = 0xff
  bmp[55] = 0xff
  bmp[56] = 0xff
  bmp[57] = 0x00
  return bmp
}

describe('acdbExtractOleImageBlob', () => {
  it('extracts a BMP embedded directly in the OLE payload', () => {
    const bmp = createMinimalBmp()
    const padded = new Uint8Array(32 + bmp.length)
    padded.set([0x01, 0x55, 0x80], 0)
    padded.set(bmp, 32)

    const blob = acdbExtractOleImageBlob(padded)
    expect(blob).toBeDefined()
    expect(blob?.type).toBe('image/bmp')
    expect(blob?.size).toBe(bmp.length)
  })

  it('extracts a packed DIB by wrapping it as BMP', () => {
    const dib = new Uint8Array(44)
    const view = new DataView(dib.buffer)
    view.setUint32(0, 40, true) // biSize
    view.setInt32(4, 1, true) // width
    view.setInt32(8, 1, true) // height
    view.setUint16(12, 1, true) // planes
    view.setUint16(14, 24, true) // bitCount
    view.setUint32(20, 4, true) // sizeImage
    dib[40] = 0x11
    dib[41] = 0x22
    dib[42] = 0x33
    dib[43] = 0x00

    const blob = acdbExtractOleImageBlob(dib)
    expect(blob).toBeDefined()
    expect(blob?.type).toBe('image/bmp')
    expect(blob?.size).toBe(14 + dib.length)
  })

  it('returns undefined for non-image payloads', () => {
    expect(acdbExtractOleImageBlob(new Uint8Array([1, 2, 3, 4]))).toBeUndefined()
    expect(acdbExtractOleImageBlob(undefined)).toBeUndefined()
  })
})

describe('AcDbOle2Frame image drawing', () => {
  it('draws extracted image through renderer.image', () => {
    const ole = new AcDbOle2Frame()
    ole.upperLeftCorner = new AcGePoint3d(0, 10, 0)
    ole.lowerRightCorner = new AcGePoint3d(20, 0, 0)
    ole.setOleObject(createMinimalBmp())

    expect(ole.image).toBeDefined()
    expect(ole.image?.type).toBe('image/bmp')

    const renderer = {
      lines: jest.fn((_points: AcGePoint3d[]) => ({ kind: 'lines' })),
      image: jest.fn(
        (
          _blob: Blob,
          _style: { boundary: AcGePoint3d[]; roation: number }
        ) => ({
          kind: 'image'
        })
      )
    }
    const drawable = ole.subWorldDraw(renderer as never)
    expect(drawable).toEqual({ kind: 'image' })
    expect(renderer.image).toHaveBeenCalledTimes(1)
    expect(renderer.lines).not.toHaveBeenCalled()

    const [blob, style] = renderer.image.mock.calls[0]
    expect(blob).toBe(ole.image)
    expect(style.boundary).toHaveLength(5)
    expect(style.boundary[0]).toMatchObject({ x: 0, y: 0, z: 0 })
    expect(style.boundary[1]).toMatchObject({ x: 20, y: 0, z: 0 })
    expect(style.boundary[2]).toMatchObject({ x: 20, y: 10, z: 0 })
    expect(style.boundary[3]).toMatchObject({ x: 0, y: 10, z: 0 })
  })

  it('falls back to frame outline when no image is present', () => {
    const ole = new AcDbOle2Frame()
    ole.upperLeftCorner = new AcGePoint3d(0, 5, 0)
    ole.lowerRightCorner = new AcGePoint3d(5, 0, 0)

    const renderer = {
      lines: jest.fn((_points: AcGePoint3d[]) => ({ kind: 'lines' })),
      image: jest.fn(
        (
          _blob: Blob,
          _style: { boundary: AcGePoint3d[]; roation: number }
        ) => ({
          kind: 'image'
        })
      )
    }
    const drawable = ole.subWorldDraw(renderer as never)
    expect(drawable).toEqual({ kind: 'lines' })
    expect(renderer.image).not.toHaveBeenCalled()
    expect(renderer.lines).toHaveBeenCalledTimes(1)
  })

  it('keeps transformed image and frame boundaries aligned', () => {
    const ole = new AcDbOle2Frame()
    ole.upperLeftCorner = new AcGePoint3d(0, 10, 0)
    ole.lowerRightCorner = new AcGePoint3d(20, 0, 0)
    ole.setOleObject(createMinimalBmp())
    ole.transformBy(new AcGeMatrix3d().makeRotationZ(Math.PI / 2))

    const imageRenderer = {
      lines: jest.fn(),
      image: jest.fn(
        (
          _blob: Blob,
          _style: { boundary: AcGePoint3d[]; roation: number }
        ) => ({
          kind: 'image'
        })
      )
    }
    ole.subWorldDraw(imageRenderer as never)

    const outlineRenderer = {
      lines: jest.fn((_points: AcGePoint3d[]) => ({ kind: 'lines' })),
      image: jest.fn()
    }
    ole.setOleObject(new Uint8Array([0, 1, 2, 3]))
    ole.subWorldDraw(outlineRenderer as never)

    const imageBoundary = imageRenderer.image.mock.calls[0][1].boundary
    const frameBoundary = outlineRenderer.lines.mock.calls[0][0]
    const expectedImageBoundary = [
      frameBoundary[3],
      frameBoundary[2],
      frameBoundary[1],
      frameBoundary[0],
      frameBoundary[3]
    ]

    expectedImageBoundary.forEach((point, index) => {
      expect(imageBoundary[index].x).toBeCloseTo(point.x)
      expect(imageBoundary[index].y).toBeCloseTo(point.y)
      expect(imageBoundary[index].z).toBeCloseTo(point.z)
    })
  })

  it('invalidates cached image when OLE payload changes', () => {
    const ole = new AcDbOle2Frame()
    ole.setOleObject(createMinimalBmp())
    const first = ole.image
    expect(first).toBeDefined()

    ole.setOleObject(new Uint8Array([0, 1, 2, 3]))
    expect(ole.image).toBeUndefined()
  })
})
