import { AcGePoint3d } from '@mlightcad/geometry-engine'

import { acdbHostApplicationServices } from '../src/base/AcDbHostApplicationServices'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbAttribute } from '../src/entity/AcDbAttribute'
import { AcDbBlockReference } from '../src/entity/AcDbBlockReference'
import { AcDbHatch } from '../src/entity/AcDbHatch'
import { AcDbMLeader } from '../src/entity/AcDbMLeader'
import { AcDbMText } from '../src/entity/AcDbMText'
import { acdbGetAnnotationScaleContexts } from '../src/misc/AcDbAnnotationScale'
import { AcDbBlkRefObjectContextData } from '../src/object/AcDbBlkRefObjectContextData'
import { AcDbDictionary } from '../src/object/AcDbDictionary'
import { AcDbHatchScaleContextData } from '../src/object/AcDbHatchScaleContextData'
import { AcDbMLeaderObjectContextData } from '../src/object/AcDbMLeaderObjectContextData'
import { AcDbMTextAttributeObjectContextData } from '../src/object/AcDbMTextAttributeObjectContextData'
import { AcDbScale } from '../src/object/AcDbScale'

function createDb() {
  const db = new AcDbDatabase()
  db.createDefaultData()
  acdbHostApplicationServices().workingDatabase = db
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

function wireContexts(
  db: AcDbDatabase,
  entity: { objectId: string; database?: AcDbDatabase | null },
  makeCtx: (scale: AcDbScale, isDefault: boolean) => {
    objectId?: string
    database: AcDbDatabase | null
    scaleId: string
    isDefault: boolean
  },
  entries: Array<{ scale: AcDbScale; isDefault?: boolean }>
) {
  const extId = db.createExtensionDictionaryFor(entity as never)!
  const extDict = db.getObjectById(extId) as AcDbDictionary

  const manager = new AcDbDictionary(db)
  manager.database = db
  extDict.setAt('AcDbContextDataManager', manager)

  const scalesDict = new AcDbDictionary(db)
  scalesDict.database = db
  manager.setAt('ACDB_ANNOTATIONSCALES', scalesDict)

  entries.forEach((entry, index) => {
    const ctx = makeCtx(entry.scale, !!entry.isDefault)
    ctx.database = db
    ctx.scaleId = entry.scale.objectId
    ctx.isDefault = !!entry.isDefault
    db.objects.objectContextData.setAt(`ctx${index}`, ctx as never)
    scalesDict.setAt(entry.scale.scaleName, ctx as never)
  })
}

describe('Phase 4 annotative presentation', () => {
  it('MLeader picks text/arrow sizes from MLeaderObjectContextData at CANNOSCALE', () => {
    const db = createDb()
    const scale50 = createScale(db, '1:50', 50)
    const scale100 = createScale(db, '1:100', 100)
    db.cannoscale = '1:100'

    const ml = new AcDbMLeader()
    ml.textHeight = 2.5
    ml.arrowheadSize = 2.5
    db.tables.blockTable.modelSpace.appendEntity(ml)
    ml.annotative = true

    wireContexts(
      db,
      ml,
      () => {
        const ctx = new AcDbMLeaderObjectContextData()
        return ctx
      },
      [
        { scale: scale50, isDefault: true },
        { scale: scale100 }
      ]
    )

    // Fill per-scale sizes after contexts exist
    const contexts = acdbGetAnnotationScaleContexts(ml)
    expect(contexts).toHaveLength(2)
    const ctx50 = contexts.find(c => c.scale.scaleName === '1:50')!
      .contextData as AcDbMLeaderObjectContextData
    const ctx100 = contexts.find(c => c.scale.scaleName === '1:100')!
      .contextData as AcDbMLeaderObjectContextData
    ctx50.textHeight = 125
    ctx50.arrowheadSize = 125
    ctx100.textHeight = 250
    ctx100.arrowheadSize = 250
    ctx100.textAnchor = new AcGePoint3d(10, 20, 0)

    const presentation = ml.resolveAnnotativePresentation()
    expect(presentation.textHeight).toBeCloseTo(250, 6)
    expect(presentation.arrowheadSize).toBeCloseTo(250, 6)
    expect(presentation.textAnchor?.x).toBeCloseTo(10, 6)
    expect(presentation.annotationScale).toMatchObject({
      drawnScaleFactor: 100,
      drawnScaleName: '1:100'
    })
  })

  it('Hatch picks patternScale from HatchScaleContextData at CANNOSCALE', () => {
    const db = createDb()
    const scale50 = createScale(db, '1:50', 50)
    const scale100 = createScale(db, '1:100', 100)
    db.cannoscale = '1:100'

    const hatch = new AcDbHatch()
    hatch.patternScale = 1
    db.tables.blockTable.modelSpace.appendEntity(hatch)
    hatch.annotative = true

    wireContexts(
      db,
      hatch,
      (scale) => {
        const ctx = new AcDbHatchScaleContextData()
        ctx.patternScale = scale.scaleFactor
        return ctx
      },
      [
        { scale: scale50, isDefault: true },
        { scale: scale100 }
      ]
    )

    const presentation = hatch.resolveAnnotativePresentation()
    expect(presentation.patternScale).toBeCloseTo(100, 6)
    expect(presentation.annotationScale?.drawnScaleFactor).toBe(100)

    db.cannoscale = '1:50'
    expect(hatch.resolveAnnotativePresentation().patternScale).toBeCloseTo(
      50,
      6
    )
  })

  it('BlockReference picks transform from BlkRefObjectContextData at CANNOSCALE', () => {
    const db = createDb()
    const scale50 = createScale(db, '1:50', 50)
    const scale100 = createScale(db, '1:100', 100)
    db.cannoscale = '1:100'

    const blockRef = new AcDbBlockReference('AnnoBlock')
    blockRef.position = new AcGePoint3d(0, 0, 0)
    blockRef.scaleFactors = new AcGePoint3d(1, 1, 1)
    db.tables.blockTable.modelSpace.appendEntity(blockRef)
    blockRef.annotative = true

    wireContexts(
      db,
      blockRef,
      (scale) => {
        const ctx = new AcDbBlkRefObjectContextData()
        ctx.position = new AcGePoint3d(scale.scaleFactor, 0, 0)
        ctx.rotation = 0
        ctx.scaleX = scale.scaleFactor / 50
        ctx.scaleY = scale.scaleFactor / 50
        ctx.scaleZ = 1
        return ctx
      },
      [
        { scale: scale50, isDefault: true },
        { scale: scale100 }
      ]
    )

    const presentation = blockRef.resolveAnnotativePresentation()
    expect(presentation.position.x).toBeCloseTo(100, 6)
    expect(presentation.scaleFactors.x).toBeCloseTo(2, 6)
    expect(presentation.annotationScale?.drawnScaleFactor).toBe(100)
  })

  it('Attribute MTEXT path resolves height from MTextAttributeObjectContextData', () => {
    const db = createDb()
    const scale50 = createScale(db, '1:50', 50)
    const scale100 = createScale(db, '1:100', 100)
    db.cannoscale = '1:100'

    const attrib = new AcDbAttribute()
    attrib.height = 2.5
    const mt = new AcDbMText()
    mt.contents = 'Hello'
    mt.height = 2.5
    mt.location = new AcGePoint3d(1, 2, 0)
    attrib.mtext = mt
    db.tables.blockTable.modelSpace.appendEntity(attrib)
    attrib.annotative = true

    wireContexts(
      db,
      attrib,
      () => new AcDbMTextAttributeObjectContextData(),
      [
        { scale: scale50, isDefault: true },
        { scale: scale100 }
      ]
    )

    const presentation = attrib.resolveMTextAnnotativePresentation('Hello')
    // Default height 2.5 at 1:50 => paper 0.05; at 1:100 => model 5
    expect(presentation.height).toBeCloseTo(5, 6)
    expect(presentation.annotationScale?.drawnScaleFactor).toBe(100)
  })
})
