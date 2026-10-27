import { AcDbDxfFiler } from '../base/AcDbDxfFiler.js'

import { AcDbAnnotScaleObjectContextData } from './AcDbAnnotScaleObjectContextData.js'

/**
 * Per-annotation-scale representation for annotative leaders / multileaders
 * (`AcDbLeaderObjectContextData`).
 */
export class AcDbLeaderObjectContextData extends AcDbAnnotScaleObjectContextData {
  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbLeaderObjectContextData')
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)

    let section: 'object' | 'annot' | 'leader' = 'object'
    filer.atSubclassData('AcDbObjectContextData')

    while (!filer.atEndOfObject && !filer.atEof && !filer.atExtendedData) {
      const item = filer.readItem()
      if (!item) break
      const code = Number(item.code)
      if (code === 100) {
        const marker = String(item.value)
        if (marker === 'AcDbAnnotScaleObjectContextData') {
          section = 'annot'
          continue
        }
        if (marker === 'AcDbLeaderObjectContextData') {
          section = 'leader'
          continue
        }
        filer.pushBackItem(item)
        break
      }

      if (section === 'object') {
        switch (code) {
          case 70:
            this.classVersion = Number(item.value)
            break
          case 290:
            this.isDefault = Boolean(Number(item.value))
            break
          default:
            break
        }
        continue
      }

      if (section === 'annot' && code === 340) {
        this.scaleId = String(item.value)
      }
    }
    return this
  }
}
