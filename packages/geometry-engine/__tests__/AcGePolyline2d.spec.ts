import { AcGeMatrix2d, AcGePolyline2d } from '../src'

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
})
