import { AcDbDxfFiler, acdbHostApplicationServices } from '../src/base'
import { AcDbDatabase } from '../src/database'
import { acdbDxfInEntity } from '../src/dxf/AcDbDxfEntityFactory'
import { AcDbArcDimension, AcDbLine, AcDbSpline } from '../src/entity'

function createWorkingDb() {
  const db = new AcDbDatabase()
  acdbHostApplicationServices().workingDatabase = db
  return db
}

/** A degree-1 spline through four points, written as SPLINE group codes. */
const SPLINE_PAIRS = [
  '100',
  'AcDbSpline',
  '70',
  '8',
  '71',
  '1',
  '72',
  '6',
  '73',
  '4',
  '74',
  '0',
  '40',
  '0.0',
  '40',
  '0.0',
  '40',
  '1.0',
  '40',
  '2.0',
  '40',
  '3.0',
  '40',
  '3.0',
  '10',
  '0.0',
  '20',
  '0.0',
  '30',
  '0.0',
  '10',
  '1.0',
  '20',
  '4.0',
  '30',
  '0.0',
  '10',
  '2.0',
  '20',
  '4.0',
  '30',
  '0.0',
  '10',
  '3.0',
  '20',
  '0.0',
  '30',
  '0.0'
]

describe('DXF entity type aliases', () => {
  beforeEach(() => {
    createWorkingDb()
  })

  it('reads 3DLINE, the DXF R10 name for LINE', () => {
    const dxf = [
      '0',
      '3DLINE',
      '100',
      'AcDbEntity',
      '8',
      '0',
      '100',
      'AcDbLine',
      '10',
      '5.0',
      '20',
      '9.0',
      '30',
      '0.0',
      '11',
      '6.0',
      '21',
      '10.0',
      '31',
      '1.0',
      '0',
      'ENDSEC'
    ].join('\n')

    const entity = acdbDxfInEntity(AcDbDxfFiler.fromString(dxf))
    expect(entity).toBeInstanceOf(AcDbLine)
    const line = entity as AcDbLine
    expect(line.startPoint.x).toBeCloseTo(5)
    expect(line.startPoint.y).toBeCloseTo(9)
    expect(line.endPoint.x).toBeCloseTo(6)
    expect(line.endPoint.y).toBeCloseTo(10)
    expect(line.endPoint.z).toBeCloseTo(1)
  })

  it('reads ARC_DIMENSION, the arc-length dimension written under its own name', () => {
    const dxf = [
      '0',
      'ARC_DIMENSION',
      '100',
      'AcDbEntity',
      '8',
      '0',
      '100',
      'AcDbDimension',
      '10',
      '50.0',
      '20',
      '40.0',
      '30',
      '0.0',
      '11',
      '50.0',
      '21',
      '41.875',
      '31',
      '0.0',
      '70',
      '40',
      '100',
      'AcDbArcDimension',
      '13',
      '30.0',
      '23',
      '20.0',
      '33',
      '0.0',
      '14',
      '70.0',
      '24',
      '20.0',
      '34',
      '0.0',
      '15',
      '50.0',
      '25',
      '-17.5',
      '35',
      '0.0',
      '0',
      'ENDSEC'
    ].join('\n')

    const entity = acdbDxfInEntity(AcDbDxfFiler.fromString(dxf))
    expect(entity).toBeInstanceOf(AcDbArcDimension)
    const dim = entity as AcDbArcDimension
    expect(dim.xLine1Point.x).toBeCloseTo(30)
    expect(dim.xLine2Point.x).toBeCloseTo(70)
    expect(dim.centerPoint.y).toBeCloseTo(-17.5)
  })

  it('reads HELIX through its AcDbSpline base class', () => {
    const dxf = ['0', 'HELIX', '100', 'AcDbEntity', '8', '0']
      .concat(SPLINE_PAIRS)
      .concat(['0', 'ENDSEC'])
      .join('\n')

    const entity = acdbDxfInEntity(AcDbDxfFiler.fromString(dxf))
    expect(entity).toBeInstanceOf(AcDbSpline)
    const extents = (entity as AcDbSpline).geometricExtents
    expect(extents.min.x).toBeCloseTo(0)
    expect(extents.max.x).toBeCloseTo(3)
  })

  it('stops HELIX at the AcDbHelix marker so axis fields are not read as spline data', () => {
    // Groups 10/20/30 and 40 recur in the AcDbHelix section (axis base point
    // and radius). Read as spline data they add a control point and a knot.
    const helixTail = [
      '100',
      'AcDbHelix',
      '90',
      '33',
      '91',
      '29',
      '10',
      '900.0',
      '20',
      '900.0',
      '30',
      '0.0',
      '11',
      '0.0',
      '21',
      '0.0',
      '31',
      '0.0',
      '12',
      '0.0',
      '22',
      '0.0',
      '32',
      '1.0',
      '40',
      '6.82',
      '41',
      '3.0',
      '42',
      '0.333',
      '290',
      '1',
      '280',
      '1'
    ]
    const dxf = ['0', 'HELIX', '100', 'AcDbEntity', '8', '0']
      .concat(SPLINE_PAIRS)
      .concat(helixTail)
      .concat(['0', 'ENDSEC'])
      .join('\n')

    const entity = acdbDxfInEntity(AcDbDxfFiler.fromString(dxf))
    expect(entity).toBeInstanceOf(AcDbSpline)
    const extents = (entity as AcDbSpline).geometricExtents
    // The (900, 900) axis base point must not have been folded into the curve.
    expect(extents.max.x).toBeCloseTo(3)
    expect(extents.max.y).toBeLessThan(10)
  })

  it('leaves the filer on the next entity after reading a HELIX', () => {
    const dxf = ['0', 'HELIX', '100', 'AcDbEntity', '8', '0']
      .concat(SPLINE_PAIRS)
      .concat([
        '100',
        'AcDbHelix',
        '90',
        '33',
        '40',
        '6.82',
        '0',
        'LINE',
        '100',
        'AcDbEntity',
        '8',
        '0',
        '100',
        'AcDbLine',
        '10',
        '1.0',
        '20',
        '2.0',
        '30',
        '0.0',
        '11',
        '3.0',
        '21',
        '4.0',
        '31',
        '0.0',
        '0',
        'ENDSEC'
      ])
      .join('\n')

    const filer = AcDbDxfFiler.fromString(dxf)
    expect(acdbDxfInEntity(filer)).toBeInstanceOf(AcDbSpline)
    // Trailing AcDbHelix pairs are left in the stream; the document reader
    // skips non-zero codes, so mirror that before reading the next entity.
    while (!filer.atEof) {
      const item = filer.peekItem()
      if (!item || Number(item.code) === 0) break
      filer.readItem()
    }
    const line = acdbDxfInEntity(filer)
    expect(line).toBeInstanceOf(AcDbLine)
    expect((line as AcDbLine).endPoint.x).toBeCloseTo(3)
  })
})
