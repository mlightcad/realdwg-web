import { AcDbDxfFiler } from '../base/AcDbDxfFiler.js'
import { AcDbAnnotScaleObjectContextData } from './AcDbAnnotScaleObjectContextData.js'

/**
 * Per-annotation-scale representation for annotative hatches
 * (`AcDbHatchScaleContextData`).
 */
export class AcDbHatchScaleContextData extends AcDbAnnotScaleObjectContextData {
  private _patternScale = 1

  get patternScale() {
    return this._patternScale
  }
  set patternScale(value: number) {
    this._patternScale = value
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbHatchScaleContextData')
    filer.writeDouble(40, this._patternScale)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)

    let section: 'object' | 'annot' | 'hatch' = 'object'
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
        if (marker === 'AcDbHatchScaleContextData') {
          section = 'hatch'
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
        continue
      }

      if (section === 'hatch' && code === 40) {
        this._patternScale = Number(item.value)
      }
    }
    return this
  }
}
