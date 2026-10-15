import { AcDbDxfFiler } from '../base/AcDbDxfFiler'
import { AcDbObject } from '../base/AcDbObject'

/**
 * Nongraphical `DICTIONARYVAR` object (`AcDbDictionaryVar`).
 *
 * Used for variables such as `CANNOSCALE` stored under
 * `AcDbVariableDictionary` in the named object dictionary.
 */
export class AcDbDictionaryVar extends AcDbObject {
  private _schema = 0
  private _value = ''

  /** Schema / type number (DXF group 280). */
  get schema() {
    return this._schema
  }
  set schema(value: number) {
    this._schema = value
  }

  /** Variable value (DXF group 1), e.g. `"1:100"` for CANNOSCALE. */
  get value() {
    return this._value
  }
  set value(value: string) {
    this._value = value
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('DictionaryVariables')
    filer.writeInt16(280, this._schema)
    filer.writeString(1, this._value)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    // AutoCAD writes `DictionaryVariables`; tolerate either marker.
    if (!filer.atSubclassData('DictionaryVariables')) {
      filer.atSubclassData('AcDbDictionaryVar')
    }

    while (!filer.atEndOfObject && !filer.atEof && !filer.atExtendedData) {
      const item = filer.readItem()
      if (!item) break
      const code = Number(item.code)
      if (code === 100) {
        filer.pushBackItem(item)
        break
      }
      switch (code) {
        case 280:
          this._schema = Number(item.value)
          break
        case 1:
          this._value = String(item.value)
          break
        default:
          break
      }
    }
    return this
  }
}
