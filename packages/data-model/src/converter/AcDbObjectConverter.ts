import { CommonDXFObject } from '@mlightcad/dxf-json/dist/parser/objects/common'
import { ImageDefDXFObject } from '@mlightcad/dxf-json/dist/parser/objects/imageDef'
import { LayoutDXFObject } from '@mlightcad/dxf-json/dist/parser/objects/layout'

import { AcDbObject } from '../base'
import { AcDbLayout, AcDbRasterImageDef } from '../object'

export class AcDbObjectConverter {
  convertLayout(layout: LayoutDXFObject) {
    const dbObject = new AcDbLayout()
    dbObject.layoutName = layout.layoutName
    dbObject.tabOrder = layout.tabOrder
    dbObject.blockTableRecordId = layout.ownerObjectId
    dbObject.limits.min.copy(layout.minLimit)
    dbObject.limits.max.copy(layout.maxLimit)
    dbObject.extents.min.copy(layout.minExtent)
    dbObject.extents.max.copy(layout.maxExtent)
    this.processCommonAttrs(layout, dbObject)
    return dbObject
  }

  convertImageDef(image: ImageDefDXFObject) {
    const dbObject = new AcDbRasterImageDef()
    dbObject.sourceFileName = image.fileName
    this.processCommonAttrs(image, dbObject)
    return dbObject
  }

  private processCommonAttrs(object: CommonDXFObject, dbObject: AcDbObject) {
    dbObject.objectId = object.handle
    dbObject.ownerId = object.ownerObjectId
  }
}
