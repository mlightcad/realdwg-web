import { AcGePoint3d } from '@mlightcad/geometry-engine'

import { acdbHostApplicationServices } from '../src/base/AcDbHostApplicationServices'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbBlockReference } from '../src/entity/AcDbBlockReference'
import { AcDbHatch } from '../src/entity/AcDbHatch'
import { AcDbMText } from '../src/entity/AcDbMText'
import { AcDbText } from '../src/entity/AcDbText'
import { AcDbAlignedDimension } from '../src/entity/dimension/AcDbAlignedDimension'
import {
  acdbAddAnnotationScaleToObject,
  acdbEnsureDefaultAnnotationScales,
  acdbEnsureNamedScale,
  acdbGetAnnotationScaleContexts,
  acdbListAnnotationScales,
  acdbRemoveAnnotationScaleFromObject
} from '../src/misc/AcDbAnnotationScale'
import { AcDbBlkRefObjectContextData } from '../src/object/AcDbBlkRefObjectContextData'
import { AcDbDimensionObjectContextData } from '../src/object/AcDbDimensionObjectContextData'
import { AcDbHatchScaleContextData } from '../src/object/AcDbHatchScaleContextData'
import { AcDbMTextObjectContextData } from '../src/object/AcDbMTextObjectContextData'
import { AcDbTextObjectContextData } from '../src/object/AcDbTextObjectContextData'

function createDb() {
  const db = new AcDbDatabase()
  db.createDefaultData()
  acdbHostApplicationServices().workingDatabase = db
  return db
}

describe('annotation scale OBJECTSCALE helpers', () => {
  it('lists scales without mutating an empty scale list', () => {
    const db = createDb()
    // Fresh DBs may already have defaults from createDefaultData; clear is not
    // always possible, so assert list is a non-mutating snapshot of entries.
    const before = db.objects.scale.numEntries
    const listed = acdbListAnnotationScales(db)
    expect(listed.length).toBe(before)
    expect(db.objects.scale.numEntries).toBe(before)
  })

  it('seeds default scales only via ensureDefaultAnnotationScales', () => {
    const db = createDb()
    const seeded = acdbEnsureDefaultAnnotationScales(db)
    expect(seeded.length).toBeGreaterThanOrEqual(10)
    expect(acdbEnsureNamedScale(db, '1:100').scaleFactor).toBe(100)
    expect(acdbListAnnotationScales(db).some(s => s.scaleName === '1:50')).toBe(
      true
    )
  })

  it('adds typed MTEXT / TEXT contexts and removes with default promotion', () => {
    const db = createDb()
    const mt = new AcDbMText()
    mt.contents = 'A'
    mt.height = 2.5
    mt.location = new AcGePoint3d(1, 2, 0)
    db.tables.blockTable.modelSpace.appendEntity(mt)

    expect(acdbAddAnnotationScaleToObject(mt, '1:50')).toBe(true)
    expect(acdbAddAnnotationScaleToObject(mt, '1:100')).toBe(true)
    expect(acdbAddAnnotationScaleToObject(mt, '1:100')).toBe(false)

    let contexts = acdbGetAnnotationScaleContexts(mt)
    expect(contexts).toHaveLength(2)
    expect(
      contexts.every(c => c.contextData instanceof AcDbMTextObjectContextData)
    ).toBe(true)
    expect(contexts.find(c => c.scale.scaleName === '1:50')?.isDefault).toBe(
      true
    )
    expect(mt.annotative).toBe(true)

    expect(acdbRemoveAnnotationScaleFromObject(mt, '1:50')).toBe(true)
    contexts = acdbGetAnnotationScaleContexts(mt)
    expect(contexts).toHaveLength(1)
    expect(contexts[0].scale.scaleName).toBe('1:100')
    expect(contexts[0].isDefault).toBe(true)
    expect(mt.annotative).toBe(true)

    expect(acdbRemoveAnnotationScaleFromObject(mt, '1:100')).toBe(true)
    expect(acdbGetAnnotationScaleContexts(mt)).toHaveLength(0)
    expect(mt.annotative).toBe(false)

    const text = new AcDbText()
    text.height = 2.5
    text.position = new AcGePoint3d(0, 0, 0)
    db.tables.blockTable.modelSpace.appendEntity(text)
    expect(acdbAddAnnotationScaleToObject(text, '1:50')).toBe(true)
    expect(
      acdbGetAnnotationScaleContexts(text)[0].contextData instanceof
        AcDbTextObjectContextData
    ).toBe(true)
  })

  it('adds typed hatch / dimension / block-ref contexts', () => {
    const db = createDb()

    const hatch = new AcDbHatch()
    hatch.patternScale = 1
    db.tables.blockTable.modelSpace.appendEntity(hatch)
    expect(acdbAddAnnotationScaleToObject(hatch, '1:50')).toBe(true)
    expect(
      acdbGetAnnotationScaleContexts(hatch)[0].contextData instanceof
        AcDbHatchScaleContextData
    ).toBe(true)

    const dim = new AcDbAlignedDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(10, 0, 0),
      new AcGePoint3d(5, 5, 0)
    )
    dim.dimBlockId = '*D1'
    dim.dimBlockPosition = new AcGePoint3d(1, 2, 0)
    db.tables.blockTable.modelSpace.appendEntity(dim)
    expect(acdbAddAnnotationScaleToObject(dim, '1:100')).toBe(true)
    const dimCtx = acdbGetAnnotationScaleContexts(dim)[0]
      .contextData as AcDbDimensionObjectContextData
    expect(dimCtx).toBeInstanceOf(AcDbDimensionObjectContextData)
    expect(dimCtx.blockName).toBe('*D1')
    expect(dimCtx.definitionPoint.x).toBeCloseTo(1, 6)

    const blockRef = new AcDbBlockReference('AnnoBlock')
    blockRef.position = new AcGePoint3d(3, 4, 0)
    blockRef.scaleFactors = new AcGePoint3d(2, 2, 1)
    db.tables.blockTable.modelSpace.appendEntity(blockRef)
    expect(acdbAddAnnotationScaleToObject(blockRef, '1:20')).toBe(true)
    expect(
      acdbGetAnnotationScaleContexts(blockRef)[0].contextData instanceof
        AcDbBlkRefObjectContextData
    ).toBe(true)
  })

  it('annotative=false clears contexts so getter matches setter', () => {
    const db = createDb()
    const mt = new AcDbMText()
    mt.height = 2.5
    db.tables.blockTable.modelSpace.appendEntity(mt)
    acdbAddAnnotationScaleToObject(mt, '1:50')
    acdbAddAnnotationScaleToObject(mt, '1:100')
    expect(mt.annotative).toBe(true)

    mt.annotative = false
    expect(mt.annotative).toBe(false)
    expect(acdbGetAnnotationScaleContexts(mt)).toHaveLength(0)
  })
})
