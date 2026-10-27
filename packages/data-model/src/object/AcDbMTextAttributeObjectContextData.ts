import { AcDbDxfFiler } from '../base/AcDbDxfFiler.js'
import { AcDbMTextObjectContextData } from './AcDbMTextObjectContextData.js'

/**
 * Per-annotation-scale representation for annotative MTEXT attributes
 * (`AcDbMTextAttributeObjectContextData`).
 *
 * Field layout matches MTEXT context data; used for attribute definitions /
 * references that use multiline text content.
 */
export class AcDbMTextAttributeObjectContextData extends AcDbMTextObjectContextData {
  override dxfOutFields(filer: AcDbDxfFiler) {
    // Emit the same fields as MTEXT, then the attribute-specific marker is
    // not required by AutoCAD readers that only look at AnnotScale + MTEXT.
    super.dxfOutFields(filer)
    return this
  }

  override dxfInFields(filer: AcDbDxfFiler): this {
    // Parent already understands AcDbMTextObjectContextData; also accept the
    // attribute marker as an alias of the mtext section.
    return super.dxfInFields(filer)
  }
}
