import { AcGiLineWeight } from '@mlightcad/data-model'
import type { DwgDatabase } from '@mlightcad/libredwg-web'

import {
  acdbLineWeightFromDwgIndex,
  acdbNormalizeLibreDwgLineWeights
} from '../src/normalizeLibreDwgLineWeights'

const makeDatabase = (acadver: string, entityWeight: number) => {
  const line = { type: 'LINE', lineweight: entityWeight }
  const attrib = { type: 'ATTRIB', lineweight: 30 }
  const insert = { type: 'INSERT', lineweight: 7, attribs: [attrib] }
  const blockLine = { type: 'LINE', lineweight: 31 }
  const modelSpace = [line, insert]
  const database = {
    header: { ACADVER: acadver },
    // Model space is shared between `entities` and its block record.
    entities: modelSpace,
    tables: {
      LAYER: { entries: [{ name: '0', lineweight: 29 }] },
      BLOCK_RECORD: {
        entries: [
          { name: '*Model_Space', entities: modelSpace },
          { name: 'B', entities: [blockLine] }
        ]
      }
    }
  } as unknown as DwgDatabase
  return { database, line, attrib, insert, blockLine }
}

describe('acdbLineWeightFromDwgIndex', () => {
  it('maps standard and symbolic DWG indexes', () => {
    expect(acdbLineWeightFromDwgIndex(0)).toBe(AcGiLineWeight.LineWeight000)
    expect(acdbLineWeightFromDwgIndex(7)).toBe(AcGiLineWeight.LineWeight025)
    expect(acdbLineWeightFromDwgIndex(23)).toBe(AcGiLineWeight.LineWeight211)
    expect(acdbLineWeightFromDwgIndex(29)).toBe(AcGiLineWeight.ByLayer)
    expect(acdbLineWeightFromDwgIndex(30)).toBe(AcGiLineWeight.ByBlock)
    expect(acdbLineWeightFromDwgIndex(31)).toBe(
      AcGiLineWeight.ByLineWeightDefault
    )
  })

  it('falls back for unused indexes', () => {
    expect(acdbLineWeightFromDwgIndex(25)).toBe(AcGiLineWeight.ByLayer)
    expect(
      acdbLineWeightFromDwgIndex(25, AcGiLineWeight.ByLineWeightDefault)
    ).toBe(AcGiLineWeight.ByLineWeightDefault)
  })
})

describe('acdbNormalizeLibreDwgLineWeights', () => {
  it('converts DWG entity and layer indexes exactly once', () => {
    const { database, line, attrib, insert, blockLine } = makeDatabase(
      'AC1032',
      29
    )
    acdbNormalizeLibreDwgLineWeights(database, true)

    expect(line.lineweight).toBe(AcGiLineWeight.ByLayer)
    expect(insert.lineweight).toBe(AcGiLineWeight.LineWeight025)
    expect(attrib.lineweight).toBe(AcGiLineWeight.ByBlock)
    expect(blockLine.lineweight).toBe(AcGiLineWeight.ByLineWeightDefault)
    expect(database.tables.LAYER.entries[0].lineweight).toBe(
      AcGiLineWeight.ByLayer
    )
  })

  it('converts DXF entity and layer indexes too', () => {
    // LibreDWG maps DXF group 370 to the DWG index while reading, so a
    // ByBlock (-2) entity arrives as index 30, not 0.30 mm.
    const { database, line, blockLine } = makeDatabase('AC1032', 30)
    acdbNormalizeLibreDwgLineWeights(database, false)

    expect(line.lineweight).toBe(AcGiLineWeight.ByBlock)
    expect(blockLine.lineweight).toBe(AcGiLineWeight.ByLineWeightDefault)
    expect(database.tables.LAYER.entries[0].lineweight).toBe(
      AcGiLineWeight.ByLayer
    )
  })

  it('treats a pre-R2000 DXF as having lineweights', () => {
    const { database, line } = makeDatabase('AC1009', 8)
    acdbNormalizeLibreDwgLineWeights(database, false)

    expect(line.lineweight).toBe(AcGiLineWeight.LineWeight030)
  })

  it('treats pre-R2000 DWG lineweights as ByLayer / Default', () => {
    const { database, line, blockLine } = makeDatabase('AC1014', 0)
    acdbNormalizeLibreDwgLineWeights(database, true)

    expect(line.lineweight).toBe(AcGiLineWeight.ByLayer)
    expect(blockLine.lineweight).toBe(AcGiLineWeight.ByLayer)
    expect(database.tables.LAYER.entries[0].lineweight).toBe(
      AcGiLineWeight.ByLineWeightDefault
    )
  })
})
