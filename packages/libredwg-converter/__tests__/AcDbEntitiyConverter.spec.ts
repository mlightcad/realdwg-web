import {
  AcDbArc,
  AcDbCircle,
  AcDbDatabase,
  acdbHostApplicationServices
} from '@mlightcad/data-model'

import { AcDbEntityConverter } from '../src/AcDbEntitiyConverter'

describe('libredwg AcDbEntityConverter', () => {
  it('converts ARC/CIRCLE OCS centers into WCS when extrusion points to -Z', () => {
    acdbHostApplicationServices().workingDatabase = new AcDbDatabase()
    const converter = new AcDbEntityConverter()

    const arc = converter.convert({
      type: 'ARC',
      center: { x: 1, y: 2, z: 0 },
      radius: 1,
      startAngle: 0,
      endAngle: Math.PI / 2,
      extrusionDirection: { x: 0, y: 0, z: -1 }
    } as any)

    const circle = converter.convert({
      type: 'CIRCLE',
      center: { x: 1, y: 2, z: 0 },
      radius: 1,
      extrusionDirection: { x: 0, y: 0, z: -1 }
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
