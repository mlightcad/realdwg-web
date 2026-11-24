import { AcGePoint3d, AcGeVector3d } from '@mlightcad/geometry-engine'

import {
  AcDbArc,
  AcDbCircle,
  AcDbCurve,
  AcDbEllipse,
  AcDbLine
} from '../src/entity'

/**
 * LINE x CIRCLE / ARC / ELLIPSE / elliptical ARC, the cases TRIM and EXTEND
 * rely on: a line passing through, crossing an arc once or twice, touching it
 * tangentially, and missing the arc but not its full curve.
 *
 * Each case runs near the origin and at large world coordinates (survey /
 * site drawings), where round-off used to turn a tangent into 0 or 2 points,
 * and with the curve both axis-aligned and rotated (a rotated full ellipse
 * used to get a degenerate bounding box and report no intersection).
 */

interface Frame {
  name: string
  center: AcGePoint3d
  /** Unit X axis of the local frame (arc angle 0 / ellipse major axis). */
  u: AcGeVector3d
}

const ORIGINS: [number, number][] = [
  [0, 0],
  [3.2e6, 4.1e6]
]
const AXES: [number, number][] = [
  [1, 0],
  [0.6, 0.8]
]

const FRAMES: Frame[] = ORIGINS.flatMap(([ox, oy]) =>
  AXES.map(([ux, uy]) => ({
    name: `origin (${ox}, ${oy}), axis (${ux}, ${uy})`,
    center: new AcGePoint3d(ox, oy, 0),
    u: new AcGeVector3d(ux, uy, 0)
  }))
)

/** Local frame point (x along `u`, y along `Z x u`) to WCS. */
function wcs(frame: Frame, x: number, y: number) {
  return new AcGePoint3d(
    frame.center.x + x * frame.u.x - y * frame.u.y,
    frame.center.y + x * frame.u.y + y * frame.u.x,
    0
  )
}

function localLine(
  frame: Frame,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  return new AcDbLine(wcs(frame, x1, y1), wcs(frame, x2, y2))
}

/** Line through local point `p` along local direction `d`, `s` each way. */
function lineThrough(frame: Frame, p: number[], d: number[], s: number) {
  return localLine(
    frame,
    p[0] - s * d[0],
    p[1] - s * d[1],
    p[0] + s * d[0],
    p[1] + s * d[1]
  )
}

function circle(frame: Frame) {
  return new AcDbCircle(frame.center, 5)
}

/** Circular arc of radius 5 from local angle `start` to `end` (CCW). */
function arc(frame: Frame, start: number, end: number) {
  const rotation = Math.atan2(frame.u.y, frame.u.x)
  return new AcDbArc(frame.center, 5, start + rotation, end + rotation)
}

/** Ellipse 5 x 2 along `u`; `0, 0` is how AutoCAD stores a full ellipse. */
function ellipse(frame: Frame, start = 0, end = 0) {
  return new AcDbEllipse(
    frame.center,
    AcGeVector3d.Z_AXIS,
    frame.u,
    5,
    2,
    start,
    end
  )
}

/**
 * Asserts `line x curve` (both call orders) gives exactly `expected`, in
 * any order.
 */
function expectHits(line: AcDbLine, curve: AcDbCurve, expected: AcGePoint3d[]) {
  for (const hits of [line.intersectWith(curve), curve.intersectWith(line)]) {
    expect(hits).toHaveLength(expected.length)
    for (const point of expected) {
      const match = hits.find(hit => hit.distanceTo(point) < 1e-6)
      expect(match).toBeDefined()
    }
  }
}

/** x where the local line y = h meets the 5 x 2 ellipse. */
const ellipseX = (h: number) => 5 * Math.sqrt(1 - (h * h) / 4)

describe.each(FRAMES)('LINE x conic intersections, $name', frame => {
  describe('circle', () => {
    it('line passing through: two points', () => {
      expectHits(localLine(frame, -10, 3, 10, 3), circle(frame), [
        wcs(frame, -4, 3),
        wcs(frame, 4, 3)
      ])
    })

    it('line ending inside: one point', () => {
      expectHits(localLine(frame, -10, 3, 0, 3), circle(frame), [
        wcs(frame, -4, 3)
      ])
    })

    it('tangent line: one point', () => {
      expectHits(localLine(frame, -10, 5, 10, 5), circle(frame), [
        wcs(frame, 0, 5)
      ])
    })

    it.each([Math.PI / 6, 1, 2.2, 4])(
      'oblique tangent line at angle %f: one point',
      t => {
        const p = [5 * Math.cos(t), 5 * Math.sin(t)]
        const d = [-Math.sin(t), Math.cos(t)]
        expectHits(lineThrough(frame, p, d, 10), circle(frame), [
          wcs(frame, p[0], p[1])
        ])
      }
    )

    it('line outside: no point', () => {
      expectHits(localLine(frame, -10, 6, 10, 6), circle(frame), [])
    })
  })

  describe('arc', () => {
    it('line crossing the arc twice: two points', () => {
      expectHits(localLine(frame, -10, 3, 10, 3), arc(frame, 0, Math.PI), [
        wcs(frame, -4, 3),
        wcs(frame, 4, 3)
      ])
    })

    it('line crossing the arc once (other hit off the sweep): one point', () => {
      expectHits(localLine(frame, -10, 3, 10, 3), arc(frame, 0, Math.PI / 2), [
        wcs(frame, 4, 3)
      ])
    })

    it('tangent line: one point', () => {
      expectHits(localLine(frame, -10, 5, 10, 5), arc(frame, 0, Math.PI), [
        wcs(frame, 0, 5)
      ])
    })

    it('oblique tangent line: one point', () => {
      const t = 1
      const p = [5 * Math.cos(t), 5 * Math.sin(t)]
      const d = [-Math.sin(t), Math.cos(t)]
      expectHits(lineThrough(frame, p, d, 10), arc(frame, 0, Math.PI), [
        wcs(frame, p[0], p[1])
      ])
    })

    it('tangent to the circle but off the arc: no point', () => {
      expectHits(localLine(frame, -10, -5, 10, -5), arc(frame, 0, Math.PI), [])
    })

    it('line crossing only the missing part of the circle: no point', () => {
      expectHits(localLine(frame, -10, -3, 10, -3), arc(frame, 0, Math.PI), [])
    })
  })

  describe('ellipse', () => {
    it('line passing through the center: two points', () => {
      expectHits(localLine(frame, -10, 0, 10, 0), ellipse(frame), [
        wcs(frame, -5, 0),
        wcs(frame, 5, 0)
      ])
    })

    it('line passing through off-center: two points', () => {
      expectHits(localLine(frame, -10, 1, 10, 1), ellipse(frame), [
        wcs(frame, -ellipseX(1), 1),
        wcs(frame, ellipseX(1), 1)
      ])
    })

    it('full ellipse stored as 0..2PI: two points', () => {
      expectHits(
        localLine(frame, -10, 1, 10, 1),
        ellipse(frame, 0, Math.PI * 2),
        [wcs(frame, -ellipseX(1), 1), wcs(frame, ellipseX(1), 1)]
      )
    })

    it('line ending inside: one point', () => {
      expectHits(localLine(frame, -10, 1, 0, 1), ellipse(frame), [
        wcs(frame, -ellipseX(1), 1)
      ])
    })

    it('tangent line on the minor axis: one point', () => {
      expectHits(localLine(frame, -10, 2, 10, 2), ellipse(frame), [
        wcs(frame, 0, 2)
      ])
    })

    it.each([0.5, 1, 2.2, 4])(
      'oblique tangent line at parameter %f: one point',
      t => {
        const p = [5 * Math.cos(t), 2 * Math.sin(t)]
        const d = [-5 * Math.sin(t), 2 * Math.cos(t)]
        expectHits(lineThrough(frame, p, d, 3), ellipse(frame), [
          wcs(frame, p[0], p[1])
        ])
      }
    )

    it('line outside: no point', () => {
      expectHits(localLine(frame, -10, 2.5, 10, 2.5), ellipse(frame), [])
    })
  })

  describe('elliptical arc', () => {
    it('line crossing the arc twice: two points', () => {
      expectHits(localLine(frame, -10, 1, 10, 1), ellipse(frame, 0, Math.PI), [
        wcs(frame, -ellipseX(1), 1),
        wcs(frame, ellipseX(1), 1)
      ])
    })

    it('line crossing the arc once (other hit off the sweep): one point', () => {
      expectHits(
        localLine(frame, -10, 1, 10, 1),
        ellipse(frame, 0, Math.PI / 2),
        [wcs(frame, ellipseX(1), 1)]
      )
    })

    it('tangent line: one point', () => {
      expectHits(localLine(frame, -10, 2, 10, 2), ellipse(frame, 0, Math.PI), [
        wcs(frame, 0, 2)
      ])
    })

    it('oblique tangent line: one point', () => {
      const t = 1
      const p = [5 * Math.cos(t), 2 * Math.sin(t)]
      const d = [-5 * Math.sin(t), 2 * Math.cos(t)]
      expectHits(lineThrough(frame, p, d, 3), ellipse(frame, 0, Math.PI), [
        wcs(frame, p[0], p[1])
      ])
    })

    it('tangent to the ellipse but off the arc: no point', () => {
      expectHits(
        localLine(frame, -10, -2, 10, -2),
        ellipse(frame, 0, Math.PI),
        []
      )
    })

    it('line crossing only the missing part of the ellipse: no point', () => {
      expectHits(
        localLine(frame, -10, -1, 10, -1),
        ellipse(frame, 0, Math.PI),
        []
      )
    })
  })
})
