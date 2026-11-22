import { AcGeMatrix3d, AcGePoint3d } from '@mlightcad/geometry-engine'

import { acdbHostApplicationServices, AcDbDxfFiler } from '../src/base'
import { AcDbBlockTableRecord, AcDbDatabase } from '../src/database'
import {
  acdbCreateEntityForDxfIn,
  acdbDxfInEntity
} from '../src/dxf/AcDbDxfEntityFactory'
import {
  AcDbAttribute,
  AcDbBlockReference,
  AcDbLine,
  AcDbMInsertBlock
} from '../src/entity'
import { AcDbOsnapMode, AcDbRenderingCache } from '../src/misc'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

const createDb = () => {
  const db = new AcDbDatabase()
  db.createDefaultData()
  acdbHostApplicationServices().workingDatabase = db
  return db
}

const createUnitLineBlock = (db: AcDbDatabase, name: string) => {
  const block = new AcDbBlockTableRecord()
  block.name = name
  db.tables.blockTable.add(block)
  block.appendEntity(new AcDbLine({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }))
  return block
}

describe('AcDbMInsertBlock', () => {
  it('creates a detached clone that keeps array fields', () => {
    expectDetachedClone(() => new AcDbMInsertBlock('TEST', 2, 3, 10, 20))
    const source = new AcDbMInsertBlock('TEST', 2, 3, 10, 20)
    const cloned = source.clone() as AcDbMInsertBlock
    expect(cloned).toBeInstanceOf(AcDbMInsertBlock)
    expect(cloned.columns).toBe(2)
    expect(cloned.rows).toBe(3)
    expect(cloned.columnSpacing).toBe(10)
    expect(cloned.rowSpacing).toBe(20)
    expect(cloned.blockName).toBe('TEST')
  })

  it('is a block reference written as INSERT', () => {
    const minsert = new AcDbMInsertBlock('TEST')
    expect(minsert).toBeInstanceOf(AcDbBlockReference)
    expect(AcDbMInsertBlock.typeName).toBe('MInsertBlock')
    expect(minsert.type).toBe('MInsertBlock')
    expect(minsert.dxfTypeName).toBe('INSERT')
  })

  it('supports array getters/setters with ObjectARX defaults', () => {
    const minsert = new AcDbMInsertBlock('TEST')
    expect(minsert.columns).toBe(1)
    expect(minsert.rows).toBe(1)
    expect(minsert.columnSpacing).toBe(0)
    expect(minsert.rowSpacing).toBe(0)

    minsert.columns = 4
    minsert.rows = 3
    minsert.columnSpacing = 12.5
    minsert.rowSpacing = -8
    expect(minsert.columns).toBe(4)
    expect(minsert.rows).toBe(3)
    expect(minsert.columnSpacing).toBe(12.5)
    expect(minsert.rowSpacing).toBe(-8)

    minsert.columns = 0
    minsert.rows = 2.7
    expect(minsert.columns).toBe(1)
    expect(minsert.rows).toBe(2)
  })

  it('computes extents over the whole array', () => {
    const db = createDb()
    createUnitLineBlock(db, 'ARRAY_BLOCK')
    const minsert = new AcDbMInsertBlock('ARRAY_BLOCK', 3, 2, 10, 5)
    minsert.position = new AcGePoint3d(100, 200, 0)
    db.tables.blockTable.modelSpace.appendEntity(minsert)

    const extents = minsert.geometricExtents
    expect(extents.min).toMatchObject({ x: 100, y: 200, z: 0 })
    expect(extents.max).toMatchObject({ x: 121, y: 206, z: 0 })
  })

  it('rotates the array with the reference but does not scale the spacing', () => {
    const db = createDb()
    createUnitLineBlock(db, 'ROT_BLOCK')
    const minsert = new AcDbMInsertBlock('ROT_BLOCK', 2, 1, 10, 0)
    minsert.rotation = Math.PI / 2
    minsert.scaleFactors = new AcGePoint3d(2, 2, 1)
    db.tables.blockTable.modelSpace.appendEntity(minsert)

    const snaps: AcGePoint3d[] = []
    minsert.subGetOsnapPoints(
      AcDbOsnapMode.EndPoint,
      new AcGePoint3d(),
      new AcGePoint3d(),
      snaps
    )
    // Second instance sits 10 units along the rotated X axis (= WCS +Y).
    const hasSecondOrigin = snaps.some(
      p => Math.abs(p.x) < 1e-9 && Math.abs(p.y - 10) < 1e-9
    )
    expect(hasSecondOrigin).toBe(true)
    // Scaled block geometry: (1,1) -> (2,2) -> rotated (-2,2).
    const hasScaledEnd = snaps.some(
      p => Math.abs(p.x + 2) < 1e-9 && Math.abs(p.y - 12) < 1e-9
    )
    expect(hasScaledEnd).toBe(true)
  })

  it('returns intersect curves for every instance', () => {
    const db = createDb()
    createUnitLineBlock(db, 'IX_BLOCK')
    const minsert = new AcDbMInsertBlock('IX_BLOCK', 2, 2, 10, 10)
    db.tables.blockTable.modelSpace.appendEntity(minsert)
    const single = new AcDbBlockReference('IX_BLOCK')
    db.tables.blockTable.modelSpace.appendEntity(single)

    expect(minsert.subGetIntersectCurves().length).toBe(
      single.subGetIntersectCurves().length * 4
    )
  })

  it('transforms spacing together with the placement', () => {
    const minsert = new AcDbMInsertBlock('TEST', 2, 2, 10, 5)
    minsert.transformBy(new AcGeMatrix3d().makeScale(3, 3, 3))
    expect(minsert.columnSpacing).toBeCloseTo(30, 9)
    expect(minsert.rowSpacing).toBeCloseTo(15, 9)

    minsert.transformBy(new AcGeMatrix3d().makeRotationZ(Math.PI / 3))
    expect(minsert.rotation).toBeCloseTo(Math.PI / 3, 9)
    expect(minsert.columnSpacing).toBeCloseTo(30, 9)
    expect(minsert.rowSpacing).toBeCloseTo(15, 9)
  })

  it('exposes array parameters as editable properties', () => {
    const minsert = new AcDbMInsertBlock('TEST', 2, 3, 4, 5)
    const geometry = minsert.properties.groups.find(
      group => group.groupName === 'geometry'
    )!
    const byName = (name: string) =>
      geometry.properties.find(prop => prop.name === name)!
    expect(byName('columns').accessor.get()).toBe(2)
    expect(byName('rows').accessor.get()).toBe(3)
    expect(byName('columnSpacing').accessor.get()).toBe(4)
    expect(byName('rowSpacing').accessor.get()).toBe(5)
    byName('columns').accessor.set?.(6)
    expect(minsert.columns).toBe(6)

    const insertGeometry = new AcDbBlockReference(
      'TEST'
    ).properties.groups.find(group => group.groupName === 'geometry')!
    expect(
      insertGeometry.properties.some(prop => prop.name === 'columns')
    ).toBe(false)
  })

  it('writes AcDbMInsertBlock DXF fields', () => {
    const db = createDb()
    createUnitLineBlock(db, 'DXF_BLOCK')
    const minsert = new AcDbMInsertBlock('DXF_BLOCK', 4, 3, 12, 8)
    db.tables.blockTable.modelSpace.appendEntity(minsert)

    const filer = new AcDbDxfFiler()
    minsert.dxfOutFields(filer)
    const fields = filer.toString()
    expect(fields).toContain('100\nAcDbMInsertBlock\n')
    expect(fields).not.toContain('100\nAcDbBlockReference\n')
    expect(fields).toContain('70\n4\n')
    expect(fields).toContain('71\n3\n')
    expect(fields).toContain('44\n12\n')
    expect(fields).toContain('45\n8\n')

    const insert = new AcDbBlockReference('DXF_BLOCK')
    db.tables.blockTable.modelSpace.appendEntity(insert)
    const insertFiler = new AcDbDxfFiler()
    insert.dxfOutFields(insertFiler)
    expect(insertFiler.toString()).toContain('100\nAcDbBlockReference\n')
  })

  const readInsert = (body: string) => {
    const filer = AcDbDxfFiler.fromString(`0\nINSERT\n${body}0\nEOF\n`)
    return acdbDxfInEntity(filer)
  }

  it('reads MINSERT from DXF by subclass marker', () => {
    const entity = readInsert(
      '5\nA1\n100\nAcDbEntity\n8\n0\n100\nAcDbMInsertBlock\n2\nBLK\n' +
        '10\n1\n20\n2\n30\n0\n70\n4\n71\n3\n44\n12\n45\n8\n'
    )
    expect(entity).toBeInstanceOf(AcDbMInsertBlock)
    const minsert = entity as AcDbMInsertBlock
    expect(minsert.blockName).toBe('BLK')
    expect(minsert.position).toMatchObject({ x: 1, y: 2, z: 0 })
    expect(minsert.columns).toBe(4)
    expect(minsert.rows).toBe(3)
    expect(minsert.columnSpacing).toBe(12)
    expect(minsert.rowSpacing).toBe(8)
  })

  it('reads MINSERT from DXF written with the AcDbBlockReference marker', () => {
    const entity = readInsert(
      '5\nA2\n100\nAcDbEntity\n8\n0\n100\nAcDbBlockReference\n2\nBLK\n' +
        '10\n0\n20\n0\n30\n0\n70\n1\n71\n5\n45\n2.5\n'
    )
    expect(entity).toBeInstanceOf(AcDbMInsertBlock)
    const minsert = entity as AcDbMInsertBlock
    expect(minsert.columns).toBe(1)
    expect(minsert.rows).toBe(5)
    expect(minsert.rowSpacing).toBe(2.5)
  })

  it('reads a plain INSERT as AcDbBlockReference', () => {
    const entity = readInsert(
      '5\nA3\n100\nAcDbEntity\n8\n0\n100\nAcDbBlockReference\n2\nBLK\n' +
        '10\n3\n20\n4\n30\n0\n'
    )
    expect(entity).toBeInstanceOf(AcDbBlockReference)
    expect(entity).not.toBeInstanceOf(AcDbMInsertBlock)
    expect((entity as AcDbBlockReference).position).toMatchObject({
      x: 3,
      y: 4,
      z: 0
    })
  })

  it('reads a 1x1 INSERT with non-zero spacing as AcDbMInsertBlock', () => {
    const entity = readInsert(
      '5\nA4\n100\nAcDbEntity\n8\n0\n100\nAcDbBlockReference\n2\nBLK\n' +
        '10\n0\n20\n0\n30\n0\n70\n1\n71\n1\n44\n15\n45\n0\n'
    )
    expect(entity).toBeInstanceOf(AcDbMInsertBlock)
    const minsert = entity as AcDbMInsertBlock
    expect(minsert.columns).toBe(1)
    expect(minsert.rows).toBe(1)
    expect(minsert.columnSpacing).toBe(15)
    expect(minsert.rowSpacing).toBe(0)
  })

  it('does not create INSERT via the empty factory (use acdbDxfInEntity)', () => {
    expect(acdbCreateEntityForDxfIn('INSERT')).toBeNull()
  })

  it('draws attributes only on the first array instance, like AutoCAD', () => {
    const db = createDb()
    createUnitLineBlock(db, 'ATTR_BLOCK')
    const minsert = new AcDbMInsertBlock('ATTR_BLOCK', 2, 2, 10, 10)
    db.tables.blockTable.modelSpace.appendEntity(minsert)

    const attr = new AcDbAttribute()
    attr.database = db
    attr.isInvisible = false
    const attrDrawn = { id: 'attr' }
    jest.spyOn(attr, 'worldDraw').mockReturnValue(attrDrawn as never)
    minsert.appendAttributes(attr)

    const drawSpy = jest
      .spyOn(AcDbRenderingCache.instance, 'draw')
      .mockReturnValue({ id: 'cell' } as never)
    const renderer = {
      group: jest.fn((children: unknown[]) => ({ children }))
    }

    minsert.subWorldDraw(renderer as never)
    expect(drawSpy).toHaveBeenCalledTimes(4)
    expect(drawSpy.mock.calls[0][3]).toEqual([attrDrawn])
    expect(drawSpy.mock.calls[1][3]).toEqual([])
    expect(drawSpy.mock.calls[2][3]).toEqual([])
    expect(drawSpy.mock.calls[3][3]).toEqual([])
    drawSpy.mockRestore()
  })
})
