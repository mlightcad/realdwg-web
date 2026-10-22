import type { AcDbDxfFiler } from '../base/AcDbDxfFiler.js'
import { AcDb3dSolid } from '../entity/AcDb3dSolid.js'
import { AcDbArc } from '../entity/AcDbArc.js'
import { AcDbArcAlignedText } from '../entity/AcDbArcAlignedText.js'
import { AcDbAttribute } from '../entity/AcDbAttribute.js'
import { AcDbAttributeDefinition } from '../entity/AcDbAttributeDefinition.js'
import { AcDbBlockReference } from '../entity/AcDbBlockReference.js'
import { AcDbCircle } from '../entity/AcDbCircle.js'
import { AcDbEllipse } from '../entity/AcDbEllipse.js'
import type { AcDbEntity } from '../entity/AcDbEntity.js'
import { AcDbFace } from '../entity/AcDbFace.js'
import { AcDbFcf } from '../entity/AcDbFcf.js'
import { AcDbHatch } from '../entity/AcDbHatch.js'
import { AcDbLeader } from '../entity/AcDbLeader.js'
import { AcDbLine } from '../entity/AcDbLine.js'
import { AcDbMLeader } from '../entity/AcDbMLeader.js'
import { AcDbMLine } from '../entity/AcDbMLine.js'
import { AcDbMText } from '../entity/AcDbMText.js'
import { AcDbOle2Frame } from '../entity/AcDbOle2Frame.js'
import { AcDbOleFrame } from '../entity/AcDbOleFrame.js'
import { AcDbPoint } from '../entity/AcDbPoint.js'
import { AcDbPolyline } from '../entity/AcDbPolyline.js'
import { AcDbProxyEntity } from '../entity/AcDbProxyEntity.js'
import { AcDbRasterImage } from '../entity/AcDbRasterImage.js'
import { AcDbRay } from '../entity/AcDbRay.js'
import { AcDbShape } from '../entity/AcDbShape.js'
import { AcDbSolid } from '../entity/AcDbSolid.js'
import { AcDbSpline } from '../entity/AcDbSpline.js'
import { AcDbTable } from '../entity/AcDbTable.js'
import { AcDbText } from '../entity/AcDbText.js'
import { AcDbTrace } from '../entity/AcDbTrace.js'
import { AcDbViewport } from '../entity/AcDbViewport.js'
import { AcDbWipeout } from '../entity/AcDbWipeout.js'
import { AcDbXline } from '../entity/AcDbXline.js'
import { acdbDxfInDimension } from './AcDbDxfDimensionAssembler.js'
import { acdbDxfInPolyline } from './AcDbDxfPolylineAssembler.js'

/**
 * Creates an empty entity instance for the given DXF type name, ready for dxfIn.
 * Returns null for unsupported types (caller should skip to next code 0).
 */
export function acdbCreateEntityForDxfIn(typeName: string): AcDbEntity | null {
  const type = typeName.toUpperCase()
  switch (type) {
    case 'LINE':
      return new AcDbLine()
    case 'CIRCLE':
      return new AcDbCircle()
    case 'ARC':
      return new AcDbArc()
    case 'POINT':
      return new AcDbPoint()
    case 'RAY':
      return new AcDbRay()
    case 'XLINE':
      return new AcDbXline()
    case 'ELLIPSE':
      return new AcDbEllipse()
    case 'SOLID':
      // Converter maps SOLID → AcDbSolid (subclass of AcDbTrace).
      return new AcDbSolid()
    case 'TRACE':
      return new AcDbTrace()
    case '3DFACE':
      return new AcDbFace()
    case 'LWPOLYLINE':
      return new AcDbPolyline()
    case 'INSERT':
      return new AcDbBlockReference('')
    case 'TEXT':
      return new AcDbText()
    case 'ARCALIGNEDTEXT':
      return new AcDbArcAlignedText()
    case 'MTEXT':
      return new AcDbMText()
    case 'SPLINE':
      return new AcDbSpline()
    case 'ATTDEF':
      return new AcDbAttributeDefinition()
    case 'ATTRIB':
      return new AcDbAttribute()
    case 'SHAPE':
      return new AcDbShape()
    case 'TOLERANCE':
      return new AcDbFcf()
    case 'LEADER':
      return new AcDbLeader()
    case 'VIEWPORT':
      return new AcDbViewport()
    case 'IMAGE':
      return new AcDbRasterImage()
    case 'WIPEOUT':
      return new AcDbWipeout()
    case 'ACAD_PROXY_ENTITY':
      return new AcDbProxyEntity()
    case 'OLEFRAME':
      return new AcDbOleFrame()
    case 'OLE2FRAME':
      return new AcDbOle2Frame()
    case 'HATCH':
      return new AcDbHatch()
    case 'MLINE':
      return new AcDbMLine()
    case 'MULTILEADER':
    case 'MLEADER':
      return new AcDbMLeader()
    case 'ACAD_TABLE':
      return new AcDbTable('', 1, 1)
    case '3DSOLID':
      return new AcDb3dSolid('')
    default:
      return null
  }
}

/**
 * Create entity from the current filer position.
 * Expects the filer to be at (or just past) the type name pair (0, TYPENAME).
 * When `typeName` is omitted, reads the next (0, name) pair.
 */
export function acdbDxfInEntity(
  filer: AcDbDxfFiler,
  typeName?: string
): AcDbEntity | null {
  let name = typeName
  if (name == null) {
    const item = filer.readItem()
    if (!item || Number(item.code) !== 0) {
      if (item) filer.pushBackItem(item)
      return null
    }
    name = String(item.value)
  }

  const upper = name.toUpperCase()
  // Composite / subclass-dispatched types — not created via empty factory.
  if (upper === 'POLYLINE') {
    return acdbDxfInPolyline(filer)
  }
  if (upper === 'DIMENSION') {
    return acdbDxfInDimension(filer)
  }

  const entity = acdbCreateEntityForDxfIn(name)
  if (!entity) return null
  entity.dxfIn(filer)
  return entity
}
