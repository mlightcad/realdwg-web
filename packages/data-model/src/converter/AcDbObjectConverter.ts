import { ParsedDxf } from '@mlightcad/dxf-json'
import { CommonDXFObject } from '@mlightcad/dxf-json/dist/parser/objects/common'
import { ImageDefDXFObject } from '@mlightcad/dxf-json/dist/parser/objects/imageDef'
import { LayoutDXFObject } from '@mlightcad/dxf-json/dist/parser/objects/layout'

import { AcDbObject } from '../base'
import { AcDbLayout, AcDbRasterImageDef } from '../object'

/**
 * Converts DXF objects to AcDbObject instances.
 *
 * This class provides functionality to convert various DXF object types
 * (such as layouts and image definitions) into their corresponding
 * AcDbObject instances.
 *
 * @example
 * ```typescript
 * const converter = new AcDbObjectConverter();
 * const layout = converter.convertLayout(dxfLayout);
 * const imageDef = converter.convertImageDef(dxfImageDef);
 * ```
 */
export class AcDbObjectConverter {
  /**
   * Converts a DXF layout object to an AcDbLayout.
   *
   * @param layout - The DXF layout object to convert
   * @returns The converted AcDbLayout instance
   *
   * @example
   * ```typescript
   * const dxfLayout = { layoutName: 'Model', tabOrder: 1, ... };
   * const acDbLayout = converter.convertLayout(dxfLayout);
   * ```
   */
  convertLayout(layout: LayoutDXFObject, model: ParsedDxf) {
    const dbObject = new AcDbLayout()
    dbObject.layoutName = layout.layoutName
    dbObject.tabOrder = layout.tabOrder
    // layout.paperSpaceTableId doesn't point to the block table record asscicated with
    // this layout. So let's get the assocated block table record id from block table.
    model.tables.BLOCK_RECORD?.entries.some(btr => {
      if (btr.layoutObjects === layout.handle) {
        dbObject.blockTableRecordId = btr.handle
        return true
      }
      return false
    })
    dbObject.limits.min.copy(layout.minLimit)
    dbObject.limits.max.copy(layout.maxLimit)
    dbObject.extents.min.copy(layout.minExtent)
    dbObject.extents.max.copy(layout.maxExtent)
    this.processCommonAttrs(layout, dbObject)
    return dbObject
  }

  /**
   * Converts a DXF image definition object to an AcDbRasterImageDef.
   *
   * @param image - The DXF image definition object to convert
   * @returns The converted AcDbRasterImageDef instance
   *
   * @example
   * ```typescript
   * const dxfImageDef = { fileName: 'image.jpg', ... };
   * const acDbImageDef = converter.convertImageDef(dxfImageDef);
   * ```
   */
  convertImageDef(image: ImageDefDXFObject) {
    const dbObject = new AcDbRasterImageDef()
    dbObject.sourceFileName = image.fileName
    this.processCommonAttrs(image, dbObject)
    return dbObject
  }

  /**
   * Processes common attributes from a DXF object to an AcDbObject.
   *
   * This method copies common properties like object ID and owner ID
   * from the DXF object to the corresponding AcDbObject.
   *
   * @param object - The source DXF object
   * @param dbObject - The target AcDbObject to populate
   *
   * @example
   * ```typescript
   * converter.processCommonAttrs(dxfObject, acDbObject);
   * ```
   */
  private processCommonAttrs(object: CommonDXFObject, dbObject: AcDbObject) {
    dbObject.objectId = object.handle
    dbObject.ownerId = object.ownerObjectId
  }
}
