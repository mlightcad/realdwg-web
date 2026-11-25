import type { AcGeMatrix3d, AcGePoint3dLike } from '@mlightcad/geometry-engine'

import type { AcDbObjectId } from '../../base/AcDbObject.js'
import type { AcDbDatabase } from '../../database/AcDbDatabase.js'
import type { AcDbEntity } from '../../entity/AcDbEntity.js'
import {
  AcDbAssocArrayActionBody,
  type AcDbAssocArrayCreateResult
} from './AcDbAssocArrayActionBody.js'
import type { AcDbAssocArrayItemLocator } from './AcDbAssocArrayItemLocator.js'
import type { AcDbAssocArrayParameters } from './AcDbAssocArrayParameters.js'

/**
 * Convenience wrapper around an {@link AcDbAssocArrayActionBody}
 * (AutoCAD .NET `AssocArray`).
 */
export class AcDbAssocArray {
  private constructor(private readonly _body: AcDbAssocArrayActionBody) {}

  get actionBody(): AcDbAssocArrayActionBody {
    return this._body
  }

  get arrayEntityId(): AcDbObjectId {
    return this._body.arrayEntityId
  }

  getParameters(): AcDbAssocArrayParameters | undefined {
    return this._body.parameters
  }

  getItemTransform(locator: AcDbAssocArrayItemLocator): AcGeMatrix3d {
    return this._body.getTransform(locator)
  }

  static createArray(
    sourceEntities: readonly AcDbObjectId[],
    basePoint: AcGePoint3dLike,
    parameters: AcDbAssocArrayParameters,
    db: AcDbDatabase
  ): AcDbAssocArray {
    const result: AcDbAssocArrayCreateResult =
      AcDbAssocArrayActionBody.createInstance(
        sourceEntities,
        basePoint,
        parameters,
        db
      )
    const body = db.getObjectById(result.actionBodyId)
    if (!(body instanceof AcDbAssocArrayActionBody)) {
      throw new Error('AcDbAssocArray.createArray: action body missing')
    }
    return new AcDbAssocArray(body)
  }

  static getAssociativeArray(
    entity: AcDbEntity,
    db?: AcDbDatabase
  ): AcDbAssocArray | undefined {
    const body = AcDbAssocArrayActionBody.getAssociativeArray(entity, db)
    return body ? new AcDbAssocArray(body) : undefined
  }

  static isAssociativeArray(entity: AcDbEntity, db?: AcDbDatabase): boolean {
    return AcDbAssocArrayActionBody.isAssociativeArray(entity, db)
  }
}
