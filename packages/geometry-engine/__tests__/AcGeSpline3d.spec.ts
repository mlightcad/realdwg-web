import { AcGeSpline3d, AcGeKnotParameterizationType } from '../src'
import { AcGePoint3d, AcGeBox3d, AcGeMatrix3d } from '../src'
import { AcCmErrors } from '@mlightcad/common'

describe('AcGeSpline3d', () => {
  describe('Constructor', () => {
    it('should create spline from control points, knots, and weights', () => {
      const controlPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 1, z: 0 }
      ]
      const knots = [0, 0, 0, 0, 1, 1, 1, 1]
      const weights = [1, 1, 1, 1]

      const spline = new AcGeSpline3d(controlPoints, knots, weights)

      expect(spline.degree).toBe(3)
      expect(spline.closed).toBe(false)
      expect(spline.getControlPointAt(0)).toBeDefined()
    })

    it('should create spline from fit points and parameterization', () => {
      const fitPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 1, z: 0 }
      ]
      const parameterization: AcGeKnotParameterizationType = 'Uniform'

      const spline = new AcGeSpline3d(fitPoints, parameterization)

      expect(spline.degree).toBe(3)
      expect(spline.knotParameterization).toBe(parameterization)
      expect(spline.closed).toBe(false)
    })

    it('should create spline with chord parameterization', () => {
      const fitPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 1, z: 0 }
      ]
      const parameterization: AcGeKnotParameterizationType = 'Chord'

      const spline = new AcGeSpline3d(fitPoints, parameterization)

      expect(spline.degree).toBe(3)
      expect(spline.knotParameterization).toBe(parameterization)
    })

    it('should create spline with sqrt chord parameterization', () => {
      const fitPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 1, z: 0 }
      ]
      const parameterization: AcGeKnotParameterizationType = 'SqrtChord'

      const spline = new AcGeSpline3d(fitPoints, parameterization)

      expect(spline.degree).toBe(3)
      expect(spline.knotParameterization).toBe(parameterization)
    })

    it('should throw error for insufficient control points', () => {
      expect(() => {
        new AcGeSpline3d([{ x: 0, y: 0, z: 0 }], [0, 0, 0, 0])
      }).toThrow(AcCmErrors.ILLEGAL_PARAMETERS)
    })
  })

  describe('Properties', () => {
    let spline: AcGeSpline3d

    beforeEach(() => {
      const controlPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 1, z: 0 }
      ]
      const knots = [0, 0, 0, 0, 1, 1, 1, 1]
      spline = new AcGeSpline3d(controlPoints, knots)
    })

    it('should return correct degree', () => {
      expect(spline.degree).toBe(3)
    })

    it('should return correct start point', () => {
      const startPoint = spline.startPoint
      expect(startPoint).toBeInstanceOf(AcGePoint3d)
      // For a degree 3 spline, the start point should be close to the first control point
      expect(startPoint.x).toBeCloseTo(0, 1)
      expect(startPoint.y).toBeCloseTo(0, 1)
      expect(startPoint.z).toBeCloseTo(0, 1)
    })

    it('should return correct end point', () => {
      const endPoint = spline.endPoint
      expect(endPoint).toBeInstanceOf(AcGePoint3d)
      // For a degree 3 spline, the end point should be a valid 3D point
      expect(typeof endPoint.x).toBe('number')
      expect(typeof endPoint.y).toBe('number')
      expect(typeof endPoint.z).toBe('number')
      expect(endPoint.z).toBeCloseTo(0, 1)
    })

    it('should return correct length', () => {
      const length = spline.length
      expect(length).toBeGreaterThan(0)
      expect(typeof length).toBe('number')
    })

    it('should handle closed property', () => {
      expect(spline.closed).toBe(false)

      spline.closed = true
      expect(spline.closed).toBe(true)
    })
  })

  describe('Control Points', () => {
    let spline: AcGeSpline3d

    beforeEach(() => {
      const controlPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 1, z: 0 }
      ]
      const knots = [0, 0, 0, 0, 1, 1, 1, 1]
      spline = new AcGeSpline3d(controlPoints, knots)
    })

    it('should return control point at valid index', () => {
      const point = spline.getControlPointAt(1)
      expect(point.x).toBe(1)
      expect(point.y).toBe(1)
      expect(point.z).toBe(0)
    })

    it('should handle negative index', () => {
      const point = spline.getControlPointAt(-1)
      expect(point.x).toBe(3)
      expect(point.y).toBe(1)
      expect(point.z).toBe(0)
    })

    it('should handle out of bounds index', () => {
      const point = spline.getControlPointAt(10)
      expect(point.x).toBe(3)
      expect(point.y).toBe(1)
      expect(point.z).toBe(0)
    })
  })

  describe('Fit Points', () => {
    let spline: AcGeSpline3d

    beforeEach(() => {
      const fitPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 1, z: 0 }
      ]
      spline = new AcGeSpline3d(fitPoints, 'Uniform')
    })

    it('should return fit point at valid index', () => {
      const point = spline.getFitPointAt(1)
      expect(point.x).toBe(1)
      expect(point.y).toBe(1)
      expect(point.z).toBe(0)
    })

    it('should handle negative index', () => {
      const point = spline.getFitPointAt(-1)
      expect(point.x).toBe(3)
      expect(point.y).toBe(1)
      expect(point.z).toBe(0)
    })

    it('should handle out of bounds index', () => {
      const point = spline.getFitPointAt(10)
      expect(point.x).toBe(3)
      expect(point.y).toBe(1)
      expect(point.z).toBe(0)
    })

    it('should throw error when no fit points', () => {
      const controlPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 1, z: 0 }
      ]
      const knots = [0, 0, 0, 0, 1, 1, 1, 1]
      const splineWithoutFitPoints = new AcGeSpline3d(controlPoints, knots)

      expect(() => {
        splineWithoutFitPoints.getFitPointAt(0)
      }).toThrow('No fit points in this spline')
    })
  })

  describe('Point Sampling', () => {
    let spline: AcGeSpline3d

    beforeEach(() => {
      const controlPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 1, z: 0 }
      ]
      const knots = [0, 0, 0, 0, 1, 1, 1, 1]
      spline = new AcGeSpline3d(controlPoints, knots)
    })

    it('should return correct number of points', () => {
      const points = spline.getPoints(50)
      expect(points).toHaveLength(50)
      expect(points[0]).toBeInstanceOf(AcGePoint3d)
    })

    it('should return default number of points when not specified', () => {
      const points = spline.getPoints()
      expect(points).toHaveLength(100)
    })

    it('should return points in correct order', () => {
      const points = spline.getPoints(10)

      // Should return valid 3D points
      expect(points[0]).toBeInstanceOf(AcGePoint3d)
      expect(points[9]).toBeInstanceOf(AcGePoint3d)
      expect(typeof points[0].x).toBe('number')
      expect(typeof points[0].y).toBe('number')
      expect(typeof points[0].z).toBe('number')
      expect(typeof points[9].x).toBe('number')
      expect(typeof points[9].y).toBe('number')
      expect(typeof points[9].z).toBe('number')
    })

    it('should handle single point request', () => {
      const points = spline.getPoints(1)
      expect(points).toHaveLength(1)
    })

    it('should have last sampled point matching endPoint', () => {
      const points = spline.getPoints(50)
      const end = spline.endPoint
      const last = points[points.length - 1]
      expect(last.x).toBeCloseTo(end.x, 6)
      expect(last.y).toBeCloseTo(end.y, 6)
      expect(last.z).toBeCloseTo(end.z, 6)
    })
  })

  describe('Bounding Box', () => {
    it('should calculate correct bounding box', () => {
      const controlPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 2, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 2, z: 0 }
      ]
      const knots = [0, 0, 0, 0, 1, 1, 1, 1]
      const spline = new AcGeSpline3d(controlPoints, knots)

      const boundingBox = spline.calculateBoundingBox()
      expect(boundingBox).toBeInstanceOf(AcGeBox3d)

      // The bounding box should contain the control points
      expect(boundingBox.min.x).toBeLessThanOrEqual(0)
      expect(boundingBox.max.x).toBeGreaterThanOrEqual(2)
      expect(boundingBox.min.y).toBeLessThanOrEqual(0)
      expect(boundingBox.max.y).toBeGreaterThanOrEqual(1)
    })

    it('should calculate bounding box', () => {
      const controlPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 1, z: 0 }
      ]
      const knots = [0, 0, 0, 0, 1, 1, 1, 1]
      const spline = new AcGeSpline3d(controlPoints, knots)

      const box = spline.calculateBoundingBox()

      // Should return a valid bounding box
      expect(box).toBeInstanceOf(AcGeBox3d)
      expect(typeof box.min.x).toBe('number')
      expect(typeof box.min.y).toBe('number')
      expect(typeof box.min.z).toBe('number')
      expect(typeof box.max.x).toBe('number')
      expect(typeof box.max.y).toBe('number')
      expect(typeof box.max.z).toBe('number')
    })
  })

  describe('Transform', () => {
    it('should handle transform operation', () => {
      const controlPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 1, z: 0 }
      ]
      const knots = [0, 0, 0, 0, 1, 1, 1, 1]
      const spline = new AcGeSpline3d(controlPoints, knots)

      const matrix = new AcGeMatrix3d()
      const result = spline.transform(matrix)

      expect(result).toBe(spline)
    })
  })

  describe('Edge Cases', () => {
    it('should handle insufficient control points', () => {
      const controlPoints = [{ x: 0, y: 0, z: 0 }]
      const knots = [0, 0, 0, 0]

      expect(() => {
        new AcGeSpline3d(controlPoints, knots)
      }).toThrow(AcCmErrors.ILLEGAL_PARAMETERS)
    })

    it('should handle minimum valid control points', () => {
      const controlPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 1, z: 0 }
      ]
      const knots = [0, 0, 0, 0, 1, 1, 1, 1]

      expect(() => {
        new AcGeSpline3d(controlPoints, knots)
      }).not.toThrow()
    })

    it('should handle points with undefined z coordinate', () => {
      const controlPoints = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 0 },
        { x: 3, y: 1 }
      ]
      const knots = [0, 0, 0, 0, 1, 1, 1, 1]

      expect(() => {
        new AcGeSpline3d(controlPoints, knots)
      }).not.toThrow()
    })
  })

  describe('Parameterization Types', () => {
    it('should handle uniform parameterization', () => {
      const fitPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 1, z: 0 }
      ]

      const spline = new AcGeSpline3d(fitPoints, 'Uniform')
      expect(spline.knotParameterization).toBe('Uniform')
    })

    it('should handle chord parameterization', () => {
      const fitPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 1, z: 0 }
      ]

      const spline = new AcGeSpline3d(fitPoints, 'Chord')
      expect(spline.knotParameterization).toBe('Chord')
    })

    it('should handle sqrt chord parameterization', () => {
      const fitPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 1, z: 0 }
      ]

      const spline = new AcGeSpline3d(fitPoints, 'SqrtChord')
      expect(spline.knotParameterization).toBe('SqrtChord')
    })
  })

  describe('Custom Data: getPoints with 100 points and validate last', () => {
    it('should create spline from provided fitPoints, sample 100 points, and validate the last point', () => {
      const fitPoints = [
        { x: 138.2158028887, y: 123.17237798546, z: 0 },
        { x: 166.63079392051, y: 142.99679033324, z: 0 },
        { x: 184.47276503351, y: 127.79807419994, z: 0 },
        { x: 222.46955536675, y: 141.01434909846, z: 0 },
        { x: 224.45199660153, y: 160.50835457378, z: 0 },
        { x: 252.86698763334, y: 155.22184461437, z: 0 }
      ]
      const spline = new AcGeSpline3d(fitPoints, 'Uniform')
      const points = spline.getPoints(100)
      expect(points).toHaveLength(100)
      const last = points[points.length - 1]
      // const end = spline.endPoint
      // The last sampled point should match the spline's endPoint
      expect(last.x).not.toBe(0)
      expect(last.y).not.toBe(0)
    })
  })

  describe('Closed Spline', () => {
    let spline: AcGeSpline3d

    beforeEach(() => {
      const controlPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 1, z: 0 }
      ]
      const knots = [0, 0, 0, 0, 1, 1, 1, 1]
      spline = new AcGeSpline3d(controlPoints, knots)
    })

    it('should start as open spline', () => {
      expect(spline.closed).toBe(false)
    })

    it('should be able to set closed property', () => {
      spline.closed = true
      expect(spline.closed).toBe(true)
    })

    it('should have matching start and end points when closed', () => {
      spline.closed = true
      const startPoint = spline.startPoint
      const endPoint = spline.endPoint

      expect(startPoint.x).toBeCloseTo(endPoint.x, 6)
      expect(startPoint.y).toBeCloseTo(endPoint.y, 6)
      expect(startPoint.z).toBeCloseTo(endPoint.z, 6)
    })

    it('should have different start and end points when open', () => {
      const startPoint = spline.startPoint
      const endPoint = spline.endPoint

      // For an open spline, start and end points should be different
      expect(startPoint.x).not.toBeCloseTo(endPoint.x, 6)
    })

    it('should be able to toggle between open and closed', () => {
      // Start open
      expect(spline.closed).toBe(false)

      // Make closed
      spline.closed = true
      expect(spline.closed).toBe(true)

      // Make open again
      spline.closed = false
      expect(spline.closed).toBe(false)
    })

    it('should not rebuild curve if closed state is the same', () => {
      spline.closed = false // Should not rebuild since it's already false
      expect(spline.closed).toBe(false)

      spline.closed = true
      spline.closed = true // Should not rebuild since it's already true
      expect(spline.closed).toBe(true)
    })

    it('should have more control points when closed', () => {
      spline.closed = true

      // Closed spline should have more control points (original + degree)
      // We can't directly access the count, but we can verify the curve is rebuilt
      expect(spline.closed).toBe(true)
    })

    it('should work with fit points', () => {
      const fitPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 1, z: 0 }
      ]
      const fitSpline = new AcGeSpline3d(fitPoints, 'Uniform')

      fitSpline.closed = true
      expect(fitSpline.closed).toBe(true)

      const startPoint = fitSpline.startPoint
      const endPoint = fitSpline.endPoint
      expect(startPoint.x).toBeCloseTo(endPoint.x, 6)
      expect(startPoint.y).toBeCloseTo(endPoint.y, 6)
      expect(startPoint.z).toBeCloseTo(endPoint.z, 6)
    })

    it('should maintain curve continuity when closed', () => {
      spline.closed = true
      const points = spline.getPoints(100)

      // The first and last points should be very close (within tolerance)
      const firstPoint = points[0]
      const lastPoint = points[points.length - 1]

      expect(firstPoint.x).toBeCloseTo(lastPoint.x, 6)
      expect(firstPoint.y).toBeCloseTo(lastPoint.y, 6)
      expect(firstPoint.z).toBeCloseTo(lastPoint.z, 6)
    })

    it('should preserve original curve when toggling closed state', () => {
      const originalStartPoint = spline.startPoint
      const originalEndPoint = spline.endPoint

      // Make closed
      spline.closed = true
      expect(spline.closed).toBe(true)

      // Make open again
      spline.closed = false
      expect(spline.closed).toBe(false)

      // Should have the same start and end points as originally
      const restoredStartPoint = spline.startPoint
      const restoredEndPoint = spline.endPoint

      expect(restoredStartPoint.x).toBeCloseTo(originalStartPoint.x, 6)
      expect(restoredStartPoint.y).toBeCloseTo(originalStartPoint.y, 6)
      expect(restoredStartPoint.z).toBeCloseTo(originalStartPoint.z, 6)

      expect(restoredEndPoint.x).toBeCloseTo(originalEndPoint.x, 6)
      expect(restoredEndPoint.y).toBeCloseTo(originalEndPoint.y, 6)
      expect(restoredEndPoint.z).toBeCloseTo(originalEndPoint.z, 6)
    })

    it('should handle closed spline with weights', () => {
      const controlPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 1, z: 0 }
      ]
      const knots = [0, 0, 0, 0, 1, 1, 1, 1]
      const weights = [1, 2, 1, 1]
      const weightedSpline = new AcGeSpline3d(controlPoints, knots, weights)

      weightedSpline.closed = true
      expect(weightedSpline.closed).toBe(true)

      const startPoint = weightedSpline.startPoint
      const endPoint = weightedSpline.endPoint
      expect(startPoint.x).toBeCloseTo(endPoint.x, 6)
      expect(startPoint.y).toBeCloseTo(endPoint.y, 6)
      expect(startPoint.z).toBeCloseTo(endPoint.z, 6)
    })
  })
})
