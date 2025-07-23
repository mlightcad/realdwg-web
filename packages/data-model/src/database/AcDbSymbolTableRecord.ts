import { defaults } from 'lodash-es'

import { AcDbObject, AcDbObjectAttrs } from '../base/AcDbObject'

export interface AcDbSymbolTableRecordAttrs extends AcDbObjectAttrs {
  name: string
}

/**
 * This is the base class for each type of record corresponding to the various symbol tables.
 */
export class AcDbSymbolTableRecord<
  ATTRS extends AcDbSymbolTableRecordAttrs = AcDbSymbolTableRecordAttrs
> extends AcDbObject<ATTRS> {
  constructor(attrs?: Partial<ATTRS>, defaultAttrs?: Partial<ATTRS>) {
    attrs = attrs || {}
    defaults(attrs, { name: '' })
    super(attrs, defaultAttrs)
  }

  /**
   * The name of symbol table record used for DXF group code 2.
   */
  get name(): string {
    return this.getAttr('name')
  }
  set name(value: string) {
    this.setAttr('name', value)
  }
}
