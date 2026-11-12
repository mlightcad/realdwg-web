import {
  AcGeArea2d,
  AcGeLine2d,
  AcGeLoop2d,
  AcGeMatrix2d,
  AcGePolyline2d
} from '../src'

describe('AcGeArea2d', () => {
  it('computes polygon area', () => {
    const loop = new AcGeLoop2d([
      new AcGeLine2d({ x: 0, y: 0 }, { x: 2, y: 0 }),
      new AcGeLine2d({ x: 2, y: 0 }, { x: 2, y: 2 }),
      new AcGeLine2d({ x: 2, y: 2 }, { x: 0, y: 2 }),
      new AcGeLine2d({ x: 0, y: 2 }, { x: 0, y: 0 })
    ])

    const area = new AcGeArea2d()
    area.add(loop)

    expect(area.area).toBeCloseTo(4, 6)
  })

  it('covers empty-area and hierarchy branches', () => {
    const empty = new AcGeArea2d()
    expect(empty.outter).toBeUndefined()
    expect(empty.calculateBoundingBox().isEmpty()).toBe(true)

    const outer = new AcGeLoop2d([
      new AcGeLine2d({ x: 0, y: 0 }, { x: 4, y: 0 }),
      new AcGeLine2d({ x: 4, y: 0 }, { x: 4, y: 4 }),
      new AcGeLine2d({ x: 4, y: 4 }, { x: 0, y: 4 }),
      new AcGeLine2d({ x: 0, y: 4 }, { x: 0, y: 0 })
    ])
    const inner = new AcGePolyline2d(
      [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 1, y: 2 }
      ],
      true
    )
    const area = new AcGeArea2d()
    area.add(outer)
    area.add(inner)

    const tree = area.buildHierarchy()
    expect(tree.children.length).toBe(1)
    expect(tree.children[0].children.length).toBe(1)
  })

  it('does not nest a loop that only touches its neighbour', () => {
    // cathedral.dwg hatch 698AE: an L-shaped loop and the square in its
    // notch share edges and the square's first vertex, which lies a hair
    // (8e-10) inside the L's top edge. The square is filled in AutoCAD and
    // in PDF export, so it must not become a hole of the L.
    const l = new AcGePolyline2d(
      [
        { x: 363417.6222955187, y: 459464.14434221457 },
        { x: 362642.62229551823, y: 459464.14434221457 },
        { x: 362642.62229551823, y: 459074.14434221445 },
        { x: 362252.6222955187, y: 459074.14434221457 },
        { x: 362252.6222955187, y: 458297.5989058738 },
        { x: 363417.6222955187, y: 458297.5989058738 }
      ],
      true
    )
    const square = new AcGePolyline2d(
      [
        { x: 362642.62229551823, y: 459464.1443422138 },
        { x: 362252.6222955187, y: 459464.1443422138 },
        { x: 362252.6222955187, y: 459074.14434221457 },
        { x: 362642.62229551823, y: 459074.14434221445 }
      ],
      true
    )
    const area = new AcGeArea2d()
    area.add(l)
    area.add(square)

    const tree = area.buildHierarchy()
    expect(tree.children.map(node => node.index).sort()).toEqual([0, 1])
    expect(tree.children.every(node => node.children.length === 0)).toBe(true)
  })

  it('still nests an island whose corner touches the outer loop', () => {
    const outer = new AcGePolyline2d(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      true
    )
    const island = new AcGePolyline2d(
      [
        { x: 0, y: 0 },
        { x: 4, y: 2 },
        { x: 4, y: 4 },
        { x: 2, y: 4 }
      ],
      true
    )
    const area = new AcGeArea2d()
    area.add(outer)
    area.add(island)

    const tree = area.buildHierarchy()
    expect(tree.children).toHaveLength(1)
    expect(tree.children[0].children.map(node => node.index)).toEqual([1])
  })

  it('covers area edge paths for empty and degenerate loops', () => {
    const empty = new AcGeArea2d()
    expect(empty.area).toBe(0)

    const area = new AcGeArea2d()
    const degenerate = new AcGePolyline2d(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 }
      ],
      false
    )
    area.add(degenerate)
    expect(area.area).toBe(0)
  })

  it('clones area with independent loops', () => {
    const sourceLoop = new AcGeLoop2d([
      new AcGeLine2d({ x: 0, y: 0 }, { x: 1, y: 0 }),
      new AcGeLine2d({ x: 1, y: 0 }, { x: 1, y: 1 }),
      new AcGeLine2d({ x: 1, y: 1 }, { x: 0, y: 1 }),
      new AcGeLine2d({ x: 0, y: 1 }, { x: 0, y: 0 })
    ])
    const area = new AcGeArea2d()
    area.add(sourceLoop)

    const cloned = area.clone()
    expect(cloned).not.toBe(area)
    expect(cloned.loops.length).toBe(1)

    cloned.transform(new AcGeMatrix2d().makeTranslation(5, 0))
    expect((area.loops[0] as AcGeLoop2d).startPoint.x).toBeCloseTo(0, 8)
  })
})
