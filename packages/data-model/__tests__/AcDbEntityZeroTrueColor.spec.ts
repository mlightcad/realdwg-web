import { AcDbDxfFiler, acdbHostApplicationServices } from '../src/base'
import { AcDbDatabase } from '../src/database'
import { acdbDxfInEntity } from '../src/dxf/AcDbDxfEntityFactory'
import { AcDbLine } from '../src/entity'

function createWorkingDb() {
  const db = new AcDbDatabase()
  acdbHostApplicationServices().workingDatabase = db
  return db
}

function lineDxf(...colorPairs: string[]) {
  return [
    '0',
    'LINE',
    '100',
    'AcDbEntity',
    '8',
    '0',
    ...colorPairs,
    '100',
    'AcDbLine',
    '10',
    '0.0',
    '20',
    '0.0',
    '30',
    '0.0',
    '11',
    '1.0',
    '21',
    '1.0',
    '31',
    '0.0',
    '0',
    'ENDSEC'
  ].join('\n')
}

describe('DXF group 420 with a zero true colour', () => {
  beforeEach(() => {
    createWorkingDb()
  })

  it('keeps the ACI when a writer emits 420 0 next to a real colour index', () => {
    const line = acdbDxfInEntity(
      AcDbDxfFiler.fromString(lineDxf('62', '18', '420', '0'))
    ) as AcDbLine
    expect(line.color.colorIndex).toBe(18)
    expect(line.color.isByColor).toBe(false)
  })

  it('still applies a non-zero true colour over the ACI', () => {
    const line = acdbDxfInEntity(
      AcDbDxfFiler.fromString(lineDxf('62', '18', '420', String(0xff8000)))
    ) as AcDbLine
    expect(line.color.isByColor).toBe(true)
    expect(line.color.RGB).toBe(0xff8000)
  })

  it('applies 420 0 as black when no colour index preceded it', () => {
    const line = acdbDxfInEntity(
      AcDbDxfFiler.fromString(lineDxf('420', '0'))
    ) as AcDbLine
    expect(line.color.isByColor).toBe(true)
    expect(line.color.RGB).toBe(0)
  })
})
