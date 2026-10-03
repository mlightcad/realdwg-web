import { AcGePoint3d } from '@mlightcad/geometry-engine'

import { acdbHostApplicationServices, acdbWithDatabase } from '../src/base'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbNativeDxfConverter } from '../src/dxf/AcDbNativeDxfConverter'
import { AcDbLine } from '../src/entity/AcDbLine'

function line() {
  return new AcDbLine(new AcGePoint3d(), new AcGePoint3d(1, 0, 0))
}

function drawing(endX: number, units: number) {
  return new TextEncoder().encode(
    [
      '0',
      'SECTION',
      '2',
      'HEADER',
      '9',
      '$INSUNITS',
      '70',
      String(units),
      '0',
      'ENDSEC',
      '0',
      'SECTION',
      '2',
      'ENTITIES',
      '0',
      'LINE',
      '5',
      '100',
      '100',
      'AcDbEntity',
      '8',
      '0',
      '100',
      'AcDbLine',
      '10',
      '0',
      '20',
      '0',
      '30',
      '0',
      '11',
      String(endX),
      '21',
      '0',
      '31',
      '0',
      '0',
      'ENDSEC',
      '0',
      'EOF',
      ''
    ].join('\n')
  ).buffer as ArrayBuffer
}

describe('reference database reading', () => {
  it('keeps the active document and its equal-handle entity through concurrent DXF reads', async () => {
    const host = new AcDbDatabase()
    host.createDefaultData()
    acdbHostApplicationServices().workingDatabase = host
    const original = line()
    original.objectId = '100'
    host.tables.blockTable.modelSpace.appendEntity(original)
    expect(host.tables.blockTable.modelSpace.getIdAt('100')).toBe(original)
    const a = new AcDbDatabase()
    const b = new AcDbDatabase()
    let callbacks = 0
    for (const db of [a, b]) {
      db.events.openProgress.addEventListener(() => {
        callbacks++
        expect(acdbHostApplicationServices().workingDatabase).toBe(host)
        expect(line().database).toBe(host)
      })
    }
    await Promise.all([
      a.read(drawing(12, 4), {
        activateWorkingDatabase: false,
        minimumChunkSize: 1
      }),
      b.read(drawing(73, 6), {
        activateWorkingDatabase: false,
        minimumChunkSize: 1
      })
    ])
    const aLine = a.tables.blockTable.modelSpace.getIdAt('100') as AcDbLine
    const bLine = b.tables.blockTable.modelSpace.getIdAt('100') as AcDbLine
    expect(aLine.database).toBe(a)
    expect(bLine.database).toBe(b)
    expect(aLine.endPoint.x).toBe(12)
    expect(bLine.endPoint.x).toBe(73)
    expect(a.insunits).toBe(4)
    expect(b.insunits).toBe(6)
    expect(host.tables.blockTable.modelSpace.getIdAt('100')).toBe(original)
    expect(original.endPoint.x).toBe(1)
    expect(acdbHostApplicationServices().workingDatabase).toBe(host)
    expect(callbacks).toBeGreaterThan(0)
  })

  it('leaves a newly selected host active when a reference completes', async () => {
    const firstHost = new AcDbDatabase()
    const nextHost = new AcDbDatabase()
    const source = new AcDbDatabase()
    acdbHostApplicationServices().workingDatabase = firstHost
    source.events.openProgress.addEventListener(() => {
      acdbHostApplicationServices().workingDatabase = nextHost
    })
    await source.read(drawing(2, 6), { activateWorkingDatabase: false })
    expect(acdbHostApplicationServices().workingDatabase).toBe(nextHost)
    expect(
      (source.tables.blockTable.modelSpace.getIdAt('100') as AcDbLine).database
    ).toBe(source)
  })

  it('restores nested construction scopes on failure without switching the active document', () => {
    const host = new AcDbDatabase()
    const source = new AcDbDatabase()
    const nested = new AcDbDatabase()
    acdbHostApplicationServices().workingDatabase = host
    acdbWithDatabase(source, () => {
      expect(line().database).toBe(source)
      expect(() =>
        acdbWithDatabase(nested, () => {
          expect(line().database).toBe(nested)
          throw new Error('conversion failed')
        })
      ).toThrow('conversion failed')
      expect(line().database).toBe(source)
      expect(acdbHostApplicationServices().workingDatabase).toBe(host)
    })
    expect(line().database).toBe(host)
  })

  it('cancels native DXF at a progress boundary without reporting successful completion', async () => {
    const host = new AcDbDatabase()
    const source = new AcDbDatabase()
    const controller = new AbortController()
    const completed: string[] = []
    acdbHostApplicationServices().workingDatabase = host
    await expect(
      new AcDbNativeDxfConverter().read(drawing(2, 6), source, {
        signal: controller.signal,
        progress: async (_percentage, stage, status) => {
          if (stage === 'PARSE' && status === 'START') controller.abort()
          if (stage === 'END') completed.push(stage)
        }
      })
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(completed).toEqual([])
    expect(acdbHostApplicationServices().workingDatabase).toBe(host)
  })
})
