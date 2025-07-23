import { AcDbObject, AcDbObjectId } from '../base/AcDbObject'
import { AcDbObjectIterator } from '../misc/AcDbObjectIterator'
import { AcDbDatabase } from './AcDbDatabase'
import { AcDbSymbolTableRecord } from './AcDbSymbolTableRecord'

/**
 * AcDbSymbolTable is the base class for all of the classes used to export AutoCAD's
 * built-in symbol tables.
 */
export class AcDbSymbolTable<
  RecordType extends AcDbSymbolTableRecord = AcDbSymbolTableRecord
> extends AcDbObject {
  protected _recordsByName: Map<string, RecordType>
  protected _recordsById: Map<string, RecordType>

  constructor(db: AcDbDatabase) {
    super()
    this.database = db
    this._recordsByName = new Map<string, RecordType>()
    this._recordsById = new Map<string, RecordType>()
  }

  /**
   * Add the record to both the database containing the table and the table itself
   * @param record Input record to add to the table
   */
  add(record: RecordType) {
    record.database = this.database
    this._recordsByName.set(record.name, record)
    this._recordsById.set(record.objectId, record)
  }

  /**
   * Remove the record with the specified name
   * @param name Input the name of the record to remove
   * @returns Return true if removing the record correctly. Otherwise, return false.
   */
  remove(name: string) {
    const record = this._recordsByName.get(name)
    if (record) {
      this._recordsById.delete(record.objectId)
      this._recordsByName.delete(name)
      return true
    }
    return false
  }

  /**
   * Remove the record with the specified id
   * @param id Input object id of the record to remove
   * @returns Return true if removing the record correctly. Otherwise, return false.
   */
  removeId(id: AcDbObjectId) {
    const record = this._recordsById.get(id)
    if (record) {
      this._recordsByName.delete(record.name)
      this._recordsById.delete(id)
      return true
    }
    return false
  }

  /**
   * Remove all of records in the table.
   */
  removeAll() {
    this._recordsByName.clear()
    this._recordsById.clear()
  }

  /**
   * Return true if the table contains a record with the sepcified name. Otherwise it returns false.
   *
   * @param name Input name to search for
   */
  has(name: string) {
    return this._recordsByName.has(name)
  }

  /**
   * Return true if the table contains a record with the sepcified id. Otherwise it returns false.
   *
   * @param id Input id to search for
   */
  hasId(id: string) {
    return this._recordsById.has(id)
  }

  /**
   * Search the table for the record with the specified name. If found, it return the record.
   * Otherwise, return undefined.
   * @param name Input the name to search
   * @returns If found the record with the specified name, return it. Otherwise, return undefined.
   */
  getAt(name: string) {
    return this._recordsByName.get(name)
  }

  /**
   * Search the table for the record with the specified id. If found, it return the record.
   * Otherwise, return undefined.
   * @param id Input the id to search
   * @returns If found the record with the specified id, return it. Otherwise, return undefined.
   */
  getIdAt(id: AcDbObjectId) {
    return this._recordsById.get(id)
  }

  /**
   * Search the table for the record with the specified owner id. If found, it return the record.
   * Otherwise, return undefined.
   * @param id Input the owner id to search
   * @returns If found the record with the specified owner id, return it. Otherwise, return undefined.
   */
  getOwnerIdAt(id: AcDbObjectId): RecordType | undefined {
    let result: RecordType | undefined = undefined
    this._recordsById.forEach((value, key) => {
      if (value.ownerId == id) {
        result = this._recordsById.get(key)
      }
    })
    return result
  }

  /**
   * Create an iterator object that can be used to iterate through the contents of the symbol table.
   *
   * @returns Return an iterator object that can be used to iterate through the contents of the symbol table.
   */
  newIterator(): AcDbObjectIterator<RecordType> {
    return new AcDbObjectIterator(this._recordsByName)
  }
}
