import { acdbWithDatabase } from '../src/base/AcDbObject'
import { AcDbDxfFiler } from '../src/base/AcDbDxfFiler'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbBlockReference } from '../src/entity/AcDbBlockReference'
import { AcDbLine } from '../src/entity/AcDbLine'
import { AcDbPoint } from '../src/entity/AcDbPoint'

function filer(pairs: Array<[number, string | number]>) {
  return AcDbDxfFiler.fromString(pairs.flat().join('\n'))
}

describe('native unframed DXF entity fields', () => {
  it('retains R12 LINE and POINT coordinates with interspersed common fields and object boundaries', () => {
    const db = new AcDbDatabase()
    acdbWithDatabase(db, () => {
      db.createDefaultData()
      const input = filer([
        [0, 'LINE'],
        [5, 'A1'],
        [10, 40],
        [8, 'survey'],
        [20, 210],
        [62, 3],
        [30, 7],
        [11, 60],
        [21, 190],
        [6, 'DASHED'],
        [31, 8],
        [60, 1],
        [0, 'POINT'],
        [5, 'A2'],
        [10, 9],
        [8, 'levels'],
        [20, 8],
        [30, 7],
        [0, 'ENDSEC']
      ])
      expect(input.readItem()?.value).toBe('LINE')
      const line = new AcDbLine().dxfIn(input)
      expect(line.objectId).toBe('A1')
      expect(line.startPoint).toMatchObject({ x: 40, y: 210, z: 7 })
      expect(line.endPoint).toMatchObject({ x: 60, y: 190, z: 8 })
      expect(line.layer).toBe('survey')
      expect(line.color.colorIndex).toBe(3)
      expect(line.lineType).toBe('DASHED')
      expect(line.visibility).toBe(false)
      expect(input.readItem()?.value).toBe('POINT')
      const point = new AcDbPoint().dxfIn(input)
      expect(point.objectId).toBe('A2')
      expect(point.position).toMatchObject({ x: 9, y: 8, z: 7 })
      expect(point.layer).toBe('levels')
      expect(input.readItem()?.value).toBe('ENDSEC')
      expect(input.atEof).toBe(true)
    })
  })

  it('retains unframed INSERT name, position, scale and rotation', () => {
    const db = new AcDbDatabase()
    acdbWithDatabase(db, () => {
      db.createDefaultData()
      const input = filer([
        [0, 'INSERT'],
        [5, 'A3'],
        [2, 'MARK'],
        [10, 100],
        [8, 'site'],
        [20, 200],
        [30, 5],
        [41, 2],
        [62, 4],
        [42, 3],
        [43, 1],
        [50, 90],
        [0, 'ENDSEC']
      ])
      input.readItem()
      const insert = new AcDbBlockReference('').dxfIn(input)
      expect(insert.blockName).toBe('MARK')
      expect(insert.position).toMatchObject({ x: 100, y: 200, z: 5 })
      expect(insert.scaleFactors).toMatchObject({ x: 2, y: 3, z: 1 })
      expect(insert.rotation).toBeCloseTo(Math.PI / 2, 12)
      expect(insert.layer).toBe('site')
      expect(insert.color.colorIndex).toBe(4)
      expect(input.readItem()?.value).toBe('ENDSEC')
    })
  })

  it('leaves an explicit derived marker visible when only AcDbEntity framing is omitted', () => {
    const db = new AcDbDatabase()
    acdbWithDatabase(db, () => {
      db.createDefaultData()
      const input = filer([
        [0, 'INSERT'],
        [5, 'A5'],
        [8, 'site'],
        [90, 777],
        [100, 'AcDbBlockReference'],
        [2, 'MARK'],
        [10, 100],
        [20, 200],
        [30, 5],
        [41, 2],
        [42, 3],
        [43, 1],
        [50, 90],
        [0, 'ENDSEC']
      ])
      input.readItem()
      const insert = new AcDbBlockReference('').dxfIn(input)
      expect(insert.blockName).toBe('MARK')
      expect(insert.position).toMatchObject({ x: 100, y: 200, z: 5 })
      expect(insert.scaleFactors).toMatchObject({ x: 2, y: 3, z: 1 })
      expect(insert.rotation).toBeCloseTo(Math.PI / 2, 12)
      expect(insert.layer).toBe('site')
      expect(input.readItem()?.value).toBe('ENDSEC')
    })
  })

  it('keeps unknown modern AcDbEntity fields out of the derived geometry section', () => {
    const db = new AcDbDatabase()
    acdbWithDatabase(db, () => {
      db.createDefaultData()
      const input = filer([
        [0, 'LINE'],
        [5, 'A4'],
        [100, 'AcDbEntity'],
        [8, 'survey'],
        [10, 999],
        [20, 888],
        [91, 777],
        [100, 'AcDbLine'],
        [10, 40],
        [20, 210],
        [11, 60],
        [21, 190],
        [0, 'ENDSEC']
      ])
      input.readItem()
      const line = new AcDbLine().dxfIn(input)
      expect(line.layer).toBe('survey')
      expect(line.startPoint).toMatchObject({ x: 40, y: 210, z: 0 })
      expect(line.endPoint).toMatchObject({ x: 60, y: 190, z: 0 })
      expect(input.readItem()?.value).toBe('ENDSEC')
      expect(input.atEof).toBe(true)
    })
  })
})
