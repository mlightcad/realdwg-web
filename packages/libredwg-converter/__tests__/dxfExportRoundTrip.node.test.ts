/**
 * Node-native ESM integration test (run with `tsx --test`).
 * Jest cannot load libredwg-web's ESM WASM glue via its CJS UMD entry.
 *
 * Covers: data-model dxfOut → LibreDWG WASM DXF read (#294).
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AcDbDatabase,
  AcDbLine,
  AcGePoint3d,
  acdbHostApplicationServices
} from '@mlightcad/data-model'
import { Dwg_File_Type } from '@mlightcad/libredwg-web'

import { AcDbLibreDwgMainThreadConverter } from '../src/AcDbLibreDwgMainThreadConverter.js'
import {
  detectLibreDwgFileType,
  parseDxf
} from '../src/AcDbLibreDwgConverterUtil.js'

function asciiDxfToBuffer(dxf: string): ArrayBuffer {
  return new TextEncoder().encode(dxf).buffer
}

/** Collect each VPORT table-record body from the TABLES section. */
function vportTableRecordBodies(dxf: string): string[] {
  const tablesStart = dxf.indexOf('0\nSECTION\n2\nTABLES\n')
  assert.ok(tablesStart >= 0)
  const tablesEnd = dxf.indexOf('\n0\nENDSEC\n', tablesStart)
  const tables = dxf.slice(tablesStart, tablesEnd)
  const bodies: string[] = []
  let searchFrom = 0
  while (true) {
    const start = tables.indexOf('0\nVPORT\n', searchFrom)
    if (start < 0) break
    let j = start + '0\nVPORT\n'.length
    let end = tables.length
    while (true) {
      const p = tables.indexOf('\n0\n', j)
      if (p < 0) break
      const type = tables.slice(p + 3).split('\n')[0]
      if (/^[A-Z_*]/.test(type)) {
        end = p
        break
      }
      j = p + 3
    }
    bodies.push(tables.slice(start, end))
    searchFrom = end
  }
  return bodies
}

test('detectLibreDwgFileType distinguishes ASCII DXF from DWG', () => {
  assert.equal(
    detectLibreDwgFileType('0\nSECTION\n2\nHEADER\n'),
    Dwg_File_Type.DXF
  )
  assert.equal(
    detectLibreDwgFileType(asciiDxfToBuffer('999\ncomment\n')),
    Dwg_File_Type.DXF
  )
  assert.equal(
    detectLibreDwgFileType(new TextEncoder().encode('AC1015').buffer),
    Dwg_File_Type.DWG
  )
})

test(
  'default AC1015 dxfOut is readable by LibreDWG (no invalid VPORT group 45)',
  async () => {
    const source = new AcDbDatabase()
    acdbHostApplicationServices().workingDatabase = source
    source.createDefaultData()

    const line = new AcDbLine(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(10, 20, 0)
    )
    line.layer = '0'
    source.tables.blockTable.modelSpace.appendEntity(line)

    const dxf = source.dxfOut(undefined, 6, 'AC1015') as string
    assert.equal(typeof dxf, 'string')

    for (const body of vportTableRecordBodies(dxf)) {
      assert.equal(
        /\n45\n/.test(body),
        false,
        'VPORT table record must not emit DXF group 45'
      )
      assert.equal(
        /\n292\n/.test(body),
        false,
        'AC1015 VPORT must not emit R2007+ lighting group 292'
      )
      assert.match(body, /\n40\n/)
    }

    const parsed = await parseDxf(dxf)
    assert.ok(parsed.database.tables.VPORT.entries.length > 0)
    assert.ok(
      parsed.database.tables.VPORT.entries.some(e =>
        /^\*ACTIVE$/i.test(e.name)
      )
    )
    assert.ok(parsed.database.entities.length >= 1)

    const target = new AcDbDatabase()
    const converter = new AcDbLibreDwgMainThreadConverter({ useWorker: false })
    await converter.read(asciiDxfToBuffer(dxf), target)

    const entities = [...target.tables.blockTable.modelSpace.newIterator()]
    assert.ok(entities.some(e => e instanceof AcDbLine))

    const active = target.tables.viewportTable.getAt('*Active')
    assert.ok(active)
    assert.ok(active.viewHeight > 0)
  }
)

test('R2000+ keeps no-plot layers even when every layer is no-plot', async () => {
  const source = new AcDbDatabase()
  acdbHostApplicationServices().workingDatabase = source
  source.createDefaultData()
  for (const layer of source.tables.layerTable.newIterator()) {
    layer.isPlottable = false
  }

  const dxf = source.dxfOut(undefined, 6, 'AC1015') as string

  const parsed = await parseDxf(dxf)
  assert.equal(parsed.database.header.ACADVER, 'AC1015')

  const target = new AcDbDatabase()
  const converter = new AcDbLibreDwgMainThreadConverter({ useWorker: false })
  await converter.read(asciiDxfToBuffer(dxf), target)

  const layer0 = target.tables.layerTable.getAt('0')
  assert.ok(layer0)
  assert.equal(layer0.isPlottable, false)
})
