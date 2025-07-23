import { AcDbObject, AcDbObjectId } from '../base'
import { AcDbDatabase } from '../database'
import { AcDbObjectIterator } from '../misc'

/**
 * A database-resident object dictionary, which maintains a map between text strings and database objects.
 * An instance of this class represents a single object, such as Drawing Symbol Table, to which objects
 * derived from AcDbObject may be added, accessed, and removed. Entries in an AcDbDictionary must be unique.
 * Entries consist of a unique AcDbObject and string, which comprises the entry's key name. The key may be
 * either an text string, or an asterisk ('*') as the first character in the string to signify an anonymous
 * entry. An anonymous entry's key will be constructed internally by appending an 'A' plus a unique integer
 * value to the asterisk; for example, '*A13'. When an object is placed in a dictionary, the dictionary is
 * established as the object's owner, the lookup key string is associated with the object's object ID, and
 * the dictionary itself is attached to the object as a persistent reactor so that the dictionary is notified
 * when the object is erased.
 */
export class AcDbDictionary<
  TObjectType extends AcDbObject = AcDbObject
> extends AcDbObject {
  protected _recordsByName: Map<string, TObjectType>
  protected _recordsById: Map<string, TObjectType>

  constructor(db: AcDbDatabase) {
    super()
    this.database = db
    this._recordsByName = new Map<string, TObjectType>()
    this._recordsById = new Map<string, TObjectType>()
  }

  /**
   * The number of entries in the dictionary.
   */
  get numEntries() {
    return this._recordsByName.size
  }

  /**
   * Add a new entry specified by 'value' into the dictionary, if 'key' does not already exist in the
   * dictionary. If the entry with 'key' already exists, the existing entry is erased.
   * @param key Input string representing the object's search key name
   * @param value Input the new object to add to the dictionary
   */
  setAt(key: string, value: TObjectType) {
    value.database = this.database
    this._recordsByName.set(key, value)
    this._recordsById.set(value.objectId, value)
  }

  /**
   * Remove the entry specified by 'name' from the dictionary.
   * @param name Input string representing the entry's key (or name)
   * @returns If the entry specified by object id exists in the dictionary and remove it correctly, return
   * true. Otherwise, return false.
   */
  remove(name: string) {
    const object = this.getAt(name)
    if (object) {
      this._recordsByName.delete(name.toUpperCase())
      this._recordsById.delete(this.objectId)
      return true
    }
    return false
  }

  /**
   * Remove the entry specified by object id from the dictionary.
   * @param id Input id of the object to delete
   * @returns If the entry specified by object id exists in the dictionary and remove it correctly, return
   * true. Otherwise, return false.
   */
  removeId(id: string) {
    const object = this.getIdAt(id)
    if (object) {
      this._recordsById.delete(this.objectId)
      this._recordsByName.forEach((value, key) => {
        if (value === object) this._recordsByName.delete(key)
      })
      return true
    }
    return false
  }

  /**
   * Remove all of records in the dictionary.
   */
  removeAll() {
    this._recordsByName.clear()
    this._recordsById.clear()
  }

  /**
   * Return true if the dictionary contains an object with the sepcified name. Otherwise it returns false.
   * @param name Input name to search for
   */
  has(name: string) {
    return this._recordsByName.has(name.toUpperCase())
  }

  /**
   * Return true if the dictionary contains an object with the sepcified id. Otherwise it returns false.
   * @param id Input object id to search for
   */
  hasId(id: string) {
    return this._recordsById.has(id)
  }

  /**
   * Search the dictionary for the object with the specified name. If found, it return the record.
   * Otherwise, return undefined.
   * @param name Input the name to search
   * @returns If found the object with the specified name, return it. Otherwise, return undefined.
   */
  getAt(name: string) {
    return this._recordsByName.get(name)
  }

  /**
   * Search the dictionary for the record with the specified id. If found, it returns the record.
   * Otherwise, return undefined.
   * @param id Input the id to search
   * @returns If found the object with the specified id, return it. Otherwise, return undefined.
   */
  getIdAt(id: AcDbObjectId) {
    return this._recordsById.get(id)
  }

  /**
   * Create an iterator object that can be used to iterate through the contents of the symbol table.
   *
   * @returns Return an iterator object that can be used to iterate through the contents of the symbol table.
   */
  newIterator(): AcDbObjectIterator<TObjectType> {
    return new AcDbObjectIterator(this._recordsByName)
  }
}
