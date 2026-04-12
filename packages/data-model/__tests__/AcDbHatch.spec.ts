import {
  AcGeCircArc2d,
  AcGeEllipseArc2d,
  AcGeLine2d,
  AcGeLoop2d,
  AcGeMatrix3d,
  AcGePolyline2d,
  AcGeSpline3d
} from '@mlightcad/geometry-engine'

import { acdbHostApplicationServices, AcDbDxfFiler } from '../src/base'
import { AcDbDatabase } from '../src/database'
import { AcDbHatch, AcDbHatchPatternType, AcDbHatchStyle } from '../src/entity'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

const createWorkingDb = () => {
  const db = new AcDbDatabase()
  db.createDefaultData()
  acdbHostApplicationServices().workingDatabase = db
  return db
}

const createRectLoop = (x: number, y: number, w: number, h: number) =>
  new AcGePolyline2d(
    [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h }
    ],
    true
  )

describe('AcDbHatch', () => {
  it('exposes type names and public getters/setters', () => {
    const hatch = new AcDbHatch()

    expect(AcDbHatch.typeName).toBe('Hatch')
    expect(hatch.dxfTypeName).toBe('HATCH')

    expect(hatch.patternType).toBe(AcDbHatchPatternType.Predefined)
    expect(hatch.patternName).toBe('')
    expect(hatch.patternAngle).toBe(0)
    expect(hatch.patternScale).toBe(1)
    expect(hatch.hatchStyle).toBe(AcDbHatchStyle.Normal)
    expect(hatch.elevation).toBe(0)
    expect(hatch.definitionLines).toEqual([])
    expect(hatch.isSolidFill).toBe(false)

    hatch.patternType = AcDbHatchPatternType.Custom
    hatch.patternName = 'ANSI31'
    hatch.patternAngle = Math.PI / 3
    hatch.patternScale = 2.5
    hatch.hatchStyle = AcDbHatchStyle.Outer
    hatch.elevation = 8
    hatch.isSolidFill = false
    hatch.definitionLines.push({
      angle: 0,
      base: { x: 0, y: 0 },
      offset: { x: 1, y: 1 },
      dashLengths: [1]
    })

    expect(hatch.patternType).toBe(AcDbHatchPatternType.Custom)
    expect(hatch.patternName).toBe('ANSI31')
    expect(hatch.patternAngle).toBeCloseTo(Math.PI / 3)
    expect(hatch.patternScale).toBeCloseTo(2.5)
    expect(hatch.hatchStyle).toBe(AcDbHatchStyle.Outer)
    expect(hatch.elevation).toBe(8)
    expect(hatch.definitionLines).toHaveLength(1)
    expect(hatch.isSolidFill).toBe(false)

    hatch.patternName = 'solid'
    expect(hatch.isSolidFill).toBe(true)
  })

  it('supports add(), geometricExtents and properties accessors', () => {
    const hatch = new AcDbHatch()
    const emptyExtents = hatch.geometricExtents
    expect(emptyExtents.isEmpty()).toBe(true)

    hatch.add(createRectLoop(0, 0, 10, 5))
    hatch.add(createRectLoop(2, 1, 2, 2))
    hatch.add(createRectLoop(20, 2, 2, 3))
    hatch.elevation = 4

    const extents = hatch.geometricExtents
    expect(extents.min).toMatchObject({ x: 0, y: 0, z: 4 })
    expect(extents.max).toMatchObject({ x: 22, y: 5, z: 4 })

    const properties = hatch.properties
    expect(properties.type).toBe('Hatch')

    const patternGroup = properties.groups.find(g => g.groupName === 'pattern')
    const geometryGroup = properties.groups.find(
      g => g.groupName === 'geometry'
    )
    expect(patternGroup).toBeDefined()
    expect(geometryGroup).toBeDefined()

    const propertyValues: Record<string, unknown> = {
      patternType: AcDbHatchPatternType.UserDefined,
      patternName: 'TEST_PATTERN',
      patternAngle: Math.PI / 6,
      patternScale: 3.25,
      elevation: 6
    }

    for (const group of [patternGroup!, geometryGroup!]) {
      for (const prop of group.properties) {
        prop.accessor.get()
        if (prop.editable && prop.accessor.set) {
          prop.accessor.set(propertyValues[prop.name] as never)
        }
        prop.accessor.get()
      }
    }

    const patternTypeProp = patternGroup!.properties.find(
      p => p.name === 'patternType'
    )
    expect(patternTypeProp?.options).toHaveLength(3)

    const areaProp = geometryGroup!.properties.find(p => p.name === 'area')
    expect(areaProp?.editable).toBe(false)
    expect((areaProp?.accessor.get() as number) > 0).toBe(true)

    expect(hatch.patternType).toBe(AcDbHatchPatternType.UserDefined)
    expect(hatch.patternName).toBe('TEST_PATTERN')
    expect(hatch.patternAngle).toBeCloseTo(Math.PI / 6)
    expect(hatch.patternScale).toBeCloseTo(3.25)
    expect(hatch.elevation).toBe(6)
  })

  it('draws empty/single/multi hatch areas and applies fill traits', () => {
    const makeRenderer = () => ({
      subEntityTraits: {} as Record<string, unknown>,
      area: jest.fn((area: unknown) => ({ kind: 'area', area })),
      group: jest.fn((entities: unknown[]) => ({ kind: 'group', entities }))
    })

    const emptyHatch = new AcDbHatch()
    const emptyRenderer = makeRenderer()
    const emptyDraw = emptyHatch.subWorldDraw(emptyRenderer as never)
    expect(emptyRenderer.area).toHaveBeenCalledTimes(1)
    expect(emptyRenderer.group).not.toHaveBeenCalled()
    expect(emptyDraw).toMatchObject({ kind: 'area' })
    expect(
      (emptyRenderer.subEntityTraits.fillType as { solidFill: boolean })
        .solidFill
    ).toBe(false)

    const singleHatch = new AcDbHatch()
    singleHatch.patternName = 'SOLID'
    singleHatch.definitionLines.push({
      angle: Math.PI / 4,
      base: { x: 0, y: 0 },
      offset: { x: 1, y: 0 },
      dashLengths: []
    })
    singleHatch.add(createRectLoop(0, 0, 3, 2))

    const singleRenderer = makeRenderer()
    const singleDraw = singleHatch.subWorldDraw(singleRenderer as never)
    expect(singleRenderer.area).toHaveBeenCalledTimes(1)
    expect(singleRenderer.group).not.toHaveBeenCalled()
    expect(singleDraw).toMatchObject({ kind: 'area' })
    expect(
      singleRenderer.subEntityTraits.fillType as {
        solidFill: boolean
        definitionLines: unknown[]
      }
    ).toMatchObject({
      solidFill: true,
      definitionLines: singleHatch.definitionLines
    })

    const multiHatch = new AcDbHatch()
    multiHatch.add(createRectLoop(0, 0, 2, 2))
    multiHatch.add(createRectLoop(5, 0, 2, 2))

    const multiRenderer = makeRenderer()
    const multiDraw = multiHatch.subWorldDraw(
      multiRenderer as never
    ) as unknown as {
      entities: unknown[]
      kind: string
    }
    expect(multiRenderer.area).toHaveBeenCalledTimes(2)
    expect(multiRenderer.group).toHaveBeenCalledTimes(1)
    expect(multiDraw.kind).toBe('group')
    expect(multiDraw.entities).toHaveLength(2)
  })

  it('transformBy updates loops, elevation, pattern angle/scale and handles zero-length x-axis', () => {
    const hatch = new AcDbHatch()
    hatch.add(createRectLoop(0, 0, 1, 1))
    hatch.elevation = 2
    hatch.patternAngle = 0.2
    hatch.patternScale = 1.5

    const matrix = new AcGeMatrix3d()
      .makeRotationZ(Math.PI / 2)
      .setPosition(0, 0, 5)
    expect(hatch.transformBy(matrix)).toBe(hatch)
    expect(hatch.elevation).toBeCloseTo(7)
    expect(hatch.patternAngle).toBeCloseTo(0.2 + Math.PI / 2)
    expect(hatch.patternScale).toBeCloseTo(1.5)

    const previousAngle = hatch.patternAngle
    const previousScale = hatch.patternScale
    hatch.transformBy(new AcGeMatrix3d().makeScale(0, 0, 1))
    expect(hatch.patternAngle).toBeCloseTo(previousAngle)
    expect(hatch.patternScale).toBeCloseTo(previousScale)
  })

  it('writes DXF fields for polyline/edge loops and hatch pattern data', () => {
    const db = createWorkingDb()
    const hatch = new AcDbHatch()
    db.tables.blockTable.modelSpace.appendEntity(hatch)

    hatch.patternType = AcDbHatchPatternType.Custom
    hatch.patternName = ''
    hatch.patternAngle = Math.PI / 6
    hatch.patternScale = 2.5
    hatch.hatchStyle = AcDbHatchStyle.Outer
    hatch.elevation = 5
    hatch.isSolidFill = false
    hatch.definitionLines.push({
      angle: Math.PI / 4,
      base: { x: 0, y: 0 },
      offset: { x: 1, y: 1 },
      dashLengths: [1, -0.5]
    })

    hatch.add(
      new AcGePolyline2d(
        [
          { x: 0, y: 0, bulge: 0.5 },
          { x: 4, y: 0, bulge: 0 },
          { x: 4, y: 4, bulge: -0.2 },
          { x: 0, y: 4, bulge: 0 }
        ],
        true
      )
    )
    hatch.add(createRectLoop(6, 0, 2, 2))

    const edgeLoop = new AcGeLoop2d([
      new AcGeLine2d({ x: 10, y: 0 }, { x: 12, y: 0 }),
      new AcGeSpline3d(
        [
          { x: 12, y: 0, z: 0 },
          { x: 12.5, y: 1, z: 0 },
          { x: 13.5, y: 1, z: 0 },
          { x: 14, y: 0, z: 0 }
        ],
        [0, 0, 0, 0, 1, 1, 1, 1],
        [1, 1.5, 1, 1],
        3,
        false
      )
    ])
    edgeLoop.add(
      new AcGeCircArc2d({ x: 13, y: 2 }, 1, -Math.PI / 2, Math.PI / 2, false)
    )
    edgeLoop.add(
      new AcGeEllipseArc2d({ x: 11, y: 2, z: 0 }, 1.5, 1, 0, Math.PI, false, 0)
    )
    hatch.add(edgeLoop)

    const filer = new AcDbDxfFiler().setVersion(27)
    expect(hatch.dxfOutFields(filer)).toBe(hatch)

    const dxf = filer.toString()
    expect(dxf).toContain('100\nAcDbHatch\n')
    expect(dxf).toContain('\n2\nUSER\n')
    expect(dxf).toContain('\n70\n0\n')
    expect(dxf).toContain('\n91\n3\n')
    expect(dxf).toContain('\n72\n4\n')
    expect(dxf).toContain('\n94\n3\n')
    expect(dxf).toContain('\n95\n8\n')
    expect(dxf).toContain('\n96\n4\n')
    expect(dxf).toContain('\n75\n1\n')
    expect(dxf).toContain('\n76\n2\n')
    expect(dxf).toContain('\n52\n')
    expect(dxf).toContain('\n41\n2.5\n')
    expect(dxf).toContain('\n78\n1\n')
    expect(dxf).toContain('\n79\n2\n')
    expect(dxf).toContain('\n98\n0\n')
  })

  it('writes SOLID fallback when solid fill is enabled and patternName is empty', () => {
    const db = createWorkingDb()
    const hatch = new AcDbHatch()
    db.tables.blockTable.modelSpace.appendEntity(hatch)
    hatch.patternName = ''
    hatch.isSolidFill = true
    hatch.add(createRectLoop(0, 0, 1, 1))

    const filer = new AcDbDxfFiler()
    hatch.dxfOutFields(filer)
    const dxf = filer.toString()

    expect(dxf).toContain('\n2\nSOLID\n')
    expect(dxf).toContain('\n70\n1\n')
  })

  it('clone creates a detached clone with a new objectId', () => {
    expectDetachedClone(() => new AcDbHatch())
  })
})
