import { AcGePoint3d } from '@mlightcad/geometry-engine'

import { AcDbBlockTableRecord } from '../src/database/AcDbBlockTableRecord'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbAlignedDimension } from '../src/entity/dimension/AcDbAlignedDimension'
import { acdbDimFeatureScale } from '../src/entity/dimension/AcDbDimFeatureScale'
import {
  acdbGetAnnotationScaleContexts,
  acdbMatchAnnotationScaleContext
} from '../src/misc/AcDbAnnotationScale'
import { AcDbDictionary } from '../src/object/AcDbDictionary'
import { AcDbDimensionObjectContextData } from '../src/object/AcDbDimensionObjectContextData'
import { AcDbScale } from '../src/object/AcDbScale'

function createDb() {
  const db = new AcDbDatabase()
  db.createDefaultData()
  return db
}

function createScale(db: AcDbDatabase, name: string, factor: number) {
  const scale = new AcDbScale()
  scale.database = db
  scale.scaleName = name
  scale.paperUnits = 1
  scale.drawingUnits = factor
  db.objects.scale.setAt(name, scale)
  return scale
}

function wireAnnotativeContexts(
  db: AcDbDatabase,
  dim: AcDbAlignedDimension,
  entries: Array<{
    scale: AcDbScale
    blockName: string
    defPt: AcGePoint3d
    isDefault?: boolean
  }>
) {
  const extId = db.createExtensionDictionaryFor(dim)!
  const extDict = db.getObjectById(extId) as AcDbDictionary

  const manager = new AcDbDictionary(db)
  manager.database = db
  extDict.setAt('AcDbContextDataManager', manager)

  const scalesDict = new AcDbDictionary(db)
  scalesDict.database = db
  manager.setAt('ACDB_ANNOTATIONSCALES', scalesDict)

  entries.forEach((entry, index) => {
    const ctx = new AcDbDimensionObjectContextData()
    ctx.database = db
    ctx.scaleId = entry.scale.objectId
    ctx.isDefault = !!entry.isDefault
    ctx.blockName = entry.blockName
    ctx.definitionPoint = entry.defPt
    db.objects.objectContextData.setAt(`ctx${index}`, ctx)
    scalesDict.setAt(entry.scale.scaleName, ctx)
  })
}

describe('annotative dimension object-level contexts', () => {
  it('picks per-scale dim block and definition point at CANNOSCALE', () => {
    const db = createDb()
    const scale50 = createScale(db, '1:50', 50)
    const scale100 = createScale(db, '1:100', 100)
    db.cannoscale = '1:100'

    const btr50 = new AcDbBlockTableRecord()
    btr50.name = '*D50'
    db.tables.blockTable.add(btr50)
    const btr100 = new AcDbBlockTableRecord()
    btr100.name = '*D100'
    db.tables.blockTable.add(btr100)

    const dim = new AcDbAlignedDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(100, 0, 0),
      new AcGePoint3d(50, 20, 0)
    )
    dim.dimBlockId = '*D50'
    dim.dimBlockPosition = new AcGePoint3d(10, 10, 0)
    db.tables.blockTable.modelSpace.appendEntity(dim)
    dim.annotative = true

    wireAnnotativeContexts(db, dim, [
      {
        scale: scale50,
        blockName: '*D50',
        defPt: new AcGePoint3d(10, 10, 0),
        isDefault: true
      },
      {
        scale: scale100,
        blockName: '*D100',
        defPt: new AcGePoint3d(20, 30, 0)
      }
    ])

    const contexts = acdbGetAnnotationScaleContexts(dim)
    expect(contexts).toHaveLength(2)
    expect(
      contexts.every(
        c => c.contextData instanceof AcDbDimensionObjectContextData
      )
    ).toBe(true)

    const matched = acdbMatchAnnotationScaleContext(contexts, '1:100')
    expect(matched?.scale.scaleName).toBe('1:100')
    expect(
      (matched?.contextData as AcDbDimensionObjectContextData).blockName
    ).toBe('*D100')

    const presentation = dim.resolveAnnotativePresentation()
    expect(presentation.dimBlockId).toBe('*D100')
    expect(presentation.blockPosition.x).toBeCloseTo(20, 6)
    expect(presentation.blockPosition.y).toBeCloseTo(30, 6)
    expect(presentation.annotationScale).toMatchObject({
      drawnScaleFactor: 100,
      drawnScaleName: '1:100',
      supportedScaleFactors: expect.arrayContaining([50, 100])
    })
    expect(presentation.featureScale).toBe(100)
    expect(acdbDimFeatureScale(dim.dimensionStyle, dim)).toBe(100)

    db.cannoscale = '1:50'
    const at50 = dim.resolveAnnotativePresentation()
    expect(at50.dimBlockId).toBe('*D50')
    expect(at50.featureScale).toBe(50)
  })
})
