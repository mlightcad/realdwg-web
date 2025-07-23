import {
  AcGeBox3d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGeSpline3d
} from '@mlightcad/geometry-engine'
import { AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbCurve } from './AcDbCurve'

export enum AcDbLeaderAnnotationType {
  MText = 0,
  Fcf = 1,
  BlockReference = 2,
  NoAnnotation = 3
}

/**
 * The class represents the LEADER entity within AutoCAD. Leaders are considered as dimensions in AutoCAD,
 * which means they are controlled by dimension variable settings and dimension styles.
 */
export class AcDbLeader extends AcDbCurve {
  private _isSplined: boolean
  private _splineGeo?: AcGeSpline3d
  private _updated: boolean
  private _hasArrowHead: boolean
  private _vertices: AcGePoint3d[]
  private _dimensionStyle: string
  private _hasHookLine: boolean
  private _annoType: AcDbLeaderAnnotationType

  /**
   * Construct an instance of the leader entity.
   */
  constructor() {
    super()
    this._isSplined = false
    this._updated = false
    this._hasArrowHead = false
    this._vertices = []
    this._dimensionStyle = ''
    this._hasHookLine = false
    this._annoType = AcDbLeaderAnnotationType.NoAnnotation
  }

  /**
   * Return true if this leader is spline-fit. Otherwise return false.
   */
  get isSplined() {
    return this._isSplined
  }
  set isSplined(value: boolean) {
    this._isSplined = value
  }

  /**
   * Return true if arrowhead is currently enabled for this leader. Otherwise return false.
   */
  get hasArrowHead() {
    return this._hasArrowHead
  }
  set hasArrowHead(value: boolean) {
    this._hasArrowHead = value
  }

  /**
   * Return true if this leader has a hookline. Otherwise return false. The "hookline" is the small
   * horizontal line at the end of the leader line just before the annotation.
   */
  get hasHookLine() {
    return this._hasHookLine
  }
  set hasHookLine(value: boolean) {
    this._hasHookLine = value
  }

  /**
   * The number of vertices in the leader's vertex list.
   */
  get numVertices(): number {
    return this._vertices.length
  }

  /**
   * The dimension style applied on this leader
   */
  get dimensionStyle() {
    return this._dimensionStyle
  }
  set dimensionStyle(value: string) {
    this._dimensionStyle = value
  }

  /**
   * The leader's annotation type.
   */
  get annoType() {
    return this._annoType
  }
  set annoType(value: AcDbLeaderAnnotationType) {
    this._annoType = value
  }

  /**
   * Appends vertex to the end of the vertex list for this leader. If vertex is not in the plane of the
   * leader, then it will be projected parallel the leader's normal onto the leader's plane and the
   * projection will be appended to the leader's vertex list. If the new vertex is too close to the one
   * next to it (that is, within 1.e-10 for X, Y, and Z), the new vertex will not be appended.
   * @param point Input point (in WCS coordinates) to add to the vertex list
   */
  appendVertex(point: AcGePoint3dLike) {
    this._vertices.push(new AcGePoint3d().copy(point))
    this._updated = true
  }

  /**
   * Reset the vertex at index to the point point projected (along the plane normal) onto the plane
   * containing the leader. It doesn't reset the vertex if that would cause one of the segments to
   * become zero length (within 1e-10).
   * @param index Input index number (0 based) of the vertex to change
   * @param point Input new point value (in WCS) to use
   */
  setVertexAt(index: number, point: AcGePoint3dLike) {
    if (index < 0 || index >= this._vertices.length) {
      // TODO: Project the point onto the plane containing the leader
      this._vertices[index].copy(point)
      this._updated = true
    }
    throw new Error('The vertex index is out of range!')
  }

  /**
   * Get the point that is the vertex at the location index (0 based) in this leader's vertex array.
   * @param index Input index number (0 based) of the vertex desired
   */
  vertexAt(index: number) {
    if (index < 0 || index >= this._vertices.length) {
      this._vertices[index]
    }
    throw new Error('The vertex index is out of range!')
  }

  /**
   * @inheritdoc
   */
  get geometricExtents() {
    if (this._isSplined && this.splineGeo) {
      return this.splineGeo.calculateBoundingBox()
    } else {
      const box = new AcGeBox3d()
      return box.setFromPoints(this._vertices)
    }
  }

  /**
   * @inheritdoc
   */
  get closed(): boolean {
    return false
  }
  set closed(_value: boolean) {
    // TODO: Not sure whether the leader really support setting value of property 'closed'
  }

  /**
   * @inheritdoc
   */
  draw(renderer: AcGiRenderer) {
    if (this.isSplined && this.splineGeo) {
      const points = this.splineGeo.getPoints(100)
      return renderer.lines(points, this.lineStyle)
    } else {
      return renderer.lines(this._vertices, this.lineStyle)
    }
  }

  private get splineGeo() {
    this.createSplineIfNeeded()
    return this._splineGeo
  }

  private createSplineIfNeeded() {
    if (
      this.isSplined &&
      this.numVertices >= 2 &&
      (this._splineGeo == null || this._updated)
    ) {
      this._splineGeo = new AcGeSpline3d(this._vertices, 'Uniform')
      this._updated = false
    }
  }
}
