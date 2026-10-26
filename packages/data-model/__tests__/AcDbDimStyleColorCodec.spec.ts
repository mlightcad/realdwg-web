import { AcCmColorMethod } from '@mlightcad/common'

import {
  acdbDecodeDimStyleColor,
  acdbNormalizeDimStyleColorNumber
} from '../src/misc/AcDbMLeaderStyleColorCodec'

describe('acdbDecodeDimStyleColor', () => {
  it('maps plain ACI values', () => {
    expect(acdbDecodeDimStyleColor(0).isByBlock).toBe(true)
    expect(acdbDecodeDimStyleColor(256).isByLayer).toBe(true)
    const aci = acdbDecodeDimStyleColor(3)
    expect(aci.isByACI).toBe(true)
    expect(aci.colorIndex).toBe(3)
  })

  it('decodes packed CMC int32', () => {
    const byLayer = acdbDecodeDimStyleColor((0xc0 << 24) >> 0)
    expect(byLayer.isByLayer).toBe(true)
    const rgb = acdbDecodeDimStyleColor(((0xc2 << 24) | 0x112233) >> 0)
    expect(rgb.colorMethod).toBe(AcCmColorMethod.ByColor)
    expect(rgb.RGB).toBe(0x112233)
  })

  it('decodes LibreDWG CMC objects without producing NaN ACI', () => {
    const fromObject = acdbDecodeDimStyleColor({
      method: 0xc0,
      index: 256,
      rgb: (0xc0 << 24) >> 0
    })
    expect(fromObject.isByLayer).toBe(true)

    const bad = acdbDecodeDimStyleColor({} as never)
    expect(bad.isByBlock).toBe(true)
    expect(Number.isFinite(bad.colorIndex ?? 0)).toBe(true)
  })

  it('normalizes CMC objects to plain numbers for dim-style attrs', () => {
    expect(
      acdbNormalizeDimStyleColorNumber({
        method: 0xc3,
        index: 1,
        rgb: ((0xc3 << 24) | 1) >> 0
      })
    ).toBe(1)
    expect(acdbNormalizeDimStyleColorNumber(undefined)).toBe(0)
  })
})
