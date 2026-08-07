import { AcDbDxfFiler, acdbHostApplicationServices } from '../src/base'
import { AcDbDatabase, AcDbLayerTableRecord } from '../src/database'
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

describe('DXF group 420 with a zero true colour on a LAYER record', () => {
  function readLayer(...colorPairs: string[]) {
    // dxfIn expects the filer to sit just past the (0, LAYER) pair.
    const dxf = [
      '5',
      '6E',
      '100',
      'AcDbSymbolTableRecord',
      '100',
      'AcDbLayerTableRecord',
      '2',
      'Default',
      '70',
      '0',
      ...colorPairs,
      '6',
      'Continuous',
      '0',
      'ENDTAB'
    ].join('\n')
    const layer = new AcDbLayerTableRecord()
    layer.dxfIn(AcDbDxfFiler.fromString(dxf))
    return layer
  }

  beforeEach(() => {
    createWorkingDb()
  })

  it('keeps the layer ACI when a writer emits 420 0 after it', () => {
    // Worse here than on an entity: every ByLayer entity on the layer turns
    // black and the drawing opens empty. bjnortier/dxf's 1x1rectangle.dxf
    // writes `62 178` then `420 0` on layer "Default".
    const layer = readLayer('62', '178', '420', '0')
    expect(layer.name).toBe('Default')
    expect(layer.color.colorIndex).toBe(178)
    expect(layer.color.isByColor).toBe(false)
  })

  it('still applies a non-zero layer true colour', () => {
    const layer = readLayer('62', '178', '420', String(0x336699))
    expect(layer.color.isByColor).toBe(true)
    expect(layer.color.RGB).toBe(0x336699)
  })

  it('applies 420 0 as black on a layer with no colour index', () => {
    const layer = readLayer('420', '0')
    expect(layer.color.isByColor).toBe(true)
    expect(layer.color.RGB).toBe(0)
  })
})
