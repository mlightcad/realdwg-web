import {
  AcGeBox3d,
  AcGeMatrix3d,
  AcGePoint3d
} from '@mlightcad/geometry-engine'

import { acdbHostApplicationServices, AcDbDxfFiler } from '../src/base'
import { AcDbBlockTableRecord, AcDbDatabase } from '../src/database'
import { AcDbViewport } from '../src/entity'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

const createDb = () => {
  const db = new AcDbDatabase()
  db.createDefaultData()
  acdbHostApplicationServices().workingDatabase = db
  return db
}

describe('AcDbViewport', () => {
  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(() => new AcDbViewport())
  })

  it('supports default values and all public getters/setters', () => {
    const viewport = new AcDbViewport()

    expect(AcDbViewport.typeName).toBe('Viewport')
    expect(viewport.dxfTypeName).toBe('VIEWPORT')
    expect(viewport.number).toBe(-1)
    expect(viewport.height).toBe(0)
    expect(viewport.width).toBe(0)
    expect(viewport.viewHeight).toBe(0)
    expect(viewport.centerPoint).toMatchObject({ x: 0, y: 0, z: 0 })
    expect(viewport.viewCenter).toMatchObject({ x: 0, y: 0, z: 0 })

    viewport.number = 2
    viewport.height = 8
    viewport.width = 12
    viewport.viewHeight = 24
    viewport.centerPoint = new AcGePoint3d(10, 20, 0)
    viewport.viewCenter = new AcGePoint3d(5, 6, 0)

    expect(viewport.number).toBe(2)
    expect(viewport.height).toBe(8)
    expect(viewport.width).toBe(12)
    expect(viewport.viewHeight).toBe(24)
    expect(viewport.centerPoint).toMatchObject({ x: 10, y: 20, z: 0 })
    expect(viewport.viewCenter).toMatchObject({ x: 5, y: 6, z: 0 })
  })

  it('returns geometricExtents and maps itself to AcGiViewport', () => {
    const db = createDb()
    const viewport = new AcDbViewport()
    viewport.number = 3
    viewport.width = 10
    viewport.height = 6
    viewport.viewHeight = 20
    viewport.centerPoint = new AcGePoint3d(2, 4, 0)
    viewport.viewCenter = new AcGePoint3d(1, 1, 0)
    db.tables.blockTable.modelSpace.appendEntity(viewport)

    expect(viewport.geometricExtents).toBeInstanceOf(AcGeBox3d)

    const giViewport = viewport.toGiViewport()
    expect(giViewport.id).toBe(viewport.objectId)
    expect(giViewport.groupId).toBe(db.tables.blockTable.modelSpace.objectId)
    expect(giViewport.number).toBe(3)
    expect(giViewport.width).toBe(10)
    expect(giViewport.height).toBe(6)
    expect(giViewport.viewHeight).toBe(20)
    expect(giViewport.centerPoint).toMatchObject({ x: 2, y: 4, z: 0 })
    expect(giViewport.viewCenter).toMatchObject({ x: 1, y: 1, z: 0 })
  })

  it('transforms center/size/viewHeight and returns self', () => {
    const viewport = new AcDbViewport()
    viewport.centerPoint = new AcGePoint3d(1, 2, 0)
    viewport.width = 2
    viewport.height = 4
    viewport.viewHeight = 12

    expect(viewport.transformBy(new AcGeMatrix3d().makeScale(3, 2, 1))).toBe(
      viewport
    )
    expect(viewport.centerPoint).toMatchObject({ x: 3, y: 4, z: 0 })
    expect(viewport.width).toBeCloseTo(6)
    expect(viewport.height).toBeCloseTo(8)
    expect(viewport.viewHeight).toBeCloseTo(24)
  })

  it('keeps viewHeight unchanged when height is zero during transform', () => {
    const viewport = new AcDbViewport()
    viewport.centerPoint = new AcGePoint3d(1, 1, 0)
    viewport.width = 5
    viewport.height = 0
    viewport.viewHeight = 7

    viewport.transformBy(new AcGeMatrix3d().makeScale(2, 9, 1))

    expect(viewport.width).toBeCloseTo(10)
    expect(viewport.height).toBeCloseTo(0)
    expect(viewport.viewHeight).toBe(7)
  })

  it('draws rectangle in paper space for active viewport only', () => {
    const db = createDb()

    const paperSpace = new AcDbBlockTableRecord()
    paperSpace.name = '*Paper_Space0'
    db.tables.blockTable.add(paperSpace)

    const viewport = new AcDbViewport()
    viewport.number = 2
    viewport.centerPoint = new AcGePoint3d(10, 20, 0)
    viewport.width = 8
    viewport.height = 6
    paperSpace.appendEntity(viewport)

    const renderer = {
      lines: jest.fn((points: AcGePoint3d[]) => ({ points })),
      group: jest.fn((children: unknown[]) => ({ children }))
    }

    const drawn = viewport.subWorldDraw(renderer as never)
    expect(renderer.lines).toHaveBeenCalledTimes(4)
    expect(renderer.group).toHaveBeenCalledTimes(1)
    expect(drawn).toBeDefined()

    const firstEdge = renderer.lines.mock.calls[0][0] as AcGePoint3d[]
    expect(firstEdge[0]).toMatchObject({ x: 6, y: 17, z: 0 })
    expect(firstEdge[1]).toMatchObject({ x: 14, y: 17, z: 0 })

    const inactive = new AcDbViewport()
    inactive.number = 1
    paperSpace.appendEntity(inactive)
    expect(inactive.subWorldDraw(renderer as never)).toBeUndefined()

    const inModelSpace = new AcDbViewport()
    inModelSpace.number = 2
    db.tables.blockTable.modelSpace.appendEntity(inModelSpace)
    expect(inModelSpace.subWorldDraw(renderer as never)).toBeUndefined()
  })

  it('writes viewport DXF fields and returns self', () => {
    const db = createDb()
    const viewport = new AcDbViewport()
    viewport.number = 4
    viewport.centerPoint = new AcGePoint3d(1, 2, 3)
    viewport.width = 11
    viewport.height = 22
    viewport.viewCenter = new AcGePoint3d(4, 5, 6)
    viewport.viewHeight = 33
    db.tables.blockTable.modelSpace.appendEntity(viewport)

    const filer = new AcDbDxfFiler()
    expect(viewport.dxfOutFields(filer)).toBe(viewport)
    const out = filer.toString()

    expect(out).toContain('100\nAcDbViewport\n')
    expect(out).toContain('10\n1\n20\n2\n30\n3\n')
    expect(out).toContain('40\n22\n')
    expect(out).toContain('41\n11\n')
    expect(out).toContain('12\n4\n22\n5\n32\n6\n')
    expect(out).toContain('45\n33\n')
    expect(out).toContain('69\n4\n')
  })
})
