import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbBlockTableRecord } from '../src/database/AcDbBlockTableRecord'
import { AcDbAttribute } from '../src/entity/AcDbAttribute'
import { AcDbBlockReference } from '../src/entity/AcDbBlockReference'
import { AcDbLine } from '../src/entity/AcDbLine'
import { AcDbPolyline } from '../src/entity/AcDbPolyline'
import { AcDbText } from '../src/entity/AcDbText'
import { AcGePoint2d } from '@mlightcad/geometry-engine'
import { AcGePoint3d } from '@mlightcad/geometry-engine'

interface DxfPair {
  code: string
  value: string
}

interface DxfRecord {
  type: string
  pairs: DxfPair[]
}

function getSection(dxf: string, name: string) {
  const startMarker = `0\nSECTION\n2\n${name}\n`
  const start = dxf.indexOf(startMarker)
  expect(start).toBeGreaterThanOrEqual(0)

  const end = dxf.indexOf('\n0\nENDSEC\n', start + startMarker.length)
  expect(end).toBeGreaterThan(start)
  return dxf.slice(start + startMarker.length, end + 1)
}

function parseRecords(content: string): DxfRecord[] {
  const lines = content.trim().split('\n')
  expect(lines.length % 2).toBe(0)

  const records: DxfRecord[] = []
  let current: DxfRecord | null = null
  for (let i = 0; i < lines.length; i += 2) {
    const pair = {
      code: lines[i],
      value: lines[i + 1]
    }

    if (pair.code === '0') {
      if (current) {
        records.push(current)
      }
      current = {
        type: pair.value,
        pairs: [pair]
      }
    } else if (current) {
      current.pairs.push(pair)
    }
  }

  if (current) {
    records.push(current)
  }
  return records
}

function findRecord(
  records: DxfRecord[],
  type: string,
  predicate?: (record: DxfRecord) => boolean
) {
  return records.find(record => {
    if (record.type !== type) return false
    return predicate ? predicate(record) : true
  })
}

function valuesByCode(record: DxfRecord, code: string) {
  return record.pairs.filter(pair => pair.code === code).map(pair => pair.value)
}

describe('AcDbDatabase.dxfOut', () => {
  it('exports the expected DXF sections and default table/object content', () => {
    const db = new AcDbDatabase()
    db.createDefaultData()

    const dxf = db.dxfOut(undefined, 6)

    const headerIndex = dxf.indexOf('0\nSECTION\n2\nHEADER\n')
    const tablesIndex = dxf.indexOf('0\nSECTION\n2\nTABLES\n')
    const blocksIndex = dxf.indexOf('0\nSECTION\n2\nBLOCKS\n')
    const entitiesIndex = dxf.indexOf('0\nSECTION\n2\nENTITIES\n')
    const objectsIndex = dxf.indexOf('0\nSECTION\n2\nOBJECTS\n')
    const eofIndex = dxf.lastIndexOf('0\nEOF\n')

    expect(headerIndex).toBeGreaterThanOrEqual(0)
    expect(tablesIndex).toBeGreaterThan(headerIndex)
    expect(blocksIndex).toBeGreaterThan(tablesIndex)
    expect(entitiesIndex).toBeGreaterThan(blocksIndex)
    expect(objectsIndex).toBeGreaterThan(entitiesIndex)
    expect(eofIndex).toBeGreaterThan(objectsIndex)

    expect(dxf).toContain('9\n$ACADVER\n1\nAC1014\n')
    expect(dxf).toContain('9\n$CLAYER\n8\n0\n')
    expect(dxf).toContain('0\nTABLE\n2\nLAYER\n')
    expect(dxf).toContain('0\nLAYER\n')
    expect(dxf).toContain('2\n0\n')
    expect(dxf).toContain('0\nTABLE\n2\nLTYPE\n')
    expect(dxf).toContain('2\nContinuous\n')
    expect(dxf).toContain('0\nTABLE\n2\nSTYLE\n')
    expect(dxf).toContain('2\nStandard\n')
    expect(dxf).toContain('0\nTABLE\n2\nAPPID\n')
    expect(dxf).toContain('2\nmlightcad\n')
    expect(dxf).toContain('0\nLAYOUT\n')
    expect(dxf).toContain('1\nModel\n')
  })

  it('writes common entity fields for line, text, and lightweight polyline', () => {
    const db = new AcDbDatabase()
    db.createDefaultData()

    const line = new AcDbLine({ x: 0, y: 0, z: 0 }, { x: 10, y: 5, z: 0 })
    line.layer = '0'

    const text = new AcDbText()
    text.position = new AcGePoint3d(2, 3, 0)
    text.textString = 'DXF TEST'
    text.height = 2.5
    text.styleName = 'Standard'

    const polyline = new AcDbPolyline()
    polyline.addVertexAt(0, new AcGePoint2d(0, 0))
    polyline.addVertexAt(1, new AcGePoint2d(5, 0))
    polyline.addVertexAt(2, new AcGePoint2d(5, 5))
    polyline.closed = true

    db.tables.blockTable.modelSpace.appendEntity([line, text, polyline])

    const entities = parseRecords(
      getSection(db.dxfOut(undefined, 6), 'ENTITIES')
    )

    const lineRecord = findRecord(entities, 'LINE')
    expect(lineRecord).toBeDefined()
    expect(valuesByCode(lineRecord!, '10')).toContain('0')
    expect(valuesByCode(lineRecord!, '20')).toContain('0')
    expect(valuesByCode(lineRecord!, '11')).toContain('10')
    expect(valuesByCode(lineRecord!, '21')).toContain('5')
    expect(valuesByCode(lineRecord!, '8')).toContain('0')

    const textRecord = findRecord(entities, 'TEXT', record =>
      valuesByCode(record, '1').includes('DXF TEST')
    )
    expect(textRecord).toBeDefined()
    expect(valuesByCode(textRecord!, '40')).toContain('2.5')
    expect(valuesByCode(textRecord!, '7')).toContain('Standard')
    expect(valuesByCode(textRecord!, '10')).toContain('2')
    expect(valuesByCode(textRecord!, '20')).toContain('3')

    const lwPolylineRecord = findRecord(entities, 'LWPOLYLINE')
    expect(lwPolylineRecord).toBeDefined()
    expect(valuesByCode(lwPolylineRecord!, '90')).toContain('3')
    expect(valuesByCode(lwPolylineRecord!, '70')).toContain('1')
    expect(valuesByCode(lwPolylineRecord!, '10')).toEqual(['0', '5', '5'])
    expect(valuesByCode(lwPolylineRecord!, '20')).toEqual(['0', '0', '5'])
  })

  it('writes block definitions and insert attributes to BLOCKS and ENTITIES sections', () => {
    const db = new AcDbDatabase()
    db.createDefaultData()

    const block = new AcDbBlockTableRecord()
    block.name = 'TEST_BLOCK'
    db.tables.blockTable.add(block)
    block.appendEntity(new AcDbLine({ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }))

    const insert = new AcDbBlockReference('TEST_BLOCK')
    insert.position = new AcGePoint3d(10, 20, 0)

    const attribute = new AcDbAttribute()
    attribute.database = db
    attribute.position = new AcGePoint3d(10, 20, 0)
    attribute.height = 1
    attribute.tag = 'TAG1'
    attribute.textString = 'VALUE1'
    insert.appendAttributes(attribute)

    db.tables.blockTable.modelSpace.appendEntity(insert)

    const dxf = db.dxfOut(undefined, 6)
    const blockRecords = parseRecords(getSection(dxf, 'BLOCKS'))
    const entityRecords = parseRecords(getSection(dxf, 'ENTITIES'))

    const blockBegin = findRecord(blockRecords, 'BLOCK', record =>
      valuesByCode(record, '2').includes('TEST_BLOCK')
    )
    expect(blockBegin).toBeDefined()
    expect(valuesByCode(blockBegin!, '3')).toContain('TEST_BLOCK')

    const blockLine = findRecord(blockRecords, 'LINE')
    expect(blockLine).toBeDefined()
    expect(valuesByCode(blockLine!, '11')).toContain('4')

    const insertRecord = findRecord(entityRecords, 'INSERT', record =>
      valuesByCode(record, '2').includes('TEST_BLOCK')
    )
    expect(insertRecord).toBeDefined()
    expect(valuesByCode(insertRecord!, '10')).toContain('10')
    expect(valuesByCode(insertRecord!, '20')).toContain('20')

    const attribRecord = findRecord(entityRecords, 'ATTRIB', record =>
      valuesByCode(record, '2').includes('TAG1')
    )
    expect(attribRecord).toBeDefined()
    expect(valuesByCode(attribRecord!, '1')).toContain('VALUE1')

    const seqendRecord = findRecord(entityRecords, 'SEQEND')
    expect(seqendRecord).toBeDefined()
  })
})
