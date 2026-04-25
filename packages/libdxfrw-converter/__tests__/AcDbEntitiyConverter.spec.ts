import {
  AcDbArc,
  AcDbCircle,
  AcDbDatabase,
  acdbHostApplicationServices
} from '@mlightcad/data-model'

import { AcDbEntityConverter } from '../src/AcDbEntitiyConverter'

describe('libdxfrw AcDbEntityConverter', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        libdxfrw: {
          DRW_ETYPE: {
            ARC: 1,
            CIRCLE: 2
          }
        }
      }
    })
  })

  it('converts ARC/CIRCLE OCS centers into WCS when extrusion points to -Z', () => {
    acdbHostApplicationServices().workingDatabase = new AcDbDatabase()
    const converter = new AcDbEntityConverter()

    const arc = converter.convert({
      eType: 1,
      handle: 1,
      parentHandle: 2,
      layer: '0',
      lineType: 'ByLayer',
      lWeight: 0,
      ltypeScale: 1,
      visible: true,
      transparency: 0,
      extPoint: { x: 0, y: 0, z: -1 },
      radius: 1,
      startAngle: 0,
      endAngle: Math.PI / 2,
      center: () => ({ x: 1, y: 2, z: 0 })
    } as any)

    const circle = converter.convert({
      eType: 2,
      handle: 3,
      parentHandle: 4,
      layer: '0',
      lineType: 'ByLayer',
      lWeight: 0,
      ltypeScale: 1,
      visible: true,
      transparency: 0,
      extPoint: { x: 0, y: 0, z: -1 },
      basePoint: { x: 1, y: 2, z: 0 },
      radius: 1
    } as any)

    expect(arc).toBeInstanceOf(AcDbArc)
    expect(circle).toBeInstanceOf(AcDbCircle)

    const dbArc = arc as AcDbArc
    const dbCircle = circle as AcDbCircle

    expect(dbArc.center).toMatchObject({ x: -1, y: 2, z: 0 })
    expect(dbArc.startPoint).toMatchObject({ x: -2, y: 2, z: 0 })
    expect(dbArc.endPoint).toMatchObject({ x: -1, y: 3, z: 0 })
    expect(dbCircle.center).toMatchObject({ x: -1, y: 2, z: 0 })
  })
})
