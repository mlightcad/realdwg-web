import {
  AcDbHatch,
  AcGeLine2d,
  AcGeLoop2d,
  AcGePoint2d
} from '@mlightcad/data-model'

/**
 * Mirrors convertHatch's loop-assembly policy: one DWG boundary path must
 * become one loop. When buildFromEdges fragments a nearly-closed path
 * (spline endpoint drift), keep the file edge order.
 */
function addPathFromEdges(hatch: AcDbHatch, edges: AcGeLine2d[]) {
  const loops = AcGeLoop2d.buildFromEdges(edges)
  if (loops.length === 1) {
    hatch.add(loops[0])
  } else if (edges.length > 0) {
    hatch.add(new AcGeLoop2d(edges))
  }
}

describe('hatch boundary path order (spline endpoint drift)', () => {
  it('keeps one loop when sequential edges have gaps above default tolerance', () => {
    // Same topology as CAD_TITLE hatch DC3: ordered cycle with ~0.04–0.10 gaps
    // between some endpoints (too large for buildFromEdges' 1e-3 default).
    const edges = [
      new AcGeLine2d({ x: 0, y: 0 }, { x: 10, y: 0 }),
      new AcGeLine2d({ x: 10.05, y: 0 }, { x: 10, y: 10 }), // 0.05 gap
      new AcGeLine2d({ x: 10, y: 10 }, { x: 0, y: 10 }),
      new AcGeLine2d({ x: 0, y: 10 }, { x: 0, y: 0.08 }) // 0.08 gap to start
    ]

    expect(AcGeLoop2d.buildFromEdges(edges)).toHaveLength(2)

    const hatch = new AcDbHatch()
    hatch.isSolidFill = true
    addPathFromEdges(hatch, edges)

    // Private geometry: one loop with all four edges, not fragmented.
    const loops = (hatch as unknown as { _geo: { loops: AcGeLoop2d[] } })._geo
      .loops
    expect(loops).toHaveLength(1)
    expect(loops[0].numberOfEdges).toBe(4)

    const pts = loops[0].getPoints(20)
    const box = {
      minX: Math.min(...pts.map(p => p.x)),
      maxX: Math.max(...pts.map(p => p.x)),
      minY: Math.min(...pts.map(p => p.y)),
      maxY: Math.max(...pts.map(p => p.y))
    }
    expect(box.minX).toBeLessThan(1)
    expect(box.maxX).toBeGreaterThan(9)
    expect(box.minY).toBeLessThan(1)
    expect(box.maxY).toBeGreaterThan(9)

    // Interior sample stays inside the (nearly) closed rectangle.
    const inside = new AcGePoint2d(5, 5)
    let winding = 0
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      if (a.y > inside.y !== b.y > inside.y) {
        const x = ((b.x - a.x) * (inside.y - a.y)) / (b.y - a.y) + a.x
        if (inside.x < x) winding++
      }
    }
    expect(winding % 2).toBe(1)
  })

  it('still uses a successfully rebuilt single loop', () => {
    const edges = [
      new AcGeLine2d({ x: 0, y: 0 }, { x: 4, y: 0 }),
      new AcGeLine2d({ x: 4, y: 0 }, { x: 4, y: 3 }),
      new AcGeLine2d({ x: 4, y: 3 }, { x: 0, y: 3 }),
      new AcGeLine2d({ x: 0, y: 3 }, { x: 0, y: 0 })
    ]
    expect(AcGeLoop2d.buildFromEdges(edges)).toHaveLength(1)

    const hatch = new AcDbHatch()
    addPathFromEdges(hatch, edges)
    const loops = (hatch as unknown as { _geo: { loops: AcGeLoop2d[] } })._geo
      .loops
    expect(loops).toHaveLength(1)
    expect(loops[0].numberOfEdges).toBe(4)
  })
})
