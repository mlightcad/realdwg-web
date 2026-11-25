import { AcGeMatrix3d } from '@mlightcad/geometry-engine'

import type { AcDbObjectId } from '../../base/AcDbObject.js'
import { AcDbAssocArrayItemLocator } from './AcDbAssocArrayItemLocator.js'

/** Item flag: the transform is stored (always set by AutoCAD). */
export const ACDB_ASSOC_ARRAY_ITEM_HAS_TRANSFORM = 8
/** Item flag: the transform is a full matrix rather than a translation. */
export const ACDB_ASSOC_ARRAY_ITEM_FULL_MATRIX = 4

/**
 * Transform and metadata of one item of an associative array
 * (ObjectARX `AcDbAssocArrayItem`). Owned by the
 * {@link AcDbAssocArrayActionBody} and persisted with it.
 *
 * DXF layout (inside the body record): `100 AcDbAssocArrayItem, 90 0,
 * 90 itemIndex, 90 rowIndex, 90 levelIndex, 90 flags,
 * (40×16 row-major matrix | 11/21/31 translation), 330 item entity`.
 */
export class AcDbAssocArrayItem {
  classVersion = 0
  /** Raw flag bits; transform-shape bits are recomputed on write. */
  flags = ACDB_ASSOC_ARRAY_ITEM_HAS_TRANSFORM
  /** Item transform: source block space → array block space. */
  transform = new AcGeMatrix3d()
  /** The item INSERT inside the array block. */
  entityId: AcDbObjectId = ''

  constructor(
    public locator = new AcDbAssocArrayItemLocator(),
    transform?: AcGeMatrix3d,
    entityId: AcDbObjectId = ''
  ) {
    if (transform) this.transform.copy(transform)
    this.entityId = entityId
  }

  /** True when the transform is a pure translation. */
  get isTranslationOnly(): boolean {
    const e = this.transform.elements
    const eps = 1e-12
    return (
      Math.abs(e[0] - 1) < eps &&
      Math.abs(e[1]) < eps &&
      Math.abs(e[2]) < eps &&
      Math.abs(e[3]) < eps &&
      Math.abs(e[4]) < eps &&
      Math.abs(e[5] - 1) < eps &&
      Math.abs(e[6]) < eps &&
      Math.abs(e[7]) < eps &&
      Math.abs(e[8]) < eps &&
      Math.abs(e[9]) < eps &&
      Math.abs(e[10] - 1) < eps &&
      Math.abs(e[11]) < eps &&
      Math.abs(e[15] - 1) < eps
    )
  }

  /** Flags to persist, with the transform-shape bits matching the matrix. */
  get persistedFlags(): number {
    const base =
      this.flags &
      ~(ACDB_ASSOC_ARRAY_ITEM_FULL_MATRIX | ACDB_ASSOC_ARRAY_ITEM_HAS_TRANSFORM)
    return (
      base |
      ACDB_ASSOC_ARRAY_ITEM_HAS_TRANSFORM |
      (this.isTranslationOnly ? 0 : ACDB_ASSOC_ARRAY_ITEM_FULL_MATRIX)
    )
  }
}
