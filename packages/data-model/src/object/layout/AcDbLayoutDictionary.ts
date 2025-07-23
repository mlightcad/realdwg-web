import { AcDbObjectId } from '../../base'
import { AcDbDictionary } from '../AcDbDictionary'
import { AcDbLayout } from './AcDbLayout'

export class AcDbLayoutDictionary extends AcDbDictionary<AcDbLayout> {
  /**
   * Search the dictionary for the record with the specified block table record id. If found
   * one layout associated with the block table record with the specified id, it returns the record.
   * Otherwise, return undefined.
   * @param id Input the id to search
   * @returns If found one layout associated with the block table record with the specified id,
   * it returns the record. Otherwise, return undefined.
   */
  getBtrIdAt(id: AcDbObjectId) {
    for (const [_, layout] of this._recordsByName) {
      if (layout.blockTableRecordId == id) return layout
    }
    return undefined
  }

  /**
   * The maximum tabOrder value of layouts in layout dictionary.
   */
  get maxTabOrder() {
    let maxValue = -1
    this._recordsByName.forEach(layout => {
      if (layout.tabOrder > maxValue) {
        maxValue = layout.tabOrder
      }
    })
    return maxValue
  }
}
