import { AcDbDxfFiler } from '../base/AcDbDxfFiler'
import { AcDbObject } from '../base/AcDbObject'

/**
 * Abstract base class for filter objects used with the AutoCAD index/filter
 * scheme.
 *
 * An {@link AcDbFilter} defines a query used when iterating block data through
 * filtered block iterators. The corresponding index class is obtained through
 * {@link AcDbFilter.indexClass}.
 *
 * @remarks
 * Mirrors the ObjectARX `AcDbFilter` class. Applications that provide a custom
 * indexing scheme typically also implement matching
 * {@link AcDbIndex} and filtered-block-iterator types.
 *
 * @see https://help.autodesk.com/view/OARX/2024/ENU/?guid=OARX-RefGuide-AcDbFilter
 *
 * @example
 * ```typescript
 * class MyFilter extends AcDbFilter {
 *   indexClass(): string {
 *     return 'MyIndex';
 *   }
 * }
 * ```
 */
export abstract class AcDbFilter extends AcDbObject {
  /**
   * Creates a new {@link AcDbFilter} instance.
   */
  constructor() {
    super()
  }

  /**
   * Returns the class name of the {@link AcDbIndex}-derived type required to
   * process this filter.
   *
   * @remarks
   * In ObjectARX this method returns an `AcRxClass*`. This TypeScript port
   * returns the class name string instead.
   *
   * @returns The index class name associated with this filter.
   */
  abstract indexClass(): string

  /**
   * Writes DXF fields for this filter object.
   *
   * @param filer - DXF output writer.
   * @returns The instance (for chaining).
   */
  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbFilter')
    return this
  }
}
