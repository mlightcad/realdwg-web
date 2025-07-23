import { AcCmAttributes, AcCmObject, AcCmStringKey } from '@mlightcad/common'
import { defaults } from 'lodash-es'
import { uid } from 'uid'

import { AcDbDatabase } from '../database/AcDbDatabase'
import { acdbHostApplicationServices } from './AcDbHostApplicationServices'

export type AcDbObjectId = string

export interface AcDbObjectAttrs extends AcCmAttributes {
  objectId?: AcDbObjectId
  ownerId?: AcDbObjectId
}

/**
 * The base class for all objects that reside in drawing database.
 */
export class AcDbObject<ATTRS extends AcDbObjectAttrs = AcDbObjectAttrs> {
  private _database?: AcDbDatabase
  private _attrs: AcCmObject<ATTRS>

  /**
   * Default constructor.
   * @param attrs Input attribute values of this object
   * @param defaultAttrs Input default values of attributes of this object.
   */
  constructor(attrs?: Partial<ATTRS>, defaultAttrs?: Partial<ATTRS>) {
    attrs = attrs || {}
    defaults(attrs, { objectId: uid() })
    this._attrs = new AcCmObject<ATTRS>(attrs, defaultAttrs)
  }

  /**
   * Attributes of this object
   */
  get attrs() {
    return this._attrs
  }

  /**
   * Get value of the specified attribute. One exception will be thrown if the specified attribute doesn't exist.
   * @param attrName Input attribute name
   * @returns Return value of the specified attribute
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
   * Get value of the specified attribute. Return undefined if the specified attribute doesn't exist.
   * @param attrName Input attribute name
   * @returns Return value of the specified attribute. Return undefined if the specified attribute
   * doesn't exist.
   */
  getAttrWithoutException(attrName: AcCmStringKey<ATTRS>) {
    return this._attrs.get(attrName)
  }

  /**
   * Set value of the attribute
   * @param attrName Input attribute name
   * @param val Input value of the attribute
   */
  setAttr<A extends AcCmStringKey<ATTRS>>(attrName: A, val?: ATTRS[A]) {
    this._attrs.set(attrName, val)
  }

  /**
   * Object id.
   *
   * AutoCAD uses 64-bit integer to represent handle. It exceeds the maximum integer value
   * (Number.MAX_SAFE_INTEGER, 0x1F FFFF FFFF FFF) of JavaScript number. So string is used to represent
   * the handle of one object.
   */
  get objectId(): AcDbObjectId {
    return this.getAttr('objectId')
  }
  set objectId(value: AcDbObjectId) {
    this._attrs.set('objectId', value)
  }

  /**
   * The object Id of the owner of the object.
   */
  get ownerId(): AcDbObjectId {
    return this.getAttr('ownerId')
  }
  set ownerId(value: AcDbObjectId) {
    this._attrs.set('ownerId', value)
  }

  /**
   * The database in which the object is resident. When one object isn't added into database, the database
   * property of this object will be current working database. After it is added into database, it will be
   * set automatically. So it means you should never set its value by your own.
   */
  get database(): AcDbDatabase {
    return this._database
      ? this._database
      : acdbHostApplicationServices().workingDatabase
  }
  set database(db: AcDbDatabase) {
    this._database = db
  }

  /**
   * Closes the object. All changes made to the object since it was opened are committed to the database,
   * and a "closed" notification is sent.
   */
  close() {}
}
