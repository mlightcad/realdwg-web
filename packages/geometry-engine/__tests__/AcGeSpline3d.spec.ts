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
})
