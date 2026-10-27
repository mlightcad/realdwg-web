import { AcGeMatrix3d, AcGePoint3d } from '@mlightcad/geometry-engine'
import { acdbHostApplicationServices } from '../src/base'
import { AcDbDatabase } from '../src/database'
import { AcDbOrdinateDimension } from '../src/entity'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

describe('AcDbOrdinateDimension', () => {
  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(
      () =>
        new AcDbOrdinateDimension(new AcGePoint3d(), new AcGePoint3d(1, 0, 0))
    )
  })

  it('returns geometricExtents and recomputes when defining point changes', () => {
    const dim = new AcDbOrdinateDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(5, 0, 0)
    )

    expect(dim.geometricExtents.min).toMatchObject({ x: 0, y: 0, z: 0 })
    expect(dim.geometricExtents.max).toMatchObject({ x: 5, y: 0, z: 0 })

    dim.definingPoint = new AcGePoint3d(10, 20, 0)
    dim.leaderEndPoint = new AcGePoint3d(15, 25, 0)

    expect(dim.geometricExtents.min).toMatchObject({ x: 10, y: 20, z: 0 })
    expect(dim.geometricExtents.max).toMatchObject({ x: 15, y: 25, z: 0 })
  })

  it('reports X or Y delta from the origin and builds a leader block', () => {
    const db = new AcDbDatabase()
    db.createDefaultData()
    acdbHostApplicationServices().workingDatabase = db
    const dim = new AcDbOrdinateDimension(
      new AcGePoint3d(12, 7, 0),
      new AcGePoint3d(20, 7, 0)
    )
    dim.origin = new AcGePoint3d(2, 1, 0)
    dim.dimensionStyle.dimdec = 1
    dim.useXAxis = true
    expect(dim.dimensionType & 0x0f).toBe(6)
    expect(dim.dimensionType & 0x40).toBe(0x40)

    const xBlock = dim.createDimBlock('*D2')
    const xText = [...xBlock.newIterator()].find(
      entity => entity.type === 'MText'
    ) as { contents: string } | undefined
    expect(xText?.contents).toContain('10.0')

    dim.useXAxis = false
    expect(dim.dimensionType & 0x40).toBe(0)
    const yBlock = dim.createDimBlock('*D3')
    const yText = [...yBlock.newIterator()].find(
      entity => entity.type === 'MText'
    ) as { contents: string } | undefined
    expect(yText?.contents).toContain('6.0')
    expect([...yBlock.newIterator()].some(entity => entity.type === 'Line')).toBe(
      true
    )
  })

  it('transforms the ordinate origin with the defining points', () => {
    const db = new AcDbDatabase()
    db.createDefaultData()
    acdbHostApplicationServices().workingDatabase = db
    const dim = new AcDbOrdinateDimension(
      new AcGePoint3d(12, 7, 0),
      new AcGePoint3d(20, 7, 0)
    )
    dim.origin = new AcGePoint3d(2, 1, 0)
    dim.dimensionStyle.dimdec = 1
    dim.useXAxis = true
    dim.measurement = undefined

    dim.transformBy(new AcGeMatrix3d().makeTranslation(10, 5, 0))

    expect(dim.origin).toMatchObject({ x: 12, y: 6, z: 0 })
    expect(dim.definingPoint).toMatchObject({ x: 22, y: 12, z: 0 })
    const text = [...dim.createDimBlock('*Dt').newIterator()].find(
      entity => entity.type === 'MText'
    ) as { contents: string } | undefined
    expect(text?.contents).toContain('10.0')
  })
})
