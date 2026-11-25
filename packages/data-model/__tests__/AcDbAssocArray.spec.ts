import { AcGePoint2d, AcGePoint3d } from '@mlightcad/geometry-engine'

import { AcDbDxfFiler } from '../src/base'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbSystemVariables } from '../src/database/AcDbSystemVariables'
import { AcDbSysVarManager } from '../src/database/AcDbSysVarManager'
import { AcDbBlockReference } from '../src/entity/AcDbBlockReference'
import { AcDbCircle } from '../src/entity/AcDbCircle'
import { AcDbLine } from '../src/entity/AcDbLine'
import { AcDbPolyline } from '../src/entity/AcDbPolyline'
import {
  AcDbAssocAction,
  AcDbAssocArray,
  AcDbAssocArrayActionBody,
  AcDbAssocArrayItemLocator,
  AcDbAssocArrayPathMethod,
  AcDbAssocArrayPathParameters,
  AcDbAssocArrayPolarParameters,
  AcDbAssocArrayRectangularParameters,
  AcDbAssocManager,
  AcDbAssocNetwork,
  AcDbAssocStatus
} from '../src/object/assoc'

describe('AcDbAssocArray', () => {
  it('registers ARRAYASSOCIATIVITY / ARRAYTYPE / ARRAYEDITSTATE defaults', () => {
    const db = new AcDbDatabase()
    const mgr = AcDbSysVarManager.instance()
    expect(mgr.getVar(AcDbSystemVariables.ARRAYASSOCIATIVITY, db)).toBe(1)
    expect(mgr.getVar(AcDbSystemVariables.ARRAYTYPE, db)).toBe(0)
    expect(mgr.getVar(AcDbSystemVariables.ARRAYEDITSTATE, db)).toBe(0)

    expect(() => mgr.setVar(AcDbSystemVariables.ARRAYEDITSTATE, 1, db)).toThrow(
      /read-only/i
    )
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
      AcDbAssocArrayActionBody.isAssociativeArray(
        arrayEntity as AcDbBlockReference
      )
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

    const params = new AcDbAssocArrayRectangularParameters(10, 10, 1, 3, 2, 1)
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
    // A full circle spaces items by fill / n (AutoCAD).
    params.fillAngle = 2 * Math.PI
    expect(params.angleBetweenItems).toBeCloseTo(Math.PI / 3, 10)
    params.itemCount = 4
    expect(params.angleBetweenItems).toBeCloseTo(Math.PI / 2, 10)
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
    // EXPLODE replaces the INSERT; once it is erased the action is orphaned.
    ref.erase()
    expect(AcDbAssocArrayActionBody.isAssociativeArray(ref)).toBe(false)
    const action = db.getObjectById(result.actionId) as AcDbAssocAction
    expect(action.isOrphaned).toBe(true)
    expect(db.dxfOut()).not.toContain('ACDBASSOCARRAYACTIONBODY')
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
    expect(polar.radius).toBeCloseTo(10, 10)
    expect(polar.startAngle).toBeCloseTo(0, 10)
    // AutoCAD places polar array INSERTs at the origin.
    expect(ref.position.x).toBe(0)

    const positions: AcGePoint3d[] = []
    for (const item of ref.blockTableRecord!.newIterator()) {
      expect(item).toBeInstanceOf(AcDbBlockReference)
      positions.push((item as AcDbBlockReference).position.clone())
    }
    expect(positions).toHaveLength(4)
    // Item 0 sits on the base point; item 1 rotates 90° CCW about center.
    expect(positions[0].x).toBeCloseTo(10, 6)
    expect(positions[0].y).toBeCloseTo(0, 6)
    expect(positions[1].x).toBeCloseTo(0, 6)
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
    const network = AcDbAssocNetwork.getInstanceFromObject(
      db.tables.blockTable.modelSpace
    )!
    expect(network.actionIds).toEqual([result.actionId])

    expect(ref.erase()).toBe(true)
    const action = db.getObjectById(result.actionId) as AcDbAssocAction
    expect(action.isOrphaned).toBe(true)
    expect(network.getHardOwnedObjectIds()).not.toContain(result.actionId)
    const out = db.dxfOut() as string
    expect(out).not.toMatch(/\nACDBASSOCACTION\r?\n/)
    expect(out).not.toContain('ACDBASSOCDEPENDENCY')
    expect(AcDbAssocManager.evaluateTopLevelNetwork(db)).toBe(true)
  })

  it('undo of erase and create keeps the array associative', () => {
    const db = new AcDbDatabase()
    const circle = new AcDbCircle(new AcGePoint3d(0, 0, 0), 0.5)
    db.tables.blockTable.modelSpace.appendEntity(circle)
    const tm = db.transactionManager
    let result!: ReturnType<typeof AcDbAssocArrayActionBody.createInstance>
    tm.runUndoable('Array', () => {
      result = AcDbAssocArrayActionBody.createInstance(
        [circle.objectId],
        new AcGePoint3d(0, 0, 0),
        new AcDbAssocArrayRectangularParameters(5, 5, 1, 2, 2, 1),
        db
      )
    })
    const ref = db.getObjectById(result.arrayEntityId) as AcDbBlockReference
    tm.runUndoable('Erase', () => {
      ref.erase()
    })
    expect(db.getObjectById(result.arrayEntityId)).toBeUndefined()

    tm.undo()
    const restored = db.getObjectById(
      result.arrayEntityId
    ) as AcDbBlockReference
    expect(restored).toBeInstanceOf(AcDbBlockReference)
    expect(AcDbAssocArrayActionBody.isAssociativeArray(restored)).toBe(true)
    expect(db.dxfOut()).toContain('ACDBASSOCARRAYACTIONBODY')

    // Undoing the creation orphans the action again; redo revives it.
    tm.undo()
    expect(db.getObjectById(result.arrayEntityId)).toBeUndefined()
    expect(db.dxfOut()).not.toContain('ACDBASSOCARRAYACTIONBODY')
    tm.redo()
    const redone = db.getObjectById(result.arrayEntityId) as AcDbBlockReference
    expect(AcDbAssocArrayActionBody.isAssociativeArray(redone)).toBe(true)
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
    const base = new AcGePoint3d(10, 20, 0)
    const circle = new AcDbCircle(base.clone(), 0.5)
    const path = new AcDbLine(
      new AcGePoint3d(10, 20, 0),
      new AcGePoint3d(40, 20, 0)
    )
    db.tables.blockTable.modelSpace.appendEntity(circle)
    db.tables.blockTable.modelSpace.appendEntity(path)

    const params = new AcDbAssocArrayPathParameters(10, 5, 1, 4, 1, 1)
    params.method = AcDbAssocArrayPathMethod.kDivide
    params.alignItems = false
    params.setPath({ entityId: path.objectId })

    const result = AcDbAssocArrayActionBody.createInstance(
      [circle.objectId],
      base,
      params,
      db
    )

    const ref = db.getObjectById(result.arrayEntityId) as AcDbBlockReference
    const worlds: AcGePoint3d[] = []
    for (const item of ref.blockTableRecord!.newIterator()) {
      expect(item).toBeInstanceOf(AcDbBlockReference)
      const br = item as AcDbBlockReference
      worlds.push(
        new AcGePoint3d(
          ref.position.x + br.position.x,
          ref.position.y + br.position.y,
          ref.position.z + br.position.z
        )
      )
    }
    expect(worlds).toHaveLength(4)
    // Divide open path: items at 0, 10, 20, 30 along the 30-unit line.
    expect(worlds[0].x).toBeCloseTo(10, 6)
    expect(worlds[0].y).toBeCloseTo(20, 6)
    expect(worlds[1].x).toBeCloseTo(20, 6)
    expect(worlds[2].x).toBeCloseTo(30, 6)
    expect(worlds[3].x).toBeCloseTo(40, 6)
  })

  it('allocates distinct assoc keys after explode so a second array survives', () => {
    const db = new AcDbDatabase()
    const first = new AcDbCircle(new AcGePoint3d(0, 0, 0), 0.5)
    db.tables.blockTable.modelSpace.appendEntity(first)
    const firstResult = AcDbAssocArrayActionBody.createInstance(
      [first.objectId],
      new AcGePoint3d(0, 0, 0),
      new AcDbAssocArrayRectangularParameters(5, 5, 1, 2, 1, 1),
      db
    )
    const firstRef = db.getObjectById(
      firstResult.arrayEntityId
    ) as AcDbBlockReference
    firstRef.explode()
    firstRef.erase()
    expect(
      (db.getObjectById(firstResult.actionId) as AcDbAssocAction).isOrphaned
    ).toBe(true)

    const second = new AcDbCircle(new AcGePoint3d(1, 1, 0), 0.5)
    db.tables.blockTable.modelSpace.appendEntity(second)
    const secondResult = AcDbAssocArrayActionBody.createInstance(
      [second.objectId],
      new AcGePoint3d(1, 1, 0),
      new AcDbAssocArrayRectangularParameters(5, 5, 1, 3, 1, 1),
      db
    )
    expect(secondResult.actionBodyId).not.toBe(firstResult.actionBodyId)
    const secondRef = db.getObjectById(
      secondResult.arrayEntityId
    ) as AcDbBlockReference
    expect(AcDbAssocArrayActionBody.isAssociativeArray(secondRef)).toBe(true)
    expect(db.getObjectById(secondResult.actionBodyId)).toBeInstanceOf(
      AcDbAssocArrayActionBody
    )
  })

  it('evaluateTopLevelNetwork reports failure when the array block is missing', () => {
    const db = new AcDbDatabase()
    const circle = new AcDbCircle(new AcGePoint3d(0, 0, 0), 0.5)
    db.tables.blockTable.modelSpace.appendEntity(circle)
    const result = AcDbAssocArrayActionBody.createInstance(
      [circle.objectId],
      new AcGePoint3d(0, 0, 0),
      new AcDbAssocArrayRectangularParameters(5, 5, 1, 2, 1, 1),
      db
    )
    const body = db.getObjectById(
      result.actionBodyId
    ) as AcDbAssocArrayActionBody
    db.tables.blockTable.remove(body.arrayBlockName)

    const action = db.getObjectById(result.actionId) as AcDbAssocAction
    action.setDirty()
    expect(AcDbAssocManager.evaluateTopLevelNetwork(db)).toBe(false)
    expect(action.status).toBe(AcDbAssocStatus.FailedToEvaluateAssocStatus)
  })

  it('path kMeasure does not stack items past the path end', () => {
    const path = new AcDbLine(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(20, 0, 0)
    )
    const params = new AcDbAssocArrayPathParameters(10, 1, 1, 10, 1, 1)
    params.method = AcDbAssocArrayPathMethod.kMeasure
    params.alignItems = false
    params.basePoint = new AcGePoint3d(0, 0, 0)
    params.setPathCurve(path)

    // Path length 20, spacing 10 → items at 0, 10, 20 only (not 10 extras at end).
    expect(params.getItemLocators()).toHaveLength(3)
    const last = params.getItemTransform(new AcDbAssocArrayItemLocator(2, 0, 0))
    expect(last.elements[12]).toBeCloseTo(20, 6)
  })

  it('path alignItems rotates items to the path tangent (AutoCAD frames)', () => {
    // Vertical then horizontal: start tangent is +Y, end tangent is +X.
    const db = new AcDbDatabase()
    const path = new AcDbPolyline()
    path.addVertexAt(0, new AcGePoint2d(0, 0))
    path.addVertexAt(1, new AcGePoint2d(0, 10))
    path.addVertexAt(2, new AcGePoint2d(10, 10))
    db.tables.blockTable.modelSpace.appendEntity(path)
    // A line along +X offset from the base point.
    const source = new AcDbLine(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(2, 0, 0)
    )
    db.tables.blockTable.modelSpace.appendEntity(source)

    const params = new AcDbAssocArrayPathParameters(10, 1, 1, 2, 1, 1, 0)
    params.method = AcDbAssocArrayPathMethod.kDivide
    params.alignItems = true
    params.setPath({ entityId: path.objectId })
    const result = AcDbAssocArrayActionBody.createInstance(
      [source.objectId],
      new AcGePoint3d(0, 0, 0),
      params,
      db
    )
    const body = db.getObjectById(
      result.actionBodyId
    ) as AcDbAssocArrayActionBody

    const first = body.getTransform(new AcDbAssocArrayItemLocator(0, 0, 0))
    const last = body.getTransform(new AcDbAssocArrayItemLocator(1, 0, 0))
    // Item 0: rotated to the +Y start tangent (90°).
    expect(first.elements[0]).toBeCloseTo(0, 6)
    expect(first.elements[1]).toBeCloseTo(1, 6)
    // Item 1: +X end tangent (0°), on the path end.
    expect(last.elements[0]).toBeCloseTo(1, 6)
    expect(last.elements[1]).toBeCloseTo(0, 6)
    expect(last.elements[12]).toBeCloseTo(10, 6)
    expect(last.elements[13]).toBeCloseTo(10, 6)

    // The source block is authored in item 0's frame, so item 0 reproduces
    // the original line and item 1 turns it by −90°.
    const [line0, line1] = (
      db.getObjectById(result.arrayEntityId) as AcDbBlockReference
    ).explode() as AcDbLine[]
    expect(line0.startPoint.x).toBeCloseTo(0, 6)
    expect(line0.endPoint.x).toBeCloseTo(2, 6)
    expect(line0.endPoint.y).toBeCloseTo(0, 6)
    expect(line1.startPoint.x).toBeCloseTo(10, 6)
    expect(line1.endPoint.x).toBeCloseTo(10, 6)
    expect(line1.endPoint.y).toBeCloseTo(8, 6)
  })
})
