import { acdbHostApplicationServices } from '../src/base'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbFileType } from '../src/database/AcDbDatabaseConverterManager'
import { AcDb2dPolyline } from '../src/entity/AcDb2dPolyline'
import { AcDbLine } from '../src/entity/AcDbLine'
import { AcDbPoint } from '../src/entity/AcDbPoint'
import { AcDbText } from '../src/entity/AcDbText'

function r12Tables(includeAppId = false): string {
  const lines = [
    '0',
    'SECTION',
    '2',
    'TABLES',
    '0',
    'TABLE',
    '2',
    'LTYPE',
    '70',
    '1',
    '0',
    'LTYPE',
    '2',
    'CONTINUOUS',
    '70',
    '0',
    '3',
    'Solid line',
    '72',
    '65',
    '73',
    '0',
    '40',
    '0.0',
    '0',
    'ENDTAB',
    '0',
    'TABLE',
    '2',
    'LAYER',
    '70',
    '1',
    '0',
    'LAYER',
    '2',
    '0',
    '70',
    '0',
    '62',
    '7',
    '6',
    'CONTINUOUS',
    '0',
    'ENDTAB',
    '0',
    'TABLE',
    '2',
    'STYLE',
    '70',
    '1',
    '0',
    'STYLE',
    '2',
    'STANDARD',
    '70',
    '0',
    '40',
    '0.0',
    '41',
    '1.0',
    '50',
    '0.0',
    '71',
    '0',
    '42',
    '2.5',
    '3',
    'txt',
    '4',
    '',
    '0',
    'ENDTAB'
  ]
  if (includeAppId) {
    lines.push(
      '0',
      'TABLE',
      '2',
      'APPID',
      '70',
      '1',
      '0',
      'APPID',
      '2',
      'REPRO',
      '70',
      '0',
      '0',
      'ENDTAB'
    )
  }
  lines.push('0', 'ENDSEC')
  return lines.join('\n')
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

async function readDxf(data: ArrayBuffer, readOnly = true) {
  const db = new AcDbDatabase()
  acdbHostApplicationServices().workingDatabase = db
  await db.read(data, { readOnly }, AcDbFileType.DXF)
  return db
}

function modelSpaceEntities(db: AcDbDatabase) {
  const out: Array<{
    type: string
    position?: number[]
    start?: number[]
    end?: number[]
    text?: string
  }> = []
  const it = db.tables.blockTable.modelSpace.newIterator()
  for (let r = it.next(); !r.done; r = it.next()) {
    const e = r.value
    if (e instanceof AcDbPoint) {
      out.push({
        type: e.dxfTypeName,
        position: [e.position.x, e.position.y, e.position.z]
      })
    } else if (e instanceof AcDbLine) {
      out.push({
        type: e.dxfTypeName,
        start: [e.startPoint.x, e.startPoint.y, e.startPoint.z],
        end: [e.endPoint.x, e.endPoint.y, e.endPoint.z]
      })
    } else if (e instanceof AcDbText) {
      out.push({
        type: e.dxfTypeName,
        position: [e.position.x, e.position.y, e.position.z],
        text: e.textString
      })
    } else {
      out.push({ type: e.dxfTypeName })
    }
  }
  return out
}

describe('R12 DXF without subclass markers (#245)', () => {
  it('reads POINT / LINE / TEXT geometry and text', async () => {
    const text = [
      '0',
      'SECTION',
      '2',
      'HEADER',
      '9',
      '$ACADVER',
      '1',
      'AC1009',
      '0',
      'ENDSEC',
      r12Tables(),
      '0',
      'SECTION',
      '2',
      'ENTITIES',
      '0',
      'POINT',
      '8',
      '0',
      '10',
      '1.0',
      '20',
      '2.0',
      '30',
      '0.0',
      '0',
      'LINE',
      '8',
      '0',
      '10',
      '0.0',
      '20',
      '0.0',
      '30',
      '0.0',
      '11',
      '10.0',
      '21',
      '5.0',
      '31',
      '0.0',
      '0',
      'TEXT',
      '8',
      '0',
      '10',
      '2.0',
      '20',
      '3.0',
      '30',
      '0.0',
      '40',
      '1.0',
      '1',
      'HELLO',
      '0',
      'ENDSEC',
      '0',
      'EOF'
    ].join('\n')

    const db = await readDxf(toArrayBuffer(Buffer.from(text + '\n', 'utf8')))
    expect(modelSpaceEntities(db)).toEqual([
      { type: 'POINT', position: [1, 2, 0] },
      { type: 'LINE', start: [0, 0, 0], end: [10, 5, 0] },
      { type: 'TEXT', position: [2, 3, 0], text: 'HELLO' }
    ])
  })
})

describe('dxfOut AC1009 code page / polyline XData (#246)', () => {
  it('keeps $DWGCODEPAGE, escapes non-ASCII text, and preserves POLYLINE XData', async () => {
    const asciiPrefix = [
      '0',
      'SECTION',
      '2',
      'HEADER',
      '9',
      '$ACADVER',
      '1',
      'AC1009',
      '9',
      '$DWGCODEPAGE',
      '3',
      'ANSI_1252',
      '0',
      'ENDSEC',
      r12Tables(true),
      '0',
      'SECTION',
      '2',
      'ENTITIES',
      '0',
      'POINT',
      '8',
      '0',
      '10',
      '1.0',
      '20',
      '2.0',
      '30',
      '0.0',
      '1001',
      'REPRO',
      '1000',
      'tag-1',
      '0',
      'POLYLINE',
      '8',
      '0',
      '66',
      '1',
      '10',
      '0.0',
      '20',
      '0.0',
      '30',
      '0.0',
      '70',
      '0',
      '1001',
      'REPRO',
      '1000',
      'tag-1',
      '0',
      'VERTEX',
      '8',
      '0',
      '10',
      '0.0',
      '20',
      '0.0',
      '30',
      '0.0',
      '0',
      'VERTEX',
      '8',
      '0',
      '10',
      '10.0',
      '20',
      '0.0',
      '30',
      '0.0',
      '0',
      'SEQEND',
      '8',
      '0',
      '0',
      'TEXT',
      '8',
      '0',
      '10',
      '2.0',
      '20',
      '3.0',
      '30',
      '0.0',
      '40',
      '1.0',
      '1',
      ''
    ].join('\n')

    const asciiSuffix = ['', '0', 'ENDSEC', '0', 'EOF', ''].join('\n')
    const rebuilt = Buffer.concat([
      Buffer.from(asciiPrefix, 'ascii'),
      Buffer.from([0x63, 0x61, 0x66, 0xe9]), // café in Windows-1252
      Buffer.from(asciiSuffix, 'ascii')
    ])

    const db = await readDxf(toArrayBuffer(rebuilt), false)
    expect(db.dwgCodePage).toBe('ANSI_1252')

    let pointXdata = ''
    let polyXdata = ''
    let textString = ''
    const it = db.tables.blockTable.modelSpace.newIterator()
    for (let r = it.next(); !r.done; r = it.next()) {
      const e = r.value
      const xd = e.getXData('REPRO')
      if (e instanceof AcDbPoint) {
        pointXdata = xd?.at(1)?.value?.toString() ?? ''
      } else if (e instanceof AcDb2dPolyline) {
        polyXdata = xd?.at(1)?.value?.toString() ?? ''
      } else if (e instanceof AcDbText) {
        textString = e.textString
      }
    }
    expect(textString).toBe('café')
    expect(pointXdata).toBe('tag-1')
    expect(polyXdata).toBe('tag-1')

    const out = db.dxfOut() as string
    expect(out).toContain('$ACADVER\n1\nAC1009')
    expect(out).toContain('$DWGCODEPAGE\n3\nANSI_1252')
    expect(out).toContain('\\U+00E9')
    expect(out).not.toMatch(/caf[^\n]*é/)

    const polyIdx = out.indexOf('0\nPOLYLINE\n')
    const vertexIdx = out.indexOf('0\nVERTEX\n', polyIdx)
    const xdataInPoly = out.slice(polyIdx, vertexIdx)
    expect(xdataInPoly).toContain('1001\nREPRO\n')
    expect(xdataInPoly).toContain('1000\ntag-1\n')

    const roundTrip = await readDxf(toArrayBuffer(Buffer.from(out, 'utf8')))
    const entities = modelSpaceEntities(roundTrip)
    const text = entities.find(e => e.type === 'TEXT')
    expect(text?.text).toBe('café')
    expect(text?.position).toEqual([2, 3, 0])
    const point = entities.find(e => e.type === 'POINT')
    expect(point?.position).toEqual([1, 2, 0])
  })
})
