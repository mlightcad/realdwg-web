import { AcDbDxfFiler, acdbHostApplicationServices } from '../src/base'
import { AcDbDatabase } from '../src/database'
import { AcDbDxfDocumentReader } from '../src/dxf'
import { AcDbLine } from '../src/entity'

function createWorkingDb() {
  const db = new AcDbDatabase()
  acdbHostApplicationServices().workingDatabase = db
  return db
}

function entity(type: string, ...pairs: string[]) {
  return ['0', type, '100', 'AcDbEntity', '8', '0', ...pairs]
}

/**
 * A CIRCLE with a negative radius — AcGeCircArc3d rejects it with
 * "Illegal Parameters".
 * Sits between two well-formed LINEs so a swallowed exception is visible as
 * missing geometry rather than as a thrown error.
 */
const DXF_WITH_BAD_CIRCLE = [
  '0',
  'SECTION',
  '2',
  'ENTITIES',
  ...entity(
    'LINE',
    '100',
    'AcDbLine',
    '10',
    '0.0',
    '20',
    '0.0',
    '30',
    '0.0',
    '11',
    '10.0',
    '21',
    '0.0',
    '31',
    '0.0'
  ),
  ...entity(
    'CIRCLE',
    '100',
    'AcDbCircle',
    '10',
    '5.0',
    '20',
    '5.0',
    '30',
    '0.0',
    '40',
    '-1.0'
  ),
  ...entity(
    'LINE',
    '100',
    'AcDbLine',
    '10',
    '0.0',
    '20',
    '20.0',
    '30',
    '0.0',
    '11',
    '10.0',
    '21',
    '20.0',
    '31',
    '0.0'
  ),
  '0',
  'ENDSEC',
  '0',
  'EOF'
].join('\n')

describe('AcDbDxfDocumentReader malformed entity handling', () => {
  let warn: jest.SpyInstance

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
  })

  it('skips an entity whose reader throws and keeps the rest of the drawing', async () => {
    const db = createWorkingDb()
    const reader = new AcDbDxfDocumentReader(db)
    const result = await reader.read(
      AcDbDxfFiler.fromString(DXF_WITH_BAD_CIRCLE)
    )

    const entities = [...db.tables.blockTable.modelSpace.newIterator()]
    expect(entities).toHaveLength(2)
    expect(entities.every(e => e instanceof AcDbLine)).toBe(true)
    // Crucially the LINE *after* the bad CIRCLE survives.
    expect((entities[1] as AcDbLine).startPoint.y).toBeCloseTo(20)

    expect(result.malformedEntityCount).toBe(1)
    expect(result.unknownEntityCount).toBe(0)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Skipped malformed CIRCLE entity')
    )
  })

  it('counts an unknown type name separately from a malformed one', async () => {
    const dxf = [
      '0',
      'SECTION',
      '2',
      'ENTITIES',
      ...entity('NOT_A_REAL_ENTITY', '90', '1'),
      ...entity(
        'LINE',
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
        '0.0'
      ),
      '0',
      'ENDSEC',
      '0',
      'EOF'
    ].join('\n')

    const db = createWorkingDb()
    const reader = new AcDbDxfDocumentReader(db)
    const result = await reader.read(AcDbDxfFiler.fromString(dxf))

    expect([...db.tables.blockTable.modelSpace.newIterator()]).toHaveLength(1)
    expect(result.unknownEntityCount).toBe(1)
    expect(result.malformedEntityCount).toBe(0)
  })

  it('stops warning after the first ten malformed entities', async () => {
    const badCircle = entity(
      'CIRCLE',
      '100',
      'AcDbCircle',
      '10',
      '0.0',
      '20',
      '0.0',
      '30',
      '0.0',
      '40',
      '-1.0'
    )
    const dxf = ['0', 'SECTION', '2', 'ENTITIES']
      .concat(...Array.from({ length: 12 }, () => badCircle))
      .concat(['0', 'ENDSEC', '0', 'EOF'])
      .join('\n')

    const db = createWorkingDb()
    const reader = new AcDbDxfDocumentReader(db)
    const result = await reader.read(AcDbDxfFiler.fromString(dxf))

    expect(result.malformedEntityCount).toBe(12)
    expect(warn).toHaveBeenCalledTimes(10)
  })
})
