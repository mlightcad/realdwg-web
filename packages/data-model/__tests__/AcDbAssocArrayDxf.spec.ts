import { AcGePoint2d, AcGePoint3d } from '@mlightcad/geometry-engine'
import { readFileSync } from 'fs'
import { join } from 'path'

import { acdbHostApplicationServices } from '../src/base'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbFileType } from '../src/database/AcDbDatabaseConverterManager'
import { AcDbBlockReference } from '../src/entity/AcDbBlockReference'
import { AcDbCircle } from '../src/entity/AcDbCircle'
import { AcDbPolyline } from '../src/entity/AcDbPolyline'
import {
  AcDbAssocAction,
  AcDbAssocArrayActionBody,
  AcDbAssocArrayPathParameters,
  AcDbAssocArrayPolarParameters,
  AcDbAssocArrayRectangularParameters,
  AcDbAssocDependency,
  AcDbAssocManager,
  AcDbAssocNetwork
} from '../src/object/assoc'

const FIXTURE = join(__dirname, 'fixtures', 'assoc-arrays.dxf')

async function readDxf(data: string | Uint8Array) {
  const db = new AcDbDatabase()
  acdbHostApplicationServices().workingDatabase = db
  const buf =
    typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data)
  await db.read(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    { readOnly: false },
    AcDbFileType.DXF
  )
  return db
}

type Tag = [number, string]

/** Splits DXF text into records: `type` → handle → tags. */
function parseRecords(text: string) {
  const lines = text.split(/\r?\n/)
  const records = new Map<string, { type: string; tags: Tag[] }>()
  let current: { type: string; tags: Tag[] } | undefined
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i].trim())
    const value = lines[i + 1].trim()
    if (code === 0) {
      current = { type: value, tags: [] }
      continue
    }
    if (!current) continue
    current.tags.push([code, value])
    if ((code === 5 || code === 105) && current.tags.length === 1) {
      records.set(value.toUpperCase(), current)
    }
  }
  return records
}

function expectSameTags(actual: Tag[], expected: Tag[], label: string) {
  const codes = (tags: Tag[]) => tags.map(t => t[0]).join(',')
  expect(`${label}: ${codes(actual)}`).toBe(`${label}: ${codes(expected)}`)
  for (let i = 0; i < expected.length; i++) {
    const [code, value] = expected[i]
    const got = actual[i][1]
    const a = Number(got)
    const b = Number(value)
    if (
      value !== '' &&
      Number.isFinite(b) &&
      Number.isFinite(a) &&
      code !== 5
    ) {
      expect(Math.abs(a - b)).toBeLessThanOrEqual(
        1e-9 * Math.max(1, Math.abs(b))
      )
    } else {
      expect(`${label}[${i}] ${code}=${got.toUpperCase()}`).toBe(
        `${label}[${i}] ${code}=${value.toUpperCase()}`
      )
    }
  }
}

function arrayInserts(db: AcDbDatabase) {
  const result = new Map<string, AcDbBlockReference>()
  for (const entity of db.tables.blockTable.modelSpace.newIterator()) {
    if (entity instanceof AcDbBlockReference) {
      result.set(entity.objectId.toUpperCase(), entity)
    }
  }
  return result
}

function bodyOf(db: AcDbDatabase, handle: string) {
  const ref = db.getObjectById(handle)
  expect(ref).toBeInstanceOf(AcDbBlockReference)
  const body = AcDbAssocArrayActionBody.getAssociativeArray(
    ref as AcDbBlockReference
  )
  expect(body).toBeDefined()
  return body!
}

/** Compares every computed item transform with the one AutoCAD stored. */
function expectItemsMatchStored(body: AcDbAssocArrayActionBody) {
  expect(body.items.length).toBeGreaterThan(0)
  for (const item of body.items) {
    const computed = body.getTransform(item.locator).elements
    const stored = item.transform.elements
    for (let i = 0; i < 16; i++) {
      expect(computed[i]).toBeCloseTo(stored[i], 6)
    }
  }
}

describe('associative arrays in AutoCAD DXF', () => {
  const original = readFileSync(FIXTURE)

  it('reads the AutoCAD association graph', async () => {
    const db = await readDxf(original)

    const top = AcDbAssocNetwork.getInstanceFromDatabase(db)
    expect(top?.objectId).toBe('2D9')
    const space = AcDbAssocNetwork.getInstanceFromObject(
      db.tables.blockTable.modelSpace
    )
    expect(space?.objectId).toBe('2D7')
    expect(space?.owningNetworkId).toBe('2D9')
    expect(space?.actionIds).toEqual(['2DA', '2F7', '311'])
    expect(top?.actions().map(a => a.objectId)).toEqual(['2D7'])

    const inserts = arrayInserts(db)
    expect(
      AcDbAssocArrayActionBody.isAssociativeArray(inserts.get('2D3')!)
    ).toBe(true)
    expect(
      AcDbAssocArrayActionBody.isAssociativeArray(inserts.get('2F4')!)
    ).toBe(true)
    expect(
      AcDbAssocArrayActionBody.isAssociativeArray(inserts.get('30E')!)
    ).toBe(true)
    const path = db.getObjectById('2C3') as AcDbPolyline
    expect(path).toBeInstanceOf(AcDbPolyline)
    expect(AcDbAssocArrayActionBody.isAssociativeArray(path)).toBe(false)
    expect(path.getPersistentReactors()).toEqual(['2DF'])

    const dep = db.getObjectById('2E2') as AcDbAssocDependency
    expect(dep).toBeInstanceOf(AcDbAssocDependency)
    expect(dep.isReadDependency && dep.isWriteDependency).toBe(true)
    expect(dep.order).toBe(-2147483648)
    expect(dep.dependencyIndex).toBe(4)

    const action = db.getObjectById('2DA') as AcDbAssocAction
    expect(action.valueParamNames()).toContain('FillPath')
    expect(action.getValueParam('Items')).toBe(7)
    expect(action.ownedParams().map(p => p.name)).toEqual([
      'BaseNormal',
      'Origin',
      'RowProfile',
      'basePoint'
    ])
  })

  it('decodes rectangular, polar and path parameters', async () => {
    const db = await readDxf(original)

    const rect = bodyOf(db, '30E')
    const rp = rect.parameters as AcDbAssocArrayRectangularParameters
    expect(rp).toBeInstanceOf(AcDbAssocArrayRectangularParameters)
    expect(rp.columnCount).toBe(4)
    expect(rp.rowCount).toBe(4)
    expect(rp.columnSpacing).toBeCloseTo(399.4309810611176, 9)
    expect(rp.rowSpacing).toBeCloseTo(399.4309810611176, 9)
    expect(rp.axesAngle).toBeCloseTo(Math.PI / 2, 12)
    expect(rect.items).toHaveLength(16)
    expect(rect.sourceBlockName).toBe('*U6')
    expect(rect.arrayBlockName).toBe('*U7')

    const polar = bodyOf(db, '2F4')
    const pp = polar.parameters as AcDbAssocArrayPolarParameters
    expect(pp).toBeInstanceOf(AcDbAssocArrayPolarParameters)
    expect(pp.itemCount).toBe(6)
    expect(pp.angleBetweenItems).toBeCloseTo(Math.PI / 3, 12)
    expect(pp.fillAngle).toBeCloseTo(2 * Math.PI, 12)
    expect(pp.radius).toBeCloseTo(534.7190649377815, 9)
    expect(pp.startAngle).toBeCloseTo(1.544224586452406, 12)
    expect(pp.center.x).toBeCloseTo(4366.865771630857, 9)
    expect(pp.center.y).toBeCloseTo(1291.677829720245, 9)
    expect(pp.rotateItems).toBe(true)
    expect(polar.items).toHaveLength(6)

    const path = bodyOf(db, '2D3')
    const ap = path.parameters as AcDbAssocArrayPathParameters
    expect(ap).toBeInstanceOf(AcDbAssocArrayPathParameters)
    expect(ap.itemCount).toBe(7)
    expect(ap.itemSpacing).toBeCloseTo(411.5410332478213, 9)
    expect(ap.alignItems).toBe(true)
    expect(ap.fillPath).toBe(true)
    expect(path.getPathCurve()?.objectId).toBe('2C3')
    expect(path.items).toHaveLength(7)
  })

  it('computes the item transforms AutoCAD stored', async () => {
    const db = await readDxf(original)
    expectItemsMatchStored(bodyOf(db, '30E'))
    expectItemsMatchStored(bodyOf(db, '2F4'))
    expectItemsMatchStored(bodyOf(db, '2D3'))
  })

  it('writes the association records back in AutoCAD layout', async () => {
    const db = await readDxf(original)
    const out = db.dxfOut() as string
    const before = parseRecords(original.toString('utf8'))
    const after = parseRecords(out)

    const assocHandles = [...before.entries()]
      .filter(([, r]) => r.type.startsWith('ACDBASSOC'))
      .map(([h]) => h)
    // 2 networks, 3 actions, 3 bodies, 10 dependencies, 10 action params.
    expect(assocHandles.length).toBe(28)
    for (const handle of assocHandles) {
      const expected = before.get(handle)!
      const actual = after.get(handle)
      expect(actual?.type).toBe(expected.type)
      expectSameTags(actual!.tags, expected.tags, `${expected.type} ${handle}`)
    }

    // Persistent reactors on the dependent-on objects.
    for (const handle of ['2C3', '2D3', '2CD', '2D0', '30E', '308', '30B']) {
      const tags = after.get(handle)!.tags
      const at = tags.findIndex(t => t[0] === 102 && t[1] === '{ACAD_REACTORS')
      expect(at).toBeGreaterThan(0)
      expect(tags.slice(at, at + 3)).toEqual(
        before.get(handle)!.tags.slice(at, at + 3)
      )
    }

    // The re-read output still carries live arrays.
    const db2 = await readDxf(out)
    expectItemsMatchStored(bodyOf(db2, '30E'))
    expectItemsMatchStored(bodyOf(db2, '2F4'))
    expectItemsMatchStored(bodyOf(db2, '2D3'))
  })

  it('keeps an action with an unmodeled value type verbatim', async () => {
    // Turn the path array's first value (ItemSpacing, a real) into a point,
    // a value kind this reader does not model.
    const lines = original.toString('utf8').split(/\r?\n/)
    const at = lines.findIndex(
      (line, i) => line === 'ItemSpacing' && lines[i + 5].trim() === '40'
    )
    expect(at).toBeGreaterThan(0)
    lines.splice(at + 5, 2, ' 10', '1.5', ' 20', '2.5', ' 30', '3.5')
    const edited = lines.join('\n')

    const db = await readDxf(edited)
    const after = parseRecords(db.dxfOut() as string)
    const before = parseRecords(edited)
    expectSameTags(
      after.get('2DA')!.tags,
      before.get('2DA')!.tags,
      'action 2DA'
    )
    // The graph is still navigable.
    expect(
      AcDbAssocArrayActionBody.isAssociativeArray(
        db.getObjectById('2D3') as AcDbBlockReference
      )
    ).toBe(true)
  })

  it('keeps an item relative transform and second handle', async () => {
    // Give the rectangular array's first item (INSERT 31A) the optional data
    // AutoCAD writes for an individually edited item: flags 2 (relative
    // transform) and 0x10 (second handle).
    const lines = original.toString('utf8').split(/\r?\n/)
    const at = lines.findIndex(
      (line, i) => line.trim() === '330' && lines[i + 1].trim() === '31A'
    )
    expect(at).toBeGreaterThan(0)
    // Item layout before the handle: ... 90 flags, 11/21/31 translation.
    expect(lines[at - 8].trim()).toBe('90')
    lines[at - 7] = '       26'
    const relative = [1, 0, 0, 5, 0, 1, 0, 6, 0, 0, 1, 0, 0, 0, 0, 1].flatMap(
      v => [' 40', String(v)]
    )
    lines.splice(at + 2, 0, '330', '31B')
    lines.splice(at, 0, ...relative)
    const edited = lines.join('\n')

    const db = await readDxf(edited)
    const item = bodyOf(db, '30E').items[0]
    expect(item.entityId).toBe('31A')
    expect(item.secondaryEntityId).toBe('31B')
    expect(item.relativeTransform?.elements[12]).toBe(5)
    const after = parseRecords(db.dxfOut() as string)
    const before = parseRecords(edited)
    expectSameTags(after.get('312')!.tags, before.get('312')!.tags, 'body 312')
  })

  it('re-evaluates an imported array after an edit', async () => {
    const db = await readDxf(original)
    const rect = bodyOf(db, '30E')
    rect.setRowColumnLevel(2, 5)
    expect(AcDbAssocManager.evaluateTopLevelNetwork(db)).toBe(true)
    expect(rect.items).toHaveLength(10)
    expect([...rect.arrayBlock!.newIterator()]).toHaveLength(10)
    expect(rect.action?.getValueParam('Items')).toBe(5)
    expect(rect.action?.getValueParam('Rows')).toBe(2)

    const polar = bodyOf(db, '2F4')
    const pp = polar.parameters as AcDbAssocArrayPolarParameters
    pp.itemCount = 4
    polar.syncParametersToAction()
    polar.markDirty()
    AcDbAssocManager.evaluateTopLevelNetwork(db)
    expect(polar.items).toHaveLength(4)
    expect(polar.action?.getValueParam('ItemSpacing')).toBeCloseTo(
      Math.PI / 2,
      12
    )
  })
})

describe('associative arrays created in data-model', () => {
  async function roundTrip(db: AcDbDatabase) {
    const out = db.dxfOut() as string
    return { out, db: await readDxf(out) }
  }

  it('exports a new rectangular array in AutoCAD layout', async () => {
    const db = new AcDbDatabase()
    db.createDefaultData()
    const circle = new AcDbCircle(new AcGePoint3d(10, 20, 0), 2)
    db.tables.blockTable.modelSpace.appendEntity(circle)
    const created = AcDbAssocArrayActionBody.createInstance(
      [circle.objectId],
      new AcGePoint3d(10, 20, 0),
      new AcDbAssocArrayRectangularParameters(5, 6, 1, 3, 2, 1),
      db
    )

    const { out, db: db2 } = await roundTrip(db)
    const records = [...parseRecords(out).values()]
    const types = records.map(r => r.type)
    expect(types.filter(t => t === 'ACDBASSOCNETWORK')).toHaveLength(2)
    expect(types.filter(t => t === 'ACDBASSOCACTION')).toHaveLength(1)
    expect(types.filter(t => t === 'ACDBASSOCARRAYACTIONBODY')).toHaveLength(1)
    expect(types.filter(t => t === 'ACDBASSOCDEPENDENCY')).toHaveLength(3)
    expect(types.filter(t => t === 'ACDBASSOCVERTEXACTIONPARAM')).toHaveLength(
      3
    )
    const lines = out.split(/\r?\n/)
    const classNames = new Map<string, string>()
    for (let i = 0; i + 1 < lines.length; i += 2) {
      if (lines[i] !== '0' || lines[i + 1] !== 'CLASS') continue
      classNames.set(lines[i + 3], lines[i + 7])
    }
    for (const name of [
      'ACDBASSOCNETWORK',
      'ACDBASSOCACTION',
      'ACDBASSOCARRAYACTIONBODY',
      'ACDBASSOCDEPENDENCY',
      'ACDBASSOCVERTEXACTIONPARAM'
    ]) {
      expect(classNames.get(name)).toBe('ObjectDBX Classes')
    }
    expect(out).not.toContain('ACAD_ASSOARRAYACTIONBODY')

    const ref = db2.getObjectById(created.arrayEntityId) as AcDbBlockReference
    const body = AcDbAssocArrayActionBody.getAssociativeArray(ref)!
    expect(body).toBeDefined()
    const params = body.parameters as AcDbAssocArrayRectangularParameters
    expect(params.columnCount).toBe(3)
    expect(params.rowCount).toBe(2)
    expect(params.columnSpacing).toBe(5)
    expect(params.rowSpacing).toBe(6)
    expect(body.items).toHaveLength(6)
    expectItemsMatchStored(body)
    expect(ref.position.x).toBe(10)
    expect(ref.position.y).toBe(20)
    expect(
      AcDbAssocNetwork.getInstanceFromObject(db2.tables.blockTable.modelSpace)
        ?.owningNetworkId
    ).toBe(AcDbAssocNetwork.getInstanceFromDatabase(db2)?.objectId)
  })

  it('exports new polar and path arrays', async () => {
    const db = new AcDbDatabase()
    db.createDefaultData()
    const space = db.tables.blockTable.modelSpace

    const c1 = new AcDbCircle(new AcGePoint3d(10, 0, 0), 1)
    space.appendEntity(c1)
    const polarParams = new AcDbAssocArrayPolarParameters(Math.PI / 4, 0, 1, 8)
    polarParams.fillAngle = 2 * Math.PI
    polarParams.center = new AcGePoint3d(0, 0, 0)
    const polar = AcDbAssocArrayActionBody.createInstance(
      [c1.objectId],
      new AcGePoint3d(10, 0, 0),
      polarParams,
      db
    )

    const pline = new AcDbPolyline()
    pline.addVertexAt(0, new AcGePoint2d(0, 50))
    pline.addVertexAt(1, new AcGePoint2d(100, 50))
    pline.addVertexAt(2, new AcGePoint2d(100, 150))
    space.appendEntity(pline)
    const c2 = new AcDbCircle(new AcGePoint3d(5, 45, 0), 1)
    space.appendEntity(c2)
    const pathParams = new AcDbAssocArrayPathParameters(25, 1, 1, 9)
    pathParams.setPath({ entityId: pline.objectId })
    const path = AcDbAssocArrayActionBody.createInstance(
      [c2.objectId],
      new AcGePoint3d(5, 45, 0),
      pathParams,
      db
    )

    const { out, db: db2 } = await roundTrip(db)
    expect(out).toContain('ACDBASSOCEDGEACTIONPARAM')

    const polarRef = db2.getObjectById(
      polar.arrayEntityId
    ) as AcDbBlockReference
    const polarBody = AcDbAssocArrayActionBody.getAssociativeArray(polarRef)!
    const pp = polarBody.parameters as AcDbAssocArrayPolarParameters
    expect(pp.itemCount).toBe(8)
    expect(pp.radius).toBeCloseTo(10, 12)
    expect(pp.angleBetweenItems).toBeCloseTo(Math.PI / 4, 12)
    expectItemsMatchStored(polarBody)
    // Item 2 is the source rotated by 90° about the center.
    const item2 = polarBody.items[2].transform.elements
    expect(item2[12]).toBeCloseTo(0, 9)
    expect(item2[13]).toBeCloseTo(10, 9)

    const pathRef = db2.getObjectById(path.arrayEntityId) as AcDbBlockReference
    const pathBody = AcDbAssocArrayActionBody.getAssociativeArray(pathRef)!
    const ap = pathBody.parameters as AcDbAssocArrayPathParameters
    expect(pathBody.getPathCurve()?.objectId).toBe(pline.objectId)
    expect(ap.itemCount).toBe(9)
    expect(pathBody.items).toHaveLength(9)
    expectItemsMatchStored(pathBody)
    // Item 0 sits on the path start; item 5 is on the second segment.
    expect(pathBody.items[0].transform.elements[12]).toBeCloseTo(0, 9)
    expect(pathBody.items[0].transform.elements[13]).toBeCloseTo(50, 9)
    expect(pathBody.items[5].transform.elements[12]).toBeCloseTo(100, 6)
    expect(pathBody.items[5].transform.elements[13]).toBeCloseTo(75, 6)
  })
})
