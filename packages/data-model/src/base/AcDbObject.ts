import {
  AcCmAttributes,
  AcCmObject,
  AcCmStringKey,
  defaults
} from '@mlightcad/common'
import { uid } from 'uid'

import { AcDbDatabase } from '../database/AcDbDatabase'
import { acdbHostApplicationServices } from './AcDbHostApplicationServices'

/** Type alias for object ID as string */
export type AcDbObjectId = string

/**
 * Interface defining the attributes that can be associated with an AcDbObject.
 *
 * Extends the base AcCmAttributes interface and adds object-specific attributes
 * like objectId and ownerId.
 */
export interface AcDbObjectAttrs extends AcCmAttributes {
  /** Unique identifier for the object */
  objectId?: AcDbObjectId
  /** Identifier of the object that owns this object */
  ownerId?: AcDbObjectId
}

/**
 * The base class for all objects that reside in a drawing database.
 *
 * This class provides the fundamental functionality for all database objects,
 * including attribute management, object identification, and database association.
 * It serves as the foundation for entities, tables, and other database objects.
 *
 * @template ATTRS - The type of attributes this object can have
 *
 * @example
 * ```typescript
 * class MyEntity extends AcDbObject<MyEntityAttrs> {
 *   constructor(attrs?: Partial<MyEntityAttrs>) {
 *     super(attrs);
 *   }
 * }
 * ```
 */
export class AcDbObject<ATTRS extends AcDbObjectAttrs = AcDbObjectAttrs> {
  /** Reference to the database this object belongs to */
  private _database?: AcDbDatabase
  /** The attributes object that stores all object properties */
  private _attrs: AcCmObject<ATTRS>

  /**
   * Creates a new AcDbObject instance.
   *
   * @param attrs - Input attribute values for this object
   * @param defaultAttrs - Default values for attributes of this object
   *
   * @example
   * ```typescript
   * const obj = new AcDbObject({ objectId: '123' });
   * ```
   */
  constructor(attrs?: Partial<ATTRS>, defaultAttrs?: Partial<ATTRS>) {
    attrs = attrs || {}
    defaults(attrs, { objectId: uid() })
    this._attrs = new AcCmObject<ATTRS>(attrs, defaultAttrs)
  }

  /**
   * Gets the attributes object for this AcDbObject.
   *
   * @returns The AcCmObject instance containing all attributes
   *
   * @example
   * ```typescript
   * const attrs = obj.attrs;
   * const value = attrs.get('someAttribute');
   * ```
   */
  get attrs() {
    return this._attrs
  }

  /**
   * Gets the value of the specified attribute.
   *
   * This method will throw an exception if the specified attribute doesn't exist.
   * Use getAttrWithoutException() if you want to handle missing attributes gracefully.
   *
   * @param attrName - The name of the attribute to retrieve
   * @returns The value of the specified attribute
   * @throws {Error} When the specified attribute doesn't exist
   *
   * @example
   * ```typescript
   * try {
   *   const value = obj.getAttr('objectId');
   * } catch (error) {
   *   console.error('Attribute not found');
   * }
   * ```
   */
  getAttr(attrName: AcCmStringKey<ATTRS>) {
    const value = this._attrs.get(attrName)
    if (value === undefined) {
      throw new Error(
        `[AcDbObject] Attribute name '${attrName}' does't exist in this object!`
      )
    }
    return value
  }

  /**
   * Gets the value of the specified attribute without throwing an exception.
   *
   * This method returns undefined if the specified attribute doesn't exist,
   * making it safer for optional attributes.
   *
   * @param attrName - The name of the attribute to retrieve
   * @returns The value of the specified attribute, or undefined if it doesn't exist
   *
   * @example
   * ```typescript
   * const value = obj.getAttrWithoutException('optionalAttribute');
   * if (value !== undefined) {
   *   // Use the value
   * }
   * ```
   */
  getAttrWithoutException(attrName: AcCmStringKey<ATTRS>) {
    return this._attrs.get(attrName)
  }

  /**
   * Sets the value of an attribute.
   *
   * @param attrName - The name of the attribute to set
   * @param val - The value to assign to the attribute
   *
   * @example
   * ```typescript
   * obj.setAttr('objectId', 'new-id-123');
   * ```
   */
  setAttr<A extends AcCmStringKey<ATTRS>>(attrName: A, val?: ATTRS[A]) {
    this._attrs.set(attrName, val)
  }

  /**
   * Gets the object ID.
   *
   * AutoCAD uses 64-bit integers to represent handles, which exceed the maximum
   * integer value of JavaScript. Therefore, strings are used to represent object handles.
   *
   * @returns The object ID as a string
   *
   * @example
   * ```typescript
   * const id = obj.objectId;
   * console.log(`Object ID: ${id}`);
   * ```
   */
  get objectId(): AcDbObjectId {
    return this.getAttr('objectId')
  }

  /**
   * Sets the object ID.
   *
   * @param value - The new object ID
   *
   * @example
   * ```typescript
   * obj.objectId = 'new-object-id';
   * ```
   */
  set objectId(value: AcDbObjectId) {
    this._attrs.set('objectId', value)
  }

  /**
   * Gets the object ID of the owner of this object.
   *
   * @returns The owner object ID
   *
   * @example
   * ```typescript
   * const ownerId = obj.ownerId;
   * ```
   */
  get ownerId(): AcDbObjectId {
    return this.getAttr('ownerId')
  }

  /**
   * Sets the object ID of the owner of this object.
   *
   * @param value - The new owner object ID
   *
   * @example
   * ```typescript
   * obj.ownerId = 'parent-object-id';
   * ```
   */
  set ownerId(value: AcDbObjectId) {
    this._attrs.set('ownerId', value)
  }

  /**
   * Gets the database in which this object is resident.
   *
   * When an object isn't added to a database, this property returns the current
   * working database. After it is added to a database, it will be set automatically.
   * You should never set this value manually.
   *
   * @returns The database this object belongs to
   *
   * @example
   * ```typescript
   * const db = obj.database;
   * ```
   */
  get database(): AcDbDatabase {
    return this._database
      ? this._database
      : acdbHostApplicationServices().workingDatabase
  }

  /**
   * Sets the database for this object.
   *
   * This is typically set automatically when the object is added to a database.
   * Manual setting should be avoided unless you know what you're doing.
   *
   * @param db - The database to associate with this object
   *
   * @example
   * ```typescript
   * obj.database = myDatabase;
   * ```
   */
  set database(db: AcDbDatabase) {
    this._database = db
  }

  /**
   * Closes the object.
   *
   * All changes made to the object since it was opened are committed to the database,
   * and a "closed" notification is sent. This method can be overridden by subclasses
   * to provide specific cleanup behavior.
   *
   * @example
   * ```typescript
   * obj.close();
   * ```
   */
  close() {}
}
