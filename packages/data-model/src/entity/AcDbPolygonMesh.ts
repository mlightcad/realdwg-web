import {
  AcGeBox3d,
  AcGeMatrix3d,
  AcGePoint3d,
  AcGePoint3dLike
} from '@mlightcad/geometry-engine'
import { AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbDxfFiler } from '../base'
import { AcDbOsnapMode } from '../misc'
import { AcDbCurve } from './AcDbCurve'
import { AcDbEntityProperties } from './AcDbEntityProperties'

/**
 * Represents a polygon mesh vertex in AutoCAD.
 */
export class AcDbPolygonMeshVertex {
  /** The 3D position of the vertex */
  position: AcGePoint3d

  /**
   * Creates a new polygon mesh vertex.
   * @param position The 3D position of the vertex
   */
  constructor(position: AcGePoint3dLike) {
    this.position = new AcGePoint3d(position.x, position.y, position.z || 0)
  }
}

/**
 * Represents a polygon mesh entity in AutoCAD.
 */
export class AcDbPolygonMesh extends AcDbCurve {
  /** The entity type name */
  static override typeName: string = 'PolygonMesh'

  override get dxfTypeName() {
    return 'POLYLINE'
  }

  /** The number of vertices in the M direction */
  private _mCount: number
  /** The number of vertices in the N direction */
  private _nCount: number
  /** Whether the mesh is closed in the M direction */
  private _closedM: boolean
  /** Whether the mesh is closed in the N direction */
  private _closedN: boolean
  /** The vertices of the mesh */
  private _vertices: AcDbPolygonMeshVertex[]

  /**
   * Creates a new polygon mesh entity.
   * @param mCount The number of vertices in the M direction
   * @param nCount The number of vertices in the N direction
   * @param vertices The vertices of the mesh
   * @param closedM Whether the mesh is closed in the M direction
   * @param closedN Whether the mesh is closed in the N direction
   */
  constructor(
    mCount: number,
    nCount: number,
    vertices: AcGePoint3dLike[],
    closedM = false,
    closedN = false
  ) {
    super()
    this._mCount = mCount
    this._nCount = nCount
    this._closedM = closedM
    this._closedN = closedN
    this._vertices = vertices.map(v => new AcDbPolygonMeshVertex(v))
  }

  /**
   * Gets the number of vertices in the M direction.
   */
  get mCount(): number {
    return this._mCount
  }

  /**
   * Gets the number of vertices in the N direction.
   */
  get nCount(): number {
    return this._nCount
  }

  /**
   * Gets whether the mesh is closed in the M direction.
   */
  get closedM(): boolean {
    return this._closedM
  }

  /**
   * Gets whether the mesh is closed in the N direction.
   */
  get closedN(): boolean {
    return this._closedN
  }

  /**
   * Gets whether this mesh is closed.
   */
  get closed(): boolean {
    return this._closedM
  }

  /**
   * Sets whether this mesh is closed.
   */
  set closed(value: boolean) {
    this._closedM = value
  }

  /**
   * Gets the number of vertices in the mesh.
   */
  get numberOfVertices(): number {
    return this._vertices.length
  }

  /**
   * Gets the vertex at the specified index.
   * @param index The index of the vertex
   */
  getVertexAt(index: number): AcDbPolygonMeshVertex {
    if (index < 0 || index >= this._vertices.length) {
      throw new Error('Vertex index out of bounds')
    }
    return this._vertices[index]
  }

  /**
   * Gets the vertex at the specified M and N coordinates.
   * @param m The M coordinate
   * @param n The N coordinate
   */
  getVertexAtMN(m: number, n: number): AcDbPolygonMeshVertex {
    const index = m * this._nCount + n
    return this.getVertexAt(index)
  }

  /**
   * Gets the geometric extents (bounding box) of this mesh.
   */
  get geometricExtents(): AcGeBox3d {
    if (this._vertices.length === 0) {
      return new AcGeBox3d(new AcGePoint3d(0, 0, 0), new AcGePoint3d(0, 0, 0))
    }

    let minX = Number.MAX_VALUE
    let minY = Number.MAX_VALUE
    let minZ = Number.MAX_VALUE
    let maxX = -Number.MAX_VALUE
    let maxY = -Number.MAX_VALUE
    let maxZ = -Number.MAX_VALUE

    this._vertices.forEach(vertex => {
      minX = Math.min(minX, vertex.position.x)
      minY = Math.min(minY, vertex.position.y)
      minZ = Math.min(minZ, vertex.position.z)
      maxX = Math.max(maxX, vertex.position.x)
      maxY = Math.max(maxY, vertex.position.y)
      maxZ = Math.max(maxZ, vertex.position.z)
    })

    return new AcGeBox3d(
      new AcGePoint3d(minX, minY, minZ),
      new AcGePoint3d(maxX, maxY, maxZ)
    )
  }

  /**
   * Gets the grip points for this mesh.
   */
  subGetGripPoints() {
    const gripPoints = new Array<AcGePoint3d>()
    this._vertices.forEach(vertex => {
      gripPoints.push(vertex.position)
    })
    return gripPoints
  }

  /**
   * Gets the object snap points for this mesh.
   */
  subGetOsnapPoints(
    osnapMode: AcDbOsnapMode,
    _pickPoint: AcGePoint3dLike,
    _lastPoint: AcGePoint3dLike,
    snapPoints: AcGePoint3dLike[]
  ) {
    switch (osnapMode) {
      case AcDbOsnapMode.EndPoint:
        this._vertices.forEach(vertex => {
          snapPoints.push(vertex.position)
        })
        break
      default:
        break
    }
  }

  /**
   * Transforms this polygon mesh by the specified matrix.
   */
  transformBy(matrix: AcGeMatrix3d) {
    this._vertices.forEach(vertex => {
      vertex.position.applyMatrix4(matrix)
    })
    return this
  }

  /**
   * Returns the full property definition for this mesh entity.
   */
  get properties(): AcDbEntityProperties {
    return {
      type: this.type,
      groups: [
        this.getGeneralProperties(),
        {
          groupName: 'geometry',
          properties: [
            {
              name: 'mCount',
              type: 'float',
              editable: false,
              accessor: {
                get: () => this._mCount
              }
            },
            {
              name: 'nCount',
              type: 'float',
              editable: false,
              accessor: {
                get: () => this._nCount
              }
            },
            {
              name: 'vertices',
              type: 'array',
              editable: false,
              itemSchema: {
                properties: [
                  {
                    name: 'x',
                    type: 'float',
                    editable: true
                  },
                  {
                    name: 'y',
                    type: 'float',
                    editable: true
                  },
                  {
                    name: 'z',
                    type: 'float',
                    editable: true
                  }
                ]
              },
              accessor: {
                get: () =>
                  this._vertices.map(v => ({
                    x: v.position.x,
                    y: v.position.y,
                    z: v.position.z
                  }))
              }
            }
          ]
        },
        {
          groupName: 'others',
          properties: [
            {
              name: 'closedM',
              type: 'boolean',
              editable: true,
              accessor: {
                get: () => this._closedM,
                set: (v: boolean) => {
                  this._closedM = v
                }
              }
            },
            {
              name: 'closedN',
              type: 'boolean',
              editable: true,
              accessor: {
                get: () => this._closedN,
                set: (v: boolean) => {
                  this._closedN = v
                }
              }
            }
          ]
        }
      ]
    }
  }

  /**
   * Draws this mesh using the specified renderer.
   */
  subWorldDraw(renderer: AcGiRenderer) {
    const lines: AcGePoint3d[] = []

    // Draw M-direction lines
    for (let m = 0; m < this._mCount; m++) {
      for (let n = 0; n < this._nCount; n++) {
        const current = this.getVertexAtMN(m, n)
        let nextN = n + 1
        if (nextN >= this._nCount) {
          if (this._closedN) {
            nextN = 0
          } else {
            continue
          }
        }
        const next = this.getVertexAtMN(m, nextN)
        lines.push(current.position)
        lines.push(next.position)
      }
    }

    // Draw N-direction lines
    for (let n = 0; n < this._nCount; n++) {
      for (let m = 0; m < this._mCount; m++) {
        const current = this.getVertexAtMN(m, n)
        let nextM = m + 1
        if (nextM >= this._mCount) {
          if (this._closedM) {
            nextM = 0
          } else {
            continue
          }
        }
        const next = this.getVertexAtMN(nextM, n)
        lines.push(current.position)
        lines.push(next.position)
      }
    }

    return renderer.lines(lines)
  }

  /**
   * Writes DXF fields for this object.
   */
  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbPolygonMesh')

    let flag = 16 // Polygon mesh flag
    if (this._closedM) flag |= 1
    if (this._closedN) flag |= 32

    filer.writeInt16(66, 1) // Has vertices
    filer.writeInt16(70, flag)
    filer.writeInt32(71, this._mCount)
    filer.writeInt32(72, this._nCount)

    return this
  }

  /**
   * Writes this object to the DXF output.
   */
  override dxfOut(filer: AcDbDxfFiler, allXdata = false) {
    super.dxfOut(filer, allXdata)

    for (let i = 0; i < this.numberOfVertices; i++) {
      const vertex = this.getVertexAt(i)
      filer.writeStart('VERTEX')
      filer.writeHandle(5, this.database.generateHandle())
      filer.writeObjectId(330, this.objectId)
      filer.writeSubclassMarker('AcDbEntity')
      filer.writeSubclassMarker('AcDbVertex')
      filer.writeSubclassMarker('AcDbPolygonMeshVertex')
      filer.writePoint3d(10, vertex.position)
      filer.writeInt16(70, 16) // Polygon mesh vertex flag
    }

    filer.writeStart('SEQEND')
    filer.writeHandle(5, this.database.generateHandle())
    filer.writeObjectId(330, this.objectId)
    filer.writeSubclassMarker('AcDbEntity')
    return this
  }
}
