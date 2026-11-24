import type { AcGeMatrix3d } from '@mlightcad/geometry-engine'

import type { AcDbAssocArrayItemLocator } from './AcDbAssocArrayItemLocator.js'

/**
 * Abstract interface for associative-array parameters
 * (ObjectARX `AcDbAssocArrayParameters`).
 *
 * Not an `AcDbObject` — owned by {@link AcDbAssocArrayActionBody} and
 * serialized with it. Derived classes are sealed by convention and must not
 * be subclassed further (matches AutoCAD).
 */
export abstract class AcDbAssocArrayParameters {
  /** Soft owner action-body id when attached. */
  ownerActionBodyId = ''

  /**
   * Returns the transform for the item at `locator`, relative to the array
   * base point / source block origin.
   */
  abstract getItemTransform(locator: AcDbAssocArrayItemLocator): AcGeMatrix3d

  /**
   * Enumerates every item locator produced by the current parameters.
   */
  abstract getItemLocators(): AcDbAssocArrayItemLocator[]

  /**
   * Discriminator for DXF / persistence.
   */
  abstract get parameterType():
    | 'rectangular'
    | 'polar'
    | 'path'

  /**
   * Serializes parameter fields into a plain JSON-compatible record.
   */
  abstract toJSON(): Record<string, unknown>

  /**
   * Restores parameter fields from {@link toJSON}.
   */
  abstract fromJSON(data: Record<string, unknown>): void
}
