import { AcDbRasterImageDef } from '@mlightcad/data-model'
import { DRW_ImageEx } from '@mlightcad/libdxfrw-web'

export class AcDbObjectConverter {
  convertImageDef(imageDef: DRW_ImageEx) {
    const dbObject = new AcDbRasterImageDef()
    dbObject.sourceFileName = imageDef.path
    dbObject.objectId = imageDef.handle.toString()
    if (imageDef.parentHandle != null) {
      dbObject.ownerId = imageDef.parentHandle.toString()
    }
    return dbObject
  }
}
