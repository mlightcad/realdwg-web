import type { AcDbObject } from '../base/AcDbObject.js'
import { AcDbBlkRefObjectContextData } from '../object/AcDbBlkRefObjectContextData.js'
import { AcDbDictionary } from '../object/AcDbDictionary.js'
import { AcDbDictionaryVar } from '../object/AcDbDictionaryVar.js'
import { AcDbGroup } from '../object/AcDbGroup.js'
import { AcDbHatchScaleContextData } from '../object/AcDbHatchScaleContextData.js'
import { AcDbLayerFilter } from '../object/AcDbLayerFilter.js'
import { AcDbLayerIndex } from '../object/AcDbLayerIndex.js'
import { AcDbLeaderObjectContextData } from '../object/AcDbLeaderObjectContextData.js'
import { AcDbMLeaderObjectContextData } from '../object/AcDbMLeaderObjectContextData.js'
import { AcDbMLeaderStyle } from '../object/AcDbMLeaderStyle.js'
import { AcDbMlineStyle } from '../object/AcDbMlineStyle.js'
import { AcDbMTextAttributeObjectContextData } from '../object/AcDbMTextAttributeObjectContextData.js'
import { AcDbMTextObjectContextData } from '../object/AcDbMTextObjectContextData.js'
import { AcDbObjectContextData } from '../object/AcDbObjectContextData.js'
import { AcDbRasterImageDef } from '../object/AcDbRasterImageDef.js'
import { AcDbScale } from '../object/AcDbScale.js'
import { AcDbSortentsTable } from '../object/AcDbSortentsTable.js'
import { AcDbTextObjectContextData } from '../object/AcDbTextObjectContextData.js'
import { AcDbUnknownObject } from '../object/AcDbUnknownObject.js'
import { AcDbXrecord } from '../object/AcDbXrecord.js'
import { AcDbLayout } from '../object/layout/AcDbLayout.js'

/**
 * Returns the DXF record name (group 0) used to write `object` into the
 * OBJECTS section, or `undefined` when the object cannot be written.
 *
 * Context data created in-app (no tags preserved from a DXF) is only written
 * when the drawing declares its class in CLASSES; AutoCAD rejects records of
 * undeclared custom classes.
 *
 * @param classNames - Upper-case DXF record names declared in CLASSES.
 */
export function acdbDxfObjectRecordName(
  object: AcDbObject,
  classNames: ReadonlySet<string>
): string | undefined {
  if (object instanceof AcDbUnknownObject) return object.dxfTypeName
  if (object instanceof AcDbDictionary) return object.dxfTypeName
  if (object instanceof AcDbLayout) return 'LAYOUT'
  if (object instanceof AcDbGroup) return 'GROUP'
  if (object instanceof AcDbXrecord) return 'XRECORD'
  if (object instanceof AcDbSortentsTable) return 'SORTENTSTABLE'
  if (object instanceof AcDbRasterImageDef) return 'IMAGEDEF'
  if (object instanceof AcDbLayerFilter) return 'LAYER_FILTER'
  if (object instanceof AcDbLayerIndex) return 'LAYER_INDEX'
  if (object instanceof AcDbMLeaderStyle) return 'MLEADERSTYLE'
  if (object instanceof AcDbMlineStyle) return 'MLINESTYLE'
  if (object instanceof AcDbScale) return 'SCALE'
  if (object instanceof AcDbDictionaryVar) return 'DICTIONARYVAR'
  if (object instanceof AcDbObjectContextData) {
    const name = object.dxfRecordName ?? defaultContextDataRecordName(object)
    if (!name) return undefined
    if (object.hasDxfRawTags || classNames.has(name.toUpperCase())) {
      return name
    }
    return undefined
  }
  return undefined
}

function defaultContextDataRecordName(
  object: AcDbObjectContextData
): string | undefined {
  // Subclasses before their bases.
  if (object instanceof AcDbMTextAttributeObjectContextData) {
    return 'ACDB_MTEXTATTRIBUTEOBJECTCONTEXTDATA_CLASS'
  }
  if (object instanceof AcDbMTextObjectContextData) {
    return 'ACDB_MTEXTOBJECTCONTEXTDATA_CLASS'
  }
  if (object instanceof AcDbTextObjectContextData) {
    return 'ACDB_TEXTOBJECTCONTEXTDATA_CLASS'
  }
  if (object instanceof AcDbHatchScaleContextData) {
    return 'ACDB_HATCHSCALECONTEXTDATA_CLASS'
  }
  if (object instanceof AcDbBlkRefObjectContextData) {
    return 'ACDB_BLKREFOBJECTCONTEXTDATA_CLASS'
  }
  if (object instanceof AcDbMLeaderObjectContextData) {
    return 'ACDB_MLEADEROBJECTCONTEXTDATA_CLASS'
  }
  if (object instanceof AcDbLeaderObjectContextData) {
    return 'ACDB_LEADEROBJECTCONTEXTDATA_CLASS'
  }
  // Dimension context data maps to one of several record names; without the
  // name it was read as, the subtype is unknown.
  return undefined
}
