import { AcGeCircArc2d, AcGeMatrix2d, AcGePolyline2d } from '../src'

describe('Test AcGePolyline2d', () => {
  it('computes length correctly', () => {
    const polyline1 = new AcGePolyline2d()
    expect(polyline1.length).toBe(0)

    const polyline2 = new AcGePolyline2d()
    polyline2.addVertexAt(0, { x: 0, y: 0 })
    polyline2.addVertexAt(1, { x: 1, y: 0, bulge: 1 })
    polyline2.addVertexAt(2, { x: 3, y: 0 })
    expect(polyline2.length).toBe(1 + Math.PI)

    const polyline3 = new AcGePolyline2d()
    polyline3.addVertexAt(0, { x: 0, y: 0 })
    polyline3.addVertexAt(1, { x: 1, y: 0, bulge: 1 })
    polyline3.addVertexAt(2, { x: 1, y: 2 })
    expect(polyline3.length).toBe(1 + Math.PI)

    const polyline4 = new AcGePolyline2d()
    polyline4.addVertexAt(0, { x: 0, y: 0, bulge: 1 })
    polyline4.addVertexAt(1, { x: 2, y: 0, bulge: 1 })
    polyline4.closed = true
    expect(polyline4.length).toBe(2 * Math.PI)
  })

  it('covers empty endpoints, reset/remove, transform flip and point helpers', () => {
    const empty = new AcGePolyline2d()
    expect(() => empty.startPoint).toThrow('Start point does not exist')
    expect(() => empty.endPoint).toThrow('End point does not exist')

    const polyline = new AcGePolyline2d(
      [
        { x: 0, y: 0, bulge: 1 },
        { x: 2, y: 0, bulge: 0.5 },
        { x: 2, y: 2, bulge: 0.25 }
      ],
      true
    )
    expect(polyline.endPoint.toArray()).toEqual([0, 0])

    expect(polyline.getPoints(4).length).toBeGreaterThan(0)
    expect(polyline.getPoints3d(3, 9)[0].z).toBe(9)
    expect(polyline.getPointAt(1).toArray()).toEqual([2, 0])

    polyline.transform(new AcGeMatrix2d().makeScale(-1, 1))
    expect(polyline.vertices[0].bulge).toBe(-1)

    expect(() => polyline.removeVertexAt(10)).toThrow('out of bounds')
    polyline.removeVertexAt(2)
    expect(polyline.numberOfVertices).toBe(2)

    polyline.reset(true, 5)
    expect(polyline.numberOfVertices).toBe(2)
    polyline.reset(true, 1)
    expect(polyline.numberOfVertices).toBe(1)
    polyline.reset(false)
    expect(polyline.numberOfVertices).toBe(0)
  })

  it('returns last vertex as endPoint when open', () => {
    const open = new AcGePolyline2d(
      [
        { x: 0, y: 0 },
        { x: 2, y: 3 }
      ],
      false
    )
    expect(open.endPoint.toArray()).toEqual([2, 3])
  })

  it('clones polyline vertices deeply', () => {
    const polyline = new AcGePolyline2d(
      [
        { x: 0, y: 0, bulge: 1 },
        { x: 1, y: 0, bulge: 0.5 }
      ],
      false
    )
    const cloned = polyline.clone()

    expect(cloned).not.toBe(polyline)
    expect(cloned.vertices).toEqual(polyline.vertices)

    cloned.vertices[0].x = 9
    expect(polyline.vertices[0].x).toBe(0)
  })

  it('offsets an open semicircle bulge segment outward', () => {
    const polyline = new AcGePolyline2d()
    polyline.addVertexAt(0, { x: 0, y: 0, bulge: 1 })
    polyline.addVertexAt(1, { x: 10, y: 0 })
    const [result] = polyline.offset(1)
    const minY = Math.min(...result.vertices.map(vertex => vertex.y))
    expect(minY).toBeCloseTo(-6, 0)
  })

  it('offsets a mixed line-arc polyline to the same side of the path', () => {
    const polyline = new AcGePolyline2d()
    polyline.addVertexAt(0, { x: 0, y: 0 })
    polyline.addVertexAt(1, { x: 80, y: 15, bulge: 0.6 })
    polyline.addVertexAt(2, { x: 160, y: 15, bulge: -0.6 })
    polyline.addVertexAt(3, { x: 240, y: 5 })

    const [result] = polyline.offset(2)
    expect(result.numberOfVertices).toBeGreaterThan(4)

    const lineEndOffset = {
      x: 80 + (-15 / Math.hypot(80, 15)) * 2,
      y: 15 + (80 / Math.hypot(80, 15)) * 2
    }
    const junction = result.vertices.find(
      vertex =>
        Math.hypot(vertex.x - lineEndOffset.x, vertex.y - lineEndOffset.y) < 3
    )
    expect(junction).toBeDefined()
    expect(junction!.y).toBeGreaterThan(15)

    const arc = new AcGeCircArc2d({ x: 80, y: 15 }, { x: 160, y: 15 }, 0.6)
    const offsetArc = new AcGeCircArc2d(
      arc.center,
      arc.radius - 2,
      arc.startAngle,
      arc.endAngle,
      arc.clockwise
    )
    const distToLineEnd = Math.hypot(
      junction!.x - lineEndOffset.x,
      junction!.y - lineEndOffset.y
    )
    const distToArcStart = Math.hypot(
      junction!.x - offsetArc.startPoint.x,
      junction!.y - offsetArc.startPoint.y
    )
    expect(distToLineEnd).toBeLessThan(3)
    expect(distToArcStart).toBeLessThan(3)
  })

  it('offsets a closed polyline that contains a bulge arc segment', () => {
    const polyline = new AcGePolyline2d()
    polyline.addVertexAt(0, { x: 0, y: 0 })
    polyline.addVertexAt(1, { x: 10, y: 0, bulge: 1 })
    polyline.addVertexAt(2, { x: 10, y: 10 })
    polyline.addVertexAt(3, { x: 0, y: 10 })
    polyline.closed = true
    const [result] = polyline.offset(1)
    expect(result.numberOfVertices).toBeGreaterThanOrEqual(4)
  })
})
