import { AcGePoint3d } from '@mlightcad/geometry-engine'
import { AcDbObjectId } from 'base/AcDbObject'

import { AcDbEntity } from '../entity/AcDbEntity'
import { AcDbObjectIterator } from '../misc/AcDbObjectIterator'
import { AcDbSymbolTableRecord } from './AcDbSymbolTableRecord'

/**
 * Objects of the block table record are used as containers for entities within drawing file
 * databases. There are two special BTRs that are always present in every database. They are
 * *Model_Space and *Paper_Space. They are the Model and Paper Spaces for the database.
 */
export class AcDbBlockTableRecord extends AcDbSymbolTableRecord {
  static MODEL_SPACE_NAME = '*Model_Space'
  static PAPER_SPACE_NAME_PREFIX = '*Paper_Space'
  private _origin: AcGePoint3d
  private _entities: Map<AcDbObjectId, AcDbEntity>

  constructor() {
    super()
    this._origin = new AcGePoint3d()
    this._entities = new Map<string, AcDbEntity>()
  }

  /**
   * Return true if it is model space block table record.
   */
  get isModelSapce() {
    return (
      this.name.toLowerCase() ==
      AcDbBlockTableRecord.MODEL_SPACE_NAME.toLowerCase()
    )
  }

  /**
   * Return true if it is paper space block table record.
   */
  get isPaperSapce() {
    return this.name
      .toLowerCase()
      .startsWith(AcDbBlockTableRecord.PAPER_SPACE_NAME_PREFIX.toLowerCase())
  }

  /**
   * The base point of the block in WCS coordinates. This point is the origin of the MCS (which is the
   * local WCS for the entities within the block table record).
   */
  get origin() {
    return this._origin
  }
  set origin(value: AcGePoint3d) {
    this._origin.copy(value)
  }

  /**
   * Append the specified entity to this block table record.
   * @param entity Input entity to append
   */
  appendEntity(entity: AcDbEntity) {
    entity.database = this.database
    entity.ownerId = this.objectId
    this._entities.set(entity.objectId, entity)

    // When creating one block, it will also go to this function. But we don't want `entityAppended` event
    // tiggered in this case. So check whether the block name is name of the model space.
    if (this.isModelSapce || this.isPaperSapce) {
      this.database.events.entityAppended.dispatch({
        database: this.database,
        entity: entity
      })
    }
  }

  /**
   * Create an iterator object that can be used to iterate over the entities in the block table record.
   *
   * @returns Return an iterator object that can be used to iterate over the entities in the block table record.
   */
  newIterator(): AcDbObjectIterator<AcDbEntity> {
    return new AcDbObjectIterator(this._entities)
  }

  /**
   * Search entities in this block table record with the specified id. If found, it return the entity.
   * Otherwise, return undefined.
   * @param id Input the entity id to search
   * @returns If found the entity with the specified id, return it. Otherwise, return undefined.
   */
  getIdAt(id: string) {
    return this._entities.get(id)
  }
}
