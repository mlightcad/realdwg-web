import {
  AcDbDatabase,
  AcDbViewport,
  acdbHostApplicationServices
} from '@mlightcad/data-model'

import { AcDbEntityConverter } from '../src/AcDbEntitiyConverter'
import {
  needsAcadMviewViewportFallback,
  parseAcadMviewXdata
} from '../src/parseAcadMviewXdata'

const cameraEntries = [
  { code: 1000, value: 'MVIEW' },
  { code: 1002, value: '{' },
  { code: 1070, value: 16 },
  { code: 1010, value: { x: 1, y: 2, z: 3 } },
  { code: 1010, value: { x: 0, y: 0, z: 1 } },
  { code: 1040, value: 0.25 },
  { code: 1040, value: 400 },
  { code: 1040, value: 525.19 },
  { code: 1040, value: 461.62 },
  { code: 1040, value: 50 },
  { code: 1040, value: 0 },
  { code: 1040, value: 0 }
]

describe('parseAcadMviewXdata', () => {
  it('reads R14 MVIEW camera fields from LibreDWG xdata', () => {
    expect(
      parseAcadMviewXdata([{ appName: 'ACAD', value: cameraEntries }])
    ).toEqual({
      viewTarget: { x: 1, y: 2, z: 3 },
      viewDirection: { x: 0, y: 0, z: 1 },
      twistAngle: 0.25,
      viewHeight: 400,
      viewCenter: { x: 525.19, y: 461.62 }
    })
  })

  it('still recognizes MVIEW when appName is UCS-2 mojibake', () => {
    expect(
      parseAcadMviewXdata([{ appName: '䍁䑁', value: cameraEntries }])
    ).toMatchObject({ viewHeight: 400, viewCenter: { x: 525.19, y: 461.62 } })
  })

  it('ignores zero view height', () => {
    const zeroHeight = cameraEntries.map(e =>
      e.code === 1040 && e.value === 400 ? { ...e, value: 0 } : e
    )
    expect(
      parseAcadMviewXdata([{ appName: 'ACAD', value: zeroHeight }])
    ).toBeUndefined()
  })

  it('returns undefined without an MVIEW marker', () => {
    expect(
      parseAcadMviewXdata([{ appName: 'ACAD', value: cameraEntries.slice(1) }])
    ).toBeUndefined()
    expect(parseAcadMviewXdata(undefined)).toBeUndefined()
  })
})

describe('needsAcadMviewViewportFallback', () => {
  it('is true only when entity-body viewHeight is missing', () => {
    expect(needsAcadMviewViewportFallback(0)).toBe(true)
    expect(needsAcadMviewViewportFallback(undefined)).toBe(true)
    expect(needsAcadMviewViewportFallback(400)).toBe(false)
  })
})

describe('AcDbEntityConverter VIEWPORT camera', () => {
  const baseViewport = (overrides: Record<string, unknown> = {}) => ({
    type: 'VIEWPORT',
    handle: 'V1',
    layer: '0',
    viewportId: 2,
    viewportCenter: { x: 200, y: 150, z: 0 },
    width: 300,
    height: 200,
    displayCenter: { x: 0, y: 0 },
    targetPoint: { x: 0, y: 0, z: 0 },
    viewDirection: { x: 0, y: 0, z: 0 },
    viewHeight: 0,
    viewTwistAngle: 0,
    xdata: [{ appName: 'ACAD', value: cameraEntries }],
    ...overrides
  })

  beforeEach(() => {
    acdbHostApplicationServices().workingDatabase = new AcDbDatabase()
  })

  it('takes the camera from MVIEW xdata when the body has no view height', () => {
    const converter = new AcDbEntityConverter()
    const vp = converter.convert(baseViewport() as never) as AcDbViewport

    expect(vp).toBeInstanceOf(AcDbViewport)
    expect(vp.viewHeight).toBe(400)
    expect(vp.viewCenter).toMatchObject({ x: 525.19, y: 461.62 })
    expect(vp.viewTarget).toMatchObject({ x: 1, y: 2, z: 3 })
    expect(vp.viewDirection).toMatchObject({ x: 0, y: 0, z: 1 })
    expect(vp.viewTwistAngle).toBe(0.25)
  })

  it('keeps the entity-body camera when view height is present', () => {
    const converter = new AcDbEntityConverter()
    const vp = converter.convert(
      baseViewport({
        viewHeight: 120,
        displayCenter: { x: 10, y: 20 },
        viewDirection: { x: 1, y: -1, z: 1 }
      }) as never
    ) as AcDbViewport

    expect(vp.viewHeight).toBe(120)
    expect(vp.viewCenter).toMatchObject({ x: 10, y: 20 })
    expect(vp.viewTarget).toMatchObject({ x: 0, y: 0, z: 0 })
    expect(vp.viewDirection).toMatchObject({ x: 1, y: -1, z: 1 })
  })

  it('keeps the default view direction when the body direction is zero', () => {
    const converter = new AcDbEntityConverter()
    const vp = converter.convert(
      baseViewport({
        viewHeight: 120,
        viewDirection: { x: 0, y: 0, z: 0 },
        xdata: undefined
      }) as never
    ) as AcDbViewport

    expect(vp.viewDirection).toMatchObject({ x: 0, y: 0, z: 1 })
  })
})
