import {
  AcGeBox3d,
  AcGeEuler,
  AcGeMatrix3d,
  AcGePoint3d,
  AcGeQuaternion,
  AcGeVector3d
} from '@mlightcad/geometry-engine'
import { AcGiEntity, AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbRenderingCache } from '../misc'
import { AcDbEntity } from './AcDbEntity'

/**
 * A block reference is used to place, size, and display an instance of the collection of entities within
 * the block table record that it references.
 */
export class AcDbBlockReference extends AcDbEntity {
  private _position: AcGePoint3d
  private _rotation: number
  private _scaleFactors: AcGePoint3d
  private _normal: AcGeVector3d
  private _blockName: string

  constructor(blockName: string) {
    super()
    this._blockName = blockName
    this._position = new AcGePoint3d()
    this._rotation = 0.0
    this._normal = new AcGeVector3d(0, 0, 1)
    this._scaleFactors = new AcGePoint3d(1, 1, 1)
  }

  /**
   * WCS position point (often referred to as the insertion point) of the block reference
   */
  get position() {
    return this._position
  }
  set position(value: AcGePoint3d) {
    this._position.copy(value)
  }

  /**
   * The rotation value (in radians) of the block reference. The rotation value is relative to the X
   * axis of a coordinate system that is parallel to the OCS of the block reference, but has its origin
   * at the position point of the block reference. The rotation axis is the Z axis of this coordinate
   * system with positive rotations going counterclockwise when looking down the Z axis towards the
   * origin.
   */
  get rotation() {
    return this._rotation
  }
  set rotation(value: number) {
    this._rotation = value
  }

  /**
   * The X, Y, and Z scale factors for the block reference.
   */
  get scaleFactors() {
    return this._scaleFactors
  }
  set scaleFactors(value: AcGePoint3d) {
    this._scaleFactors.copy(value)
  }

  /**
   * The normal vector of the plane containing the block reference.
   */
  get normal() {
    return this._normal
  }
  set normal(value: AcGeVector3d) {
    this._normal.copy(value).normalize()
  }

  /**
   * The block table record referenced by the block reference. The referenced block table record contains
   * the entities that the block reference will display.
   */
  get blockTableRecord() {
    return this.database.tables.blockTable.getAt(this._blockName)
  }

  /**
   * @inheritdoc
   */
  get geometricExtents(): AcGeBox3d {
    const box = new AcGeBox3d()
    const blockTableRecord = this.blockTableRecord
    if (blockTableRecord != null) {
      const entities = blockTableRecord.newIterator()
      for (const entity of entities) {
        box.union(entity.geometricExtents)
      }
    }

    const quaternion = new AcGeQuaternion().setFromEuler(
      new AcGeEuler(this.rotation, 0, 0)
    )
    const matrix = new AcGeMatrix3d()
    matrix.compose(this.position, quaternion, this.scaleFactors)
    box.applyMatrix4(matrix)

    return box
  }

  /**
   * @inheritdoc
   */
  draw(renderer: AcGiRenderer) {
    const results: AcGiEntity[] = []
    const blockTableRecord = this.blockTableRecord
    if (blockTableRecord != null) {
      const matrix = this.computeTransformMatrix()
      const block = AcDbRenderingCache.instance.draw(
        renderer,
        blockTableRecord,
        this.rgbColor,
        true,
        matrix,
        this.normal
      )
      return block
    } else {
      return renderer.group(results)
    }
  }

  private computeTransformMatrix() {
    const quaternion = new AcGeQuaternion()
    quaternion.setFromAxisAngle(AcGeVector3d.Z_AXIS, this.rotation)
    return new AcGeMatrix3d().compose(
      this._position,
      quaternion,
      this._scaleFactors
    )
  }
}
