/**
 * Node-native ESM integration test (run with `tsx --test`).
 *
 * Loads an AutoCAD DWG with path, polar and rectangular associative arrays
 * through LibreDWG and checks that data-model gets live associative arrays.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  AcDbAssocArrayActionBody,
  AcDbAssocArrayPathParameters,
  AcDbAssocArrayPolarParameters,
  AcDbAssocArrayRectangularParameters,
  AcDbAssocNetwork,
  AcDbBlockReference,
  AcDbDatabase,
  acdbHostApplicationServices
} from '@mlightcad/data-model'

import { AcDbLibreDwgMainThreadConverter } from '../src/AcDbLibreDwgMainThreadConverter.js'

const here = dirname(fileURLToPath(import.meta.url))
const DWG = join(here, 'fixtures', 'assoc-arrays.dwg')

async function readDwg(): Promise<AcDbDatabase> {
  const bytes = readFileSync(DWG)
  const db = new AcDbDatabase()
  acdbHostApplicationServices().workingDatabase = db
  const converter = new AcDbLibreDwgMainThreadConverter({ useWorker: false })
  await converter.read(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    db
  )
  return db
}

function bodyOf(db: AcDbDatabase, handle: string) {
  const ref = db.getObjectById(handle)
  assert.ok(ref instanceof AcDbBlockReference, `INSERT ${handle}`)
  const body = AcDbAssocArrayActionBody.getAssociativeArray(ref)
  assert.ok(body, `associative array ${handle}`)
  return body
}

function assertItemsMatchStored(body: AcDbAssocArrayActionBody) {
  assert.ok(body.items.length > 0)
  for (const item of body.items) {
    const computed = body.getTransform(item.locator).elements
    const stored = item.transform.elements
    for (let i = 0; i < 16; i++) {
      assert.ok(
        Math.abs(computed[i] - stored[i]) < 1e-6,
        `item ${item.locator.toKey()} element ${i}: ${computed[i]} vs ${stored[i]}`
      )
    }
  }
}

test('converts AutoCAD associative arrays from DWG', async () => {
  const db = await readDwg()
  assert.equal(AcDbAssocNetwork.getInstanceFromDatabase(db)?.objectId, '2D9')

  const space = AcDbAssocNetwork.getInstanceFromObject(
    db.tables.blockTable.modelSpace
  )
  assert.equal(space?.objectId, '2D7')
  assert.deepEqual(space?.actionIds, ['2DA', '2F7', '311'])

  const rect = bodyOf(db, '30E')
  const rp = rect.parameters as AcDbAssocArrayRectangularParameters
  assert.ok(rp instanceof AcDbAssocArrayRectangularParameters)
  assert.equal(rp.columnCount, 4)
  assert.equal(rp.rowCount, 4)
  assert.ok(Math.abs(rp.columnSpacing - 399.4309810611176) < 1e-9)
  assert.equal(rect.items.length, 16)
  assert.equal(rect.items[1].entityId, '31B')

  const polar = bodyOf(db, '2F4')
  const pp = polar.parameters as AcDbAssocArrayPolarParameters
  assert.ok(pp instanceof AcDbAssocArrayPolarParameters)
  assert.equal(pp.itemCount, 6)
  assert.ok(Math.abs(pp.radius - 534.7190649377815) < 1e-9)

  const path = bodyOf(db, '2D3')
  const ap = path.parameters as AcDbAssocArrayPathParameters
  assert.ok(ap instanceof AcDbAssocArrayPathParameters)
  assert.equal(ap.itemCount, 7)
  assert.equal(path.getPathCurve()?.objectId, '2C3')

  assertItemsMatchStored(rect)
  assertItemsMatchStored(polar)
  assertItemsMatchStored(path)

  const out = db.dxfOut() as string
  for (const name of [
    'ACDBASSOCNETWORK',
    'ACDBASSOCACTION',
    'ACDBASSOCARRAYACTIONBODY',
    'ACDBASSOCDEPENDENCY',
    'ACDBASSOCVERTEXACTIONPARAM',
    'ACDBASSOCEDGEACTIONPARAM'
  ]) {
    assert.ok(out.includes(`\n${name}\n`), name)
  }
  assert.match(out, /\n5\n2D3\n102\n\{ACAD_REACTORS\n330\n2E2\n102\n\}\n/)
})
