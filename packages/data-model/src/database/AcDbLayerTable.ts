import { AcCmColor } from '@mlightcad/common'

import { DEFAULT_LINE_TYPE } from '../misc'
import { AcDbDatabase } from './AcDbDatabase'
import { AcDbLayerTableRecord } from './AcDbLayerTableRecord'
import { AcDbSymbolTable } from './AcDbSymbolTable'

/**
 * This class is the symbol table for layers.
 */
export class AcDbLayerTable extends AcDbSymbolTable<AcDbLayerTableRecord> {
  constructor(db: AcDbDatabase) {
    super(db)
    // The empty database should have one layer named '0'
    const defaultColor = new AcCmColor()
    defaultColor.color = 0xffffff
    const layer0 = new AcDbLayerTableRecord({
      name: '0',
      standardFlags: 0,
      linetype: DEFAULT_LINE_TYPE,
      lineWeight: 1,
      isOff: false,
      color: defaultColor,
      isPlottable: true
    })
    this.add(layer0)
  }

  /**
   * @inheritdoc
   */
  add(record: AcDbLayerTableRecord) {
    super.add(record)
    this.database.events.layerAppended.dispatch({
      database: this.database,
      layer: record
    })
  }
}
