import { AcGePoint3d } from '@mlightcad/geometry-engine'

import { AcDbDxfFiler } from '../base'
import { AcDbObjectId } from '../base/AcDbObject'
import { AcDbEntity } from '../entity/AcDbEntity'
import { AcDbObjectIterator } from '../misc/AcDbObjectIterator'
import { AcDbUnitsValue } from '../misc/AcDbUnitsValue'
import { AcDbSymbolTableRecord } from './AcDbSymbolTableRecord'

/**
 * Block table record that serves as a container for entities within drawing databases.
 *
 * Block table records (BTRs) are used to organize and group entities together.
 * There are two special BTRs that are always present in every database:
 * - *MODEL_SPACE: Contains entities in model space
 * - *PAPER_SPACE: Contains entities in paper space
 *
 * Each block table record has an origin point and can contain multiple entities.
 *
 * @example
 * ```typescript
 * const blockRecord = new AcDbBlockTableRecord();
 * blockRecord.name = 'MyBlock';
 * blockRecord.origin = new AcGePoint3d(0, 0, 0);
 * blockRecord.appendEntity(new AcDbLine());
 * ```
 */
export enum AcDbBlockScaling {
  Any,
  Uniform
}

export class AcDbBlockTableRecord extends AcDbSymbolTableRecord {
  /** Name constant for model space block table record */
  static MODEL_SPACE_NAME = '*Model_Space'
  /** Name prefix for paper space block table records */
  static PAPER_SPACE_NAME_PREFIX = '*Paper_Space'

  /** The base point of the block in WCS coordinates */
  private _origin: AcGePoint3d
  /** The object id of the associated AcDbLayout object in the Layouts dictionary.*/
  private _layoutId: AcDbObjectId
  /** Map of entities indexed by their object IDs */
  private _entities: Map<AcDbObjectId, AcDbEntity>
  /** Block insertion units (DXF group code 70) */
  private _blockInsertUnits: AcDbUnitsValue
  /** Block explodability flag (DXF group code 280) */
  private _explodability: number
  /** Block scalability flag (DXF group code 281) */
  private _blockScaling: AcDbBlockScaling
  /** Binary data for bitmap preview (DXF group code 310, optional) */
  private _bmpPreview?: string

  /**
   * Returns true if the specified name is the name of the model space block table record.
   *
   * Model space is the primary drawing area where most entities are created.
   *
   * @param name - The name of one block table record.
   * @returns True if the specified name is the name of the model space block table record.
   *
   * @example
   * ```typescript
   * if (AcDbBlockTableRecord.isModelSapceName('*Model_Space')) {
   *   console.log('This is the name of the model space block table record.');
   * }
   * ```
   */
  static isModelSapceName(name: string) {
    return (
      name.toLowerCase() == AcDbBlockTableRecord.MODEL_SPACE_NAME.toLowerCase()
    )
  }

  /**
   * Returns true if the specified name is the name of a paper space block table record.
   *
   * Paper space is used for creating layouts for printing and plotting.
   *
   * @param name - The name of one block table record.
   * @returns True if the specified name is the name of a paper space block table record.
   *
   * @example
   * ```typescript
   * if (AcDbBlockTableRecord.isPaperSapceName('*Paper_Space1')) {
   *   console.log('This is the name of the paper space block table record.');
   * }
   * ```
   */
  static isPaperSapceName(name: string) {
    return name
      .toLowerCase()
      .startsWith(AcDbBlockTableRecord.PAPER_SPACE_NAME_PREFIX.toLowerCase())
  }

  /**
   * Creates a new AcDbBlockTableRecord instance.
   *
   * @example
   * ```typescript
   * const blockRecord = new AcDbBlockTableRecord();
   * ```
   */
  constructor() {
    super()
    this._origin = new AcGePoint3d()
    this._layoutId = ''
    this._entities = new Map<string, AcDbEntity>()
    this._blockInsertUnits = 0
    this._explodability = 1
    this._blockScaling = AcDbBlockScaling.Uniform
    this._bmpPreview = undefined
  }

  /**
   * Returns true if this is a model space block table record.
   *
   * Model space is the primary drawing area where most entities are created.
   *
   * @returns True if this is a model space block table record
   *
   * @example
   * ```typescript
   * if (blockRecord.isModelSapce) {
   *   console.log('This is model space');
   * }
   * ```
   */
  get isModelSapce() {
    return AcDbBlockTableRecord.isModelSapceName(this.name)
  }

  /**
   * Returns true if this is a paper space block table record.
   *
   * Paper space is used for creating layouts for printing and plotting.
   *
   * @returns True if this is a paper space block table record
   *
   * @example
   * ```typescript
   * if (blockRecord.isPaperSapce) {
   *   console.log('This is paper space');
   * }
   * ```
   */
  get isPaperSapce() {
    return AcDbBlockTableRecord.isPaperSapceName(this.name)
  }

  /**
   * Gets or sets the base point of the block in WCS coordinates.
   *
   * This point is the origin of the MCS (Model Coordinate System), which is the
   * local WCS for the entities within the block table record.
   *
   * @returns The origin point of the block
   *
   * @example
   * ```typescript
   * const origin = blockRecord.origin;
   * blockRecord.origin = new AcGePoint3d(10, 20, 0);
   * ```
   */
  get origin() {
    return this._origin
  }
  set origin(value: AcGePoint3d) {
    this._origin.copy(value)
  }

  /**
   * Gets or sets the object ID of the associated AcDbLayout object in the Layouts dictionary.
   *
   * This property links the block table record to its corresponding layout object,
   * which defines the viewport configuration and display settings for the block.
   * For model space blocks, this is typically empty, while paper space blocks
   * have a corresponding layout ID.
   *
   * @returns The object ID of the associated layout
   *
   * @example
   * ```typescript
   * const layoutId = blockRecord.layoutId;
   * blockRecord.layoutId = 'some-layout-object-id';
   * ```
   */
  get layoutId() {
    return this._layoutId
  }
  set layoutId(value: AcDbObjectId) {
    this._layoutId = value
  }

  /**
   * Gets or sets the block insertion units.
   *
   * This corresponds to DXF group code 70 in BLOCK_RECORD entries.
   *
   * @returns The insertion units value
   */
  get blockInsertUnits() {
    return this._blockInsertUnits
  }
  set blockInsertUnits(value: AcDbUnitsValue) {
    this._blockInsertUnits = value
  }

  /**
   * Gets or sets the block explodability flag.
   *
   * This corresponds to DXF group code 280 in BLOCK_RECORD entries.
   *
   * @returns The explodability value
   */
  get explodability() {
    return this._explodability
  }
  set explodability(value: number) {
    this._explodability = value
  }

  /**
   * Gets or sets the block scalability flag.
   *
   * This corresponds to DXF group code 281 in BLOCK_RECORD entries.
   *
   * @returns The scalability value
   */
  get blockScaling() {
    return this._blockScaling
  }
  set blockScaling(value: AcDbBlockScaling) {
    this._blockScaling = value
  }

  /**
   * Gets or sets the bitmap preview data.
   *
   * This corresponds to DXF group code 310 in BLOCK_RECORD entries.
   *
   * @returns The bitmap preview data
   */
  get bmpPreview() {
    return this._bmpPreview
  }
  set bmpPreview(value: string | undefined) {
    this._bmpPreview = value
  }

  /**
   * Appends the specified entity or entities to this block table record.
   *
   * This method adds an entity to the block and sets up the necessary
   * relationships between the entity and the block table record.
   *
   * @param entity - The entity or entities to append to this block table record
   *
   * @example
   * ```typescript
   * const line = new AcDbLine();
   * blockRecord.appendEntity(line);
   * ```
   */
  appendEntity(entity: AcDbEntity | AcDbEntity[]) {
    const commitEntity = (item: AcDbEntity) => {
      item.database = this.database
      item.ownerId = this.objectId
      this.database.commitObjectHandle(item, id => this._entities.has(id))
      item.resolveEffectiveProperties()
      this._entities.set(item.objectId, item)
    }

    if (Array.isArray(entity)) {
      for (let i = 0; i < entity.length; ++i) {
        commitEntity(entity[i])
      }
    } else {
      commitEntity(entity)
    }

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
   * Removes the specified entity or entities from this block table record.
   *
   * Notes:
   * Please call method AcDbEntity.erase to remove one entity instead of calling
   * this function.
   *
   * AutoCAD ObjectARX API doesn't provide such one method to remove entities
   * from the block table record. I guess it is done by friend class or function
   * feature in C++. However, there are no similar feature in TypeScript. So
   * we have to expose such one public method in AcDbBlockTableRecord.
   *
   * @param objectId - The object id or ids of entities to remove from this block table record
   * @returns — true if an entity in the block table record existed and has been removed,
   * or false if the entity does not exist.
   */
  removeEntity(objectId: AcDbObjectId | AcDbObjectId[]) {
    const ids = Array.isArray(objectId) ? objectId : [objectId]
    const entities: AcDbEntity[] = []
    ids.forEach(id => {
      const entity = this._entities.get(id)
      if (entity) {
        entities.push(entity)
      }
      this._entities.delete(id)
    })
    if (entities.length > 0) {
      this.database.events.entityErased.dispatch({
        database: this.database,
        entity: entities
      })
    }
    return entities.length > 0
  }

  /**
   * Creates an iterator object that can be used to iterate over the entities in the block table record.
   *
   * @returns An iterator object that can be used to iterate over the entities
   *
   * @example
   * ```typescript
   * const iterator = blockRecord.newIterator();
   * for (const entity of iterator) {
   *   console.log('Entity:', entity.type);
   * }
   * ```
   */
  newIterator(): AcDbObjectIterator<AcDbEntity> {
    return new AcDbObjectIterator(this._entities)
  }

  /**
   * Searches for an entity in this block table record with the specified ID.
   *
   * @param id - The entity ID to search for
   * @returns The entity with the specified ID, or undefined if not found
   */
  getIdAt(id: AcDbObjectId) {
    return this._entities.get(id)
  }

  dxfOutBlockRecord(filer: AcDbDxfFiler) {
    filer.writeStart('BLOCK_RECORD')
    this.dxfOut(filer)
    return this
  }

  dxfOutBlockBegin(filer: AcDbDxfFiler) {
    filer.writeStart('BLOCK')
    // DWG/DXF parser doesn't parse AcDbBlockBegin and AcDbBlockEnd.
    // There is no handle data avaiable for AcDbBlockBegin. So generate
    // one new handle dynamically.
    filer.writeHandle(5, this.database.generateHandle())
    filer.writeObjectId(330, this.objectId)
    filer.writeSubclassMarker('AcDbEntity')
    filer.writeSubclassMarker('AcDbBlockBegin')
    filer.writeString(8, '0')
    filer.writeString(2, this.name)
    filer.writeInt16(70, 0)
    filer.writePoint3d(10, this.origin)
    filer.writeString(3, this.name)
    return this
  }

  dxfOutBlockEnd(filer: AcDbDxfFiler) {
    filer.writeStart('ENDBLK')
    // DWG/DXF parser doesn't parse AcDbBlockBegin and AcDbBlockEnd.
    // There is no handle data avaiable for AcDbBlockBegin. So generate
    // one new handle dynamically.
    filer.writeHandle(5, this.database.generateHandle())
    filer.writeObjectId(330, this.objectId)
    filer.writeSubclassMarker('AcDbEntity')
    filer.writeSubclassMarker('AcDbBlockEnd')
    return this
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbBlockTableRecord')
    filer.writeString(2, this.name)
    filer.writeInt16(70, this.blockInsertUnits)
    filer.writeInt16(280, this.explodability)
    filer.writeInt16(281, this.blockScaling)
    // TODO: Oupput preview bitmap with the correct format
    // filer.writeString(310, this.bmpPreview)
    if (this.isModelSapce || this.isPaperSapce) {
      filer.writeObjectId(340, this.layoutId)
    }
    return this
  }
}
