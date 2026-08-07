import { AcDbDxfFiler, acdbHostApplicationServices } from '../src/base'
import { AcDbDatabase } from '../src/database'
import { acdbDxfInEntity } from '../src/dxf/AcDbDxfEntityFactory'
import { AcDbCircle, AcDbLine, AcDbText } from '../src/entity'

function createWorkingDb() {
  const db = new AcDbDatabase()
  acdbHostApplicationServices().workingDatabase = db
  return db
}

describe('entities written without (100, subclass) markers', () => {
  beforeEach(() => {
    createWorkingDb()
  })

  it('keeps LINE geometry in a DXF R12-style record', () => {
    // No AcDbEntity / AcDbLine markers — how every AC1009 file is written.
    const dxf = [
      '0',
      'LINE',
      '8',
      'A',
      '62',
      '3',
      '10',
      '1.0',
      '20',
      '2.0',
      '30',
      '0.0',
      '11',
      '4.0',
      '21',
      '6.0',
      '31',
      '0.0',
      '0',
      'ENDSEC'
    ].join('\n')

    const line = acdbDxfInEntity(AcDbDxfFiler.fromString(dxf)) as AcDbLine
    expect(line).toBeInstanceOf(AcDbLine)
    // Common fields before the geometry are still read.
    expect(line.layer).toBe('A')
    expect(line.color.colorIndex).toBe(3)
    expect(line.startPoint.x).toBeCloseTo(1)
    expect(line.startPoint.y).toBeCloseTo(2)
    expect(line.endPoint.x).toBeCloseTo(4)
    expect(line.endPoint.y).toBeCloseTo(6)
  })

  it('keeps CIRCLE geometry in a marker-less record', () => {
    const dxf = [
      '0',
      'CIRCLE',
      '8',
      '0',
      '10',
      '3.0',
      '20',
      '4.0',
      '30',
      '0.0',
      '40',
      '5.0',
      '0',
      'ENDSEC'
    ].join('\n')

    const circle = acdbDxfInEntity(AcDbDxfFiler.fromString(dxf)) as AcDbCircle
    expect(circle).toBeInstanceOf(AcDbCircle)
    expect(circle.center.x).toBeCloseTo(3)
    expect(circle.center.y).toBeCloseTo(4)
    expect(circle.radius).toBeCloseTo(5)
  })

  it('still lets a marked entity carry trailing codes the base class ignores', () => {
    // TEXT with markers present: group 7 (style) and 72/73 belong to the
    // derived reader and must not terminate the common-field loop early.
    const dxf = [
      '0',
      'TEXT',
      '100',
      'AcDbEntity',
      '8',
      '0',
      '62',
      '5',
      '100',
      'AcDbText',
      '10',
      '2.0',
      '20',
      '3.0',
      '30',
      '0.0',
      '40',
      '2.5',
      '1',
      'HELLO',
      '7',
      'STANDARD',
      '0',
      'ENDSEC'
    ].join('\n')

    const text = acdbDxfInEntity(AcDbDxfFiler.fromString(dxf)) as AcDbText
    expect(text).toBeInstanceOf(AcDbText)
    expect(text.color.colorIndex).toBe(5)
    expect(text.textString).toBe('HELLO')
    expect(text.height).toBeCloseTo(2.5)
    expect(text.position.x).toBeCloseTo(2)
  })
})
