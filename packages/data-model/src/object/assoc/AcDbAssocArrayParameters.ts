import type { AcGeMatrix3d } from '@mlightcad/geometry-engine'

import type { AcDbAssocValueUnitType } from './AcDbAssocAction.js'
import type { AcDbAssocArrayItemLocator } from './AcDbAssocArrayItemLocator.js'

/**
 * One named value parameter as stored on the owning `AcDbAssocAction`
 * (e.g. `Items`, `ItemSpacing`). `code` is the DXF group code AutoCAD uses
 * for the value: 90 = integer, 40 = real.
 */
export interface AcDbAssocArrayValueParamSpec {
  name: string
  value: number
  unitType: AcDbAssocValueUnitType
  code: 40 | 90
}

/**
 * Abstract interface for associative-array parameters
 * (ObjectARX `AcDbAssocArrayParameters`).
 *
 * Not an `AcDbObject`. Values live on the owning action as named value
 * parameters and point action parameters (`Origin`, `BaseNormal`,
 * `basePoint`), which is how AutoCAD persists them; the
 * {@link AcDbAssocArrayActionBody} syncs this object to and from them.
 *
 * Transforms are expressed in the array block's coordinate system: an item
 * transform maps the source block into the array block. Derived classes are
 * sealed by convention and must not be subclassed further (matches AutoCAD).
 */
export abstract class AcDbAssocArrayParameters {
  /** Soft owner action-body id when attached. */
  ownerActionBodyId = ''

  /**
   * Returns the transform for the item at `locator` (source block space →
   * array block space).
   */
  abstract getItemTransform(locator: AcDbAssocArrayItemLocator): AcGeMatrix3d

  /**
   * Enumerates every item locator produced by the current parameters.
   */
  abstract getItemLocators(): AcDbAssocArrayItemLocator[]

  /**
   * Discriminator.
   */
  abstract get parameterType(): 'rectangular' | 'polar' | 'path'

  /**
   * C++ class name AutoCAD writes into the action body
   * (e.g. `AcDbAssocArrayRectangularParameters`).
   */
  abstract get className(): string

  /**
   * Value parameters to store on the owning action, in AutoCAD's order.
   */
  abstract toValueParams(): AcDbAssocArrayValueParamSpec[]

  /**
   * Restores fields from the owning action's value parameters.
   *
   * @param get - Returns the numeric value of a named parameter, if present.
   */
  abstract fromValueParams(get: (name: string) => number | undefined): void
}
