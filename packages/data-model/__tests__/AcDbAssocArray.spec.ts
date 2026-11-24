import { AcGePoint3d } from '@mlightcad/geometry-engine'

import { AcDbDxfFiler } from '../src/base'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbSystemVariables } from '../src/database/AcDbSystemVariables'
import { AcDbSysVarManager } from '../src/database/AcDbSysVarManager'
import { AcDbBlockReference } from '../src/entity/AcDbBlockReference'
import { AcDbCircle } from '../src/entity/AcDbCircle'
import { AcDbLine } from '../src/entity/AcDbLine'
import {
  AcDbAssocAction,
  AcDbAssocArray,
  AcDbAssocArrayActionBody,
  AcDbAssocArrayPathParameters,
  AcDbAssocArrayPolarParameters,
  AcDbAssocArrayRectangularParameters,
  AcDbAssocManager,
  AcDbAssocStatus
} from '../src/object/assoc'

describe('AcDbAssocArray', () => {
  it('registers ARRAYASSOCIATIVITY / ARRAYTYPE / ARRAYEDITSTATE defaults', () => {
    const db = new AcDbDatabase()
    const mgr = AcDbSysVarManager.instance()
    expect(mgr.getVar(AcDbSystemVariables.ARRAYASSOCIATIVITY, db)).toBe(1)
    expect(mgr.getVar(AcDbSystemVariables.ARRAYTYPE, db)).toBe(0)
    expect(mgr.getVar(AcDbSystemVariables.ARRAYEDITSTATE, db)).toBe(0)

    expect(() =>
      mgr.setVar(AcDbSystemVariables.ARRAYEDITSTATE, 1, db)
    ).toThrow(/read-only/i)
    mgr.setArrayEditState(1)
    expect(mgr.getVar(AcDbSystemVariables.ARRAYEDITSTATE, db)).toBe(1)
    mgr.setArrayEditState(0)

    mgr.setVar(AcDbSystemVariables.ARRAYTYPE, 2, db)
    expect(mgr.getVar(AcDbSystemVariables.ARRAYTYPE, db)).toBe(2)
    mgr.setVar(AcDbSystemVariables.ARRAYTYPE, 0, db)
  })

  it('createInstance builds a rectangular associative array INSERT', () => {
    const db = new AcDbDatabase()
    const circle = new AcDbCircle(new AcGePoint3d(1, 1, 0), 0.5)
    db.tables.blockTable.modelSpace.appendEntity(circle)

    const params = new AcDbAssocArrayRectangularParameters(
      10,
      10,
      1,
      3,
      2,
      1,
      0,
      Math.PI / 2
    )

    const result = AcDbAssocArrayActionBody.createInstance(
      [circle.objectId],
      new AcGePoint3d(1, 1, 0),
      params,
      db
    )

    const arrayEntity = db.getObjectById(result.arrayEntityId)
    expect(arrayEntity).toBeInstanceOf(AcDbBlockReference)
    expect(
      AcDbAssocArrayActionBody.isAssociativeArray(arrayEntity as AcDbBlockReference)
    ).toBe(true)

    const body = db.getObjectById(result.actionBodyId)
    expect(body).toBeInstanceOf(AcDbAssocArrayActionBody)

    const arrayRef = arrayEntity as AcDbBlockReference
    const arrayBtr = arrayRef.blockTableRecord
    expect(arrayBtr).toBeDefined()

    let itemCount = 0
    for (const _ of arrayBtr!.newIterator()) {
      itemCount++
    }
    expect(itemCount).toBe(6) // 3 columns × 2 rows

    // Source circle should have been erased from model space.
    expect(db.tables.blockTable.getEntityById(circle.objectId)).toBeUndefined()

    expect(AcDbAssocManager.evaluateTopLevelNetwork(db)).toBe(true)
  })

  it('AcDbAssocArray.createArray returns a wrapper', () => {
    const db = new AcDbDatabase()
    const circle = new AcDbCircle(new AcGePoint3d(0, 0, 0), 1)
    db.tables.blockTable.modelSpace.appendEntity(circle)

    const array = AcDbAssocArray.createArray(
      [circle.objectId],
      new AcGePoint3d(0, 0, 0),
      new AcDbAssocArrayRectangularParameters(5, 5, 1, 2, 2, 1),
      db
    )

    expect(array.arrayEntityId).toBeTruthy()
    expect(array.getParameters()?.parameterType).toBe('rectangular')
  })

  it('exposes count grips and updates column count on drag', () => {
    const db = new AcDbDatabase()
    const circle = new AcDbCircle(new AcGePoint3d(0, 0, 0), 0.5)
    db.tables.blockTable.modelSpace.appendEntity(circle)

    const params = new AcDbAssocArrayRectangularParameters(
      10,
      10,
      1,
      3,
      2,
      1
    )
    const result = AcDbAssocArrayActionBody.createInstance(
      [circle.objectId],
      new AcGePoint3d(0, 0, 0),
      params,
      db
    )
    const ref = db.getObjectById(result.arrayEntityId) as AcDbBlockReference
    const grips = ref.subGetGripPoints()
    expect(grips.length).toBe(3)

    ref.subMoveGripPointsAt([1], { x: 10, y: 0, z: 0 })
    const body = AcDbAssocArrayActionBody.getAssociativeArray(ref)!
    const updated = body.parameters as AcDbAssocArrayRectangularParameters
    expect(updated.columnCount).toBe(4)

    let itemCount = 0
    for (const _ of ref.blockTableRecord!.newIterator()) itemCount++
    expect(itemCount).toBe(8) // 4×2
  })

  it('polar fillAngle setter keeps angleBetween = fill / (itemCount - 1)', () => {
    const params = new AcDbAssocArrayPolarParameters(
      Math.PI / 3,
      0,
      1,
      6,
      1,
      1,
      0
    )
    params.fillAngle = Math.PI / 2
    expect(params.angleBetweenItems).toBeCloseTo(Math.PI / 10, 10)
    expect(params.getItemLocators()).toHaveLength(6)
  })

  it('explode of associative array yields leaf entities and clears assoc', () => {
    const db = new AcDbDatabase()
    const circle = new AcDbCircle(new AcGePoint3d(0, 0, 0), 0.5)
    db.tables.blockTable.modelSpace.appendEntity(circle)

    const result = AcDbAssocArrayActionBody.createInstance(
      [circle.objectId],
      new AcGePoint3d(0, 0, 0),
      new AcDbAssocArrayRectangularParameters(5, 5, 1, 2, 2, 1),
      db
    )
    const ref = db.getObjectById(result.arrayEntityId) as AcDbBlockReference
    expect(AcDbAssocArrayActionBody.isAssociativeArray(ref)).toBe(true)

    const parts = ref.explode()
    expect(parts.length).toBe(4) // 2×2 circles
    expect(AcDbAssocArrayActionBody.isAssociativeArray(ref)).toBe(false)
    expect(db.objects.assocActionBody.numEntries).toBe(0)
  })

  it('rejects createInstance when no source entity resolves', () => {
    const db = new AcDbDatabase()
    expect(() =>
      AcDbAssocArrayActionBody.createInstance(
        ['missing-id'],
        new AcGePoint3d(0, 0, 0),
        new AcDbAssocArrayRectangularParameters(5, 5, 1, 2, 2, 1),
        db
      )
    ).toThrow(/no valid source entities/i)
  })

  it('rejects path createInstance without a path curve', () => {
    const db = new AcDbDatabase()
    const circle = new AcDbCircle(new AcGePoint3d(0, 0, 0), 0.5)
    db.tables.blockTable.modelSpace.appendEntity(circle)
    expect(() =>
      AcDbAssocArrayActionBody.createInstance(
        [circle.objectId],
        new AcGePoint3d(0, 0, 0),
        new AcDbAssocArrayPathParameters(5, 5, 1, 3, 1, 1),
        db
      )
    ).toThrow(/path curve/i)
  })

  it('polar createInstance places items around the configured center', () => {
    const db = new AcDbDatabase()
    const circle = new AcDbCircle(new AcGePoint3d(10, 0, 0), 0.5)
    db.tables.blockTable.modelSpace.appendEntity(circle)

    const params = new AcDbAssocArrayPolarParameters(
      Math.PI / 2,
      0,
      1,
      4,
      1,
      1,
      0
    )
    params.center = new AcGePoint3d(0, 0, 0)

    const result = AcDbAssocArrayActionBody.createInstance(
      [circle.objectId],
      new AcGePoint3d(10, 0, 0),
      params,
      db
    )
    const ref = db.getObjectById(result.arrayEntityId) as AcDbBlockReference
    const body = AcDbAssocArrayActionBody.getAssociativeArray(ref)!
    const polar = body.parameters as AcDbAssocArrayPolarParameters
    expect(polar.center.x).toBeCloseTo(0, 10)
    expect(polar.basePoint.x).toBeCloseTo(10, 10)

    const positions: AcGePoint3d[] = []
    for (const item of ref.blockTableRecord!.newIterator()) {
      expect(item).toBeInstanceOf(AcDbBlockReference)
      positions.push((item as AcDbBlockReference).position.clone())
    }
    expect(positions).toHaveLength(4)
    // Item 0 stays at array-BTR origin; item 1 rotates 90° CCW about center.
    expect(positions[0].x).toBeCloseTo(0, 6)
    expect(positions[0].y).toBeCloseTo(0, 6)
    expect(positions[1].x).toBeCloseTo(-10, 6)
    expect(positions[1].y).toBeCloseTo(10, 6)
  })

  it('erase of associative array tears down the action graph', () => {
    const db = new AcDbDatabase()
    const circle = new AcDbCircle(new AcGePoint3d(0, 0, 0), 0.5)
    db.tables.blockTable.modelSpace.appendEntity(circle)

    const result = AcDbAssocArrayActionBody.createInstance(
      [circle.objectId],
      new AcGePoint3d(0, 0, 0),
      new AcDbAssocArrayRectangularParameters(5, 5, 1, 2, 2, 1),
      db
    )
    const ref = db.getObjectById(result.arrayEntityId) as AcDbBlockReference
    expect(db.objects.assocActionBody.numEntries).toBe(1)
    expect(db.objects.assocAction.numEntries).toBe(1)

    expect(ref.erase()).toBe(true)
    expect(db.objects.assocActionBody.numEntries).toBe(0)
    expect(db.objects.assocAction.numEntries).toBe(0)
    expect(db.objects.assocDependency.numEntries).toBe(0)
  })

  it('AcDbAssocAction DXF round-trips status and dependency ids', () => {
    // Use hex handles so writeObjectId preserves them verbatim.
    const action = new AcDbAssocAction()
    action.owningNetworkId = 'A10'
    action.actionBodyId = 'B20'
    action.status = AcDbAssocStatus.IsUpToDateAssocStatus // 0 — must not be read as dep count
    action.addDependencyId('C30')
    action.addDependencyId('C31')

    const out = new AcDbDxfFiler()
    action.dxfOutFields(out)
    const restored = new AcDbAssocAction()
    restored.dxfInFields(AcDbDxfFiler.fromString(out.toString()))

    expect(restored.owningNetworkId).toBe('A10')
    expect(restored.actionBodyId).toBe('B20')
    expect(restored.status).toBe(AcDbAssocStatus.IsUpToDateAssocStatus)
    expect(restored.dependencyIds).toEqual(['C30', 'C31'])
  })

  it('path createInstance binds the path curve and distributes items', () => {
    const db = new AcDbDatabase()
    const circle = new AcDbCircle(new AcGePoint3d(0, 0, 0), 0.5)
    const path = new AcDbLine(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(30, 0, 0)
    )
    db.tables.blockTable.modelSpace.appendEntity(circle)
    db.tables.blockTable.modelSpace.appendEntity(path)

    const params = new AcDbAssocArrayPathParameters(10, 5, 1, 4, 1, 1)
    params.setPath({ entityId: path.objectId })

    const result = AcDbAssocArrayActionBody.createInstance(
      [circle.objectId],
      new AcGePoint3d(0, 0, 0),
      params,
      db
    )
    const ref = db.getObjectById(result.arrayEntityId) as AcDbBlockReference
    let itemCount = 0
    for (const _ of ref.blockTableRecord!.newIterator()) itemCount++
    expect(itemCount).toBe(4)
  })
})
