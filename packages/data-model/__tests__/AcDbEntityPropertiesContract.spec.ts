import { AcCmColor, AcCmTransparency } from '@mlightcad/common'
import {
  AcGePoint2d,
  AcGePoint3d,
  AcGeVector3d
} from '@mlightcad/geometry-engine'

import * as E from '../src/entity'
import { AcDbEntityRuntimeProperty } from '../src/entity'
import { setupWorkingDatabase } from '../test-utils/entityTestUtils'

const p = (x: number, y: number, z = 0) => new AcGePoint3d(x, y, z)

/** One instance of every concrete entity class. */
const FACTORIES: Record<string, () => E.AcDbEntity> = {
  Line: () => new E.AcDbLine(p(0, 0), p(10, 0)),
  Circle: () => new E.AcDbCircle(p(0, 0), 5),
  Arc: () => new E.AcDbArc(p(0, 0), 5, 0, Math.PI / 2),
  Ellipse: () =>
    new E.AcDbEllipse(
      p(0, 0),
      AcGeVector3d.Z_AXIS,
      AcGeVector3d.X_AXIS,
      10,
      5,
      0,
      Math.PI * 2
    ),
  Polyline: () => {
    const e = new E.AcDbPolyline()
    e.addVertexAt(0, new AcGePoint2d(0, 0))
    e.addVertexAt(1, new AcGePoint2d(10, 0))
    e.addVertexAt(2, new AcGePoint2d(10, 10))
    return e
  },
  Polyline2d: () =>
    new E.AcDb2dPolyline(E.AcDbPoly2dType.SimplePoly, [
      p(0, 0),
      p(10, 0),
      p(10, 10)
    ]),
  Polyline3d: () =>
    new E.AcDb3dPolyline(E.AcDbPoly3dType.SimplePoly, [
      p(0, 0),
      p(10, 0),
      p(10, 10, 3)
    ]),
  Vertex2d: () => new E.AcDb2dVertex(),
  Vertex3d: () => new E.AcDb3dVertex(),
  Spline: () =>
    new E.AcDbSpline(
      [p(0, 0), p(5, 5), p(10, 0), p(15, 5)],
      [0, 0, 0, 0, 1, 1, 1, 1],
      undefined,
      3
    ),
  Ray: () => new E.AcDbRay(),
  Xline: () => new E.AcDbXline(),
  Point: () => new E.AcDbPoint(),
  Text: () => new E.AcDbText(),
  MText: () => new E.AcDbMText(),
  Attribute: () => new E.AcDbAttribute(),
  AttributeDefinition: () => new E.AcDbAttributeDefinition(),
  ArcAlignedText: () => new E.AcDbArcAlignedText(),
  BlockReference: () => new E.AcDbBlockReference('*Model_Space'),
  MInsertBlock: () => new E.AcDbMInsertBlock('*Model_Space', 2, 2, 1, 1),
  Hatch: () => new E.AcDbHatch(),
  AlignedDimension: () =>
    new E.AcDbAlignedDimension(p(0, 0), p(10, 0), p(5, 5)),
  RotatedDimension: () =>
    new E.AcDbRotatedDimension(p(0, 0), p(10, 0), p(5, 5)),
  RadialDimension: () => new E.AcDbRadialDimension(p(0, 0), p(5, 0), 2),
  DiametricDimension: () => new E.AcDbDiametricDimension(p(5, 0), p(-5, 0), 2),
  AngularDimension: () =>
    new E.AcDb3PointAngularDimension(p(0, 0), p(10, 0), p(0, 10), p(7, 7)),
  ArcDimension: () =>
    new E.AcDbArcDimension(p(0, 0), p(10, 0), p(0, 10), p(8, 8)),
  OrdinateDimension: () => new E.AcDbOrdinateDimension(p(5, 5), p(5, 10)),
  Leader: () => {
    const e = new E.AcDbLeader()
    e.appendVertex(p(0, 0))
    e.appendVertex(p(5, 5))
    return e
  },
  MLeader: () => new E.AcDbMLeader(),
  MLine: () => new E.AcDbMLine(),
  Solid: () => new E.AcDbSolid(),
  Trace: () => new E.AcDbTrace(),
  Face: () => new E.AcDbFace(),
  RasterImage: () => new E.AcDbRasterImage(),
  Wipeout: () => new E.AcDbWipeout(),
  Viewport: () => new E.AcDbViewport(),
  OleFrame: () => new E.AcDbOleFrame(),
  Ole2Frame: () => new E.AcDbOle2Frame(),
  ProxyEntity: () => new E.AcDbProxyEntity(),
  Solid3d: () => new E.AcDb3dSolid(''),
  Shape: () => new E.AcDbShape(),
  Fcf: () => new E.AcDbFcf(),
  Table: () => new E.AcDbTable('*T1', 2, 2),
  PolyFaceMesh: () =>
    new E.AcDbPolyFaceMesh([p(0, 0), p(1, 0), p(1, 1)], [[1, 2, 3]]),
  PolygonMesh: () =>
    new E.AcDbPolygonMesh(2, 2, [p(0, 0), p(1, 0), p(0, 1), p(1, 1)])
}

/** A plausible new value of the property's type. */
function nextValue(prop: AcDbEntityRuntimeProperty, current: unknown) {
  switch (prop.type) {
    case 'float':
      return (typeof current === 'number' ? current : 0) + 0.25
    case 'int':
      return (typeof current === 'number' ? current : 0) + 1
    case 'boolean':
      return !current
    case 'string':
      return `${current ?? ''}Q`
    case 'enum': {
      const options = prop.options ?? []
      const index = options.findIndex(option => option.value === current)
      return options[(index + 1) % Math.max(1, options.length)]?.value
    }
    case 'color': {
      const color = new AcCmColor()
      color.colorIndex = 3
      return color
    }
    case 'transparency':
      return new AcCmTransparency(50)
    case 'linetype':
      return 'CONTINUOUS'
    case 'lineweight':
      return 50
    case 'layer':
      return '0'
    case 'array': {
      const items = current as Record<string, unknown>[]
      return items.map(item => {
        const copy = { ...item }
        for (const field of prop.itemSchema?.properties ?? []) {
          if (field.editable && typeof copy[field.name] === 'number') {
            copy[field.name] = (copy[field.name] as number) + 1
          }
        }
        return copy
      })
    }
    default:
      return undefined
  }
}

describe('entity property palette contract', () => {
  beforeEach(() => {
    setupWorkingDatabase()
  })

  it.each(Object.keys(FACTORIES))(
    '%s: editable matches the setter and every accessor works',
    key => {
      const entity = FACTORIES[key]()
      const names = new Set<string>()
      for (const group of entity.properties.groups) {
        for (const prop of group.properties) {
          const id = `${group.groupName}.${prop.name}`
          expect(names.has(id)).toBe(false)
          names.add(id)
          // A property is editable exactly when it can be written.
          expect({ id, editable: prop.editable ?? true }).toEqual({
            id,
            editable: prop.accessor.set != null
          })
          const current = prop.accessor.get()
          if (prop.accessor.set) {
            expect(() =>
              prop.accessor.set!(nextValue(prop, current))
            ).not.toThrow()
          }
        }
      }
    }
  )

  it.each(Object.keys(FACTORIES))(
    '%s: array properties return copies, not internal storage',
    key => {
      const entity = FACTORIES[key]()
      for (const group of entity.properties.groups) {
        for (const prop of group.properties) {
          if (prop.type !== 'array') continue
          const before = JSON.stringify(prop.accessor.get())
          const items = prop.accessor.get() as Record<string, unknown>[]
          for (const item of items) {
            if (typeof item.x === 'number') item.x = 1e9
          }
          expect(JSON.stringify(prop.accessor.get())).toBe(before)
        }
      }
    }
  )
})
