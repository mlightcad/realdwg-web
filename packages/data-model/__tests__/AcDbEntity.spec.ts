import { AcGePoint3d } from '@mlightcad/geometry-engine'

import { AcDb2dPolyline, AcDbPoly2dType } from '../src/entity/AcDb2dPolyline'
import { AcDb2dVertex } from '../src/entity/AcDb2dVertex'
import { AcDb3PointAngularDimension } from '../src/entity/dimension/AcDb3PointAngularDimension'
import { AcDb3dPolyline, AcDbPoly3dType } from '../src/entity/AcDb3dPolyline'
import { AcDb3dVertex } from '../src/entity/AcDb3dVertex'
import { AcDbBlockReference } from '../src/entity/AcDbBlockReference'
import { AcDbFace } from '../src/entity/AcDbFace'
import { AcDbPolyline } from '../src/entity/AcDbPolyline'
import { AcDbRasterImage } from '../src/entity/AcDbRasterImage'
import { AcDbTable } from '../src/entity/AcDbTable'
import { AcDbText } from '../src/entity/AcDbText'

describe('AcDbEntity.dxfTypeName', () => {
  it('uses explicit DXF type names defined by each entity', () => {
    expect(new AcDbText().dxfTypeName).toBe('TEXT')
    expect(new AcDbBlockReference('TEST').dxfTypeName).toBe('INSERT')
    expect(new AcDbPolyline().dxfTypeName).toBe('LWPOLYLINE')
    expect(new AcDb2dPolyline(AcDbPoly2dType.SimplePoly, []).dxfTypeName).toBe(
      'POLYLINE'
    )
    expect(new AcDb3dPolyline(AcDbPoly3dType.SimplePoly, []).dxfTypeName).toBe(
      'POLYLINE'
    )
    expect(new AcDb2dVertex().dxfTypeName).toBe('VERTEX')
    expect(new AcDb3dVertex().dxfTypeName).toBe('VERTEX')
    expect(new AcDbFace().dxfTypeName).toBe('3DFACE')
    expect(new AcDbRasterImage().dxfTypeName).toBe('IMAGE')
    expect(new AcDbTable('TEST', 1, 1).dxfTypeName).toBe('ACAD_TABLE')
    expect(
      new AcDb3PointAngularDimension(
        new AcGePoint3d(),
        new AcGePoint3d(1, 0, 0),
        new AcGePoint3d(0, 1, 0),
        new AcGePoint3d(1, 1, 0)
      ).dxfTypeName
    ).toBe('DIMENSION')
  })
})
