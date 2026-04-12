import { AcCmErrors } from '@mlightcad/common'
import { AcGeMatrix3d, AcGePoint3d } from '@mlightcad/geometry-engine'
import type { AcGeKnotParameterizationType } from '@mlightcad/geometry-engine'
import { AcGiRenderer } from '@mlightcad/graphic-interface'

import { acdbHostApplicationServices, AcDbDxfFiler } from '../src/base'
import { AcDbDatabase } from '../src/database'
import { AcDbSpline } from '../src/entity'
import { AcDbOsnapMode } from '../src/misc'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

describe('AcDbSpline', () => {
  const controlPoints = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 2, y: -1, z: 0 },
    { x: 3, y: 0, z: 0 }
  ]
  const knots = [0, 0, 0, 0, 1, 1, 1, 1]
  let db: AcDbDatabase

  beforeAll(() => {
    db = new AcDbDatabase()
    db.createDefaultData()
    acdbHostApplicationServices().workingDatabase = db
  })

  it('exposes static and DXF type names', () => {
    const spline = new AcDbSpline(controlPoints, knots)

    expect(AcDbSpline.typeName).toBe('Spline')
    expect(spline.dxfTypeName).toBe('SPLINE')
  })

  it('supports control-point constructor with geometric extents and closed setter', () => {
    const spline = new AcDbSpline(controlPoints, knots)
    const extents = spline.geometricExtents

    expect(extents.min.x).toBeLessThanOrEqual(0)
    expect(extents.max.x).toBeGreaterThanOrEqual(3)

    spline.closed = true
    expect(spline.closed).toBe(true)
  })

  it('supports fit-point constructor and rebuild overloads', () => {
    const fitPoints = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0.5, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 3, y: 0.5, z: 0 }
    ]
    const spline = new AcDbSpline(
      fitPoints,
      0 as unknown as AcGeKnotParameterizationType
    )

    spline.rebuild(controlPoints, knots, [1, 2, 3, 4], 3, true)
    expect(spline.closed).toBe(true)

    spline.rebuild(
      fitPoints,
      0 as unknown as AcGeKnotParameterizationType,
      3,
      false
    )
    expect(spline.closed).toBe(false)
  })

  it('throws illegal parameters for invalid rebuild argument count', () => {
    const spline = new AcDbSpline(controlPoints, knots)

    expect(() =>
      (spline as unknown as { rebuild: (...args: unknown[]) => void }).rebuild()
    ).toThrow(AcCmErrors.ILLEGAL_PARAMETERS)
    expect(() =>
      (spline as unknown as { rebuild: (...args: unknown[]) => void }).rebuild(
        [],
        [],
        [],
        3,
        false,
        'extra'
      )
    ).toThrow(AcCmErrors.ILLEGAL_PARAMETERS)
  })

  it('returns endpoint osnap points and ignores unsupported osnap mode', () => {
    const spline = new AcDbSpline(controlPoints, knots)
    const endpointSnaps: AcGePoint3d[] = []
    const unsupportedSnaps: AcGePoint3d[] = []

    spline.subGetOsnapPoints(
      AcDbOsnapMode.EndPoint,
      new AcGePoint3d(),
      new AcGePoint3d(),
      endpointSnaps
    )
    spline.subGetOsnapPoints(
      AcDbOsnapMode.Center,
      new AcGePoint3d(),
      new AcGePoint3d(),
      unsupportedSnaps
    )

    expect(endpointSnaps).toHaveLength(2)
    expect(endpointSnaps[0]).toMatchObject({ x: 0, y: 0, z: 0 })
    expect(endpointSnaps[1]).toMatchObject({ x: 3, y: 0, z: 0 })
    expect(unsupportedSnaps).toHaveLength(0)
  })

  it('transforms by matrix and returns itself', () => {
    const spline = new AcDbSpline(controlPoints, knots)
    const before: AcGePoint3d[] = []
    const after: AcGePoint3d[] = []

    spline.subGetOsnapPoints(
      AcDbOsnapMode.EndPoint,
      new AcGePoint3d(),
      new AcGePoint3d(),
      before
    )

    const result = spline.transformBy(
      new AcGeMatrix3d().makeTranslation(2, -1, 5)
    )

    spline.subGetOsnapPoints(
      AcDbOsnapMode.EndPoint,
      new AcGePoint3d(),
      new AcGePoint3d(),
      after
    )

    expect(result).toBe(spline)
    expect(after[0]).toMatchObject({
      x: before[0].x + 2,
      y: before[0].y - 1,
      z: before[0].z + 5
    })
    expect(after[1]).toMatchObject({
      x: before[1].x + 2,
      y: before[1].y - 1,
      z: before[1].z + 5
    })
  })

  it('delegates drawing to renderer.lines with sampled points', () => {
    const spline = new AcDbSpline(controlPoints, knots)
    const rendered = { id: 'entity' }
    const renderer = {
      lines: jest.fn(() => rendered)
    } as unknown as AcGiRenderer

    const result = spline.subWorldDraw(renderer)

    expect(result).toBe(rendered)
    expect(
      (renderer as unknown as { lines: jest.Mock }).lines
    ).toHaveBeenCalledTimes(1)
    expect(
      (renderer as unknown as { lines: jest.Mock }).lines.mock.calls[0][0]
    ).toHaveLength(100)
  })

  it('writes spline-specific DXF fields for control points', () => {
    const spline = new AcDbSpline(
      controlPoints,
      knots,
      [1, 1.5, 2, 2.5],
      3,
      true
    )
    const filer = new AcDbDxfFiler()
    db.tables.blockTable.modelSpace.appendEntity(spline)

    const result = spline.dxfOutFields(filer)
    const dxf = filer.toString()

    expect(result).toBe(spline)
    expect(dxf).toContain('100\nAcDbSpline\n')
    expect(dxf).toContain('70\n1\n')
    expect(dxf).toContain('71\n3\n')
    expect(dxf).toContain('72\n8\n')
    expect(dxf).toContain('73\n4\n')
    expect(dxf).toContain('74\n0\n')
    expect(dxf).toContain('40\n0\n')
    expect(dxf).toContain('41\n1.5\n')
    expect(dxf).toContain('10\n0\n20\n0\n30\n0\n')
  })

  it('writes fit points in DXF when underlying geometry exposes them', () => {
    const spline = new AcDbSpline(controlPoints, knots)
    const filer = new AcDbDxfFiler()
    db.tables.blockTable.modelSpace.appendEntity(spline)
    ;(spline as unknown as { _geo: unknown })._geo = {
      degree: 3,
      knots: [0, 0, 0, 0, 1, 1, 1, 1],
      weights: [1, 1, 1, 1],
      controlPoints,
      fitPoints: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 }
      ],
      closed: false
    }

    spline.dxfOutFields(filer)
    const dxf = filer.toString()

    expect(dxf).toContain('74\n2\n')
    expect(dxf).toContain('11\n0\n21\n0\n31\n0\n')
    expect(dxf).toContain('11\n1\n21\n1\n31\n0\n')
  })
  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(
      () =>
        new AcDbSpline(
          [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
            { x: 2, y: 0, z: 0 },
            { x: 3, y: 0, z: 0 }
          ],
          [0, 0, 0, 0, 1, 1, 1, 1]
        )
    )
  })
})
