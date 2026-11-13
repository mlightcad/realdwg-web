import { AcCmColor } from '@mlightcad/common'
import { AcGeMatrix3d, AcGePoint3d } from '@mlightcad/geometry-engine'

import {
  AcDbDeepCloneType,
  AcDbDuplicateRecordCloning,
  acdbHostApplicationServices,
  AcDbIdMapping
} from '../src/base'
import {
  AcDbBlockTableRecord,
  AcDbBlockTableRecordFlag,
  AcDbDatabase,
  AcDbLayerTableRecord,
  AcDbLinetypeTableRecord,
  AcDbTextStyleTableRecord
} from '../src/database'
import {
  AcDbAlignedDimension,
  AcDbAttribute,
  AcDbBlockReference,
  AcDbCircle,
  AcDbEntity,
  AcDbLine,
  AcDbMLeader,
  AcDbRasterImage,
  AcDbText
} from '../src/entity'
import { AcDbMLeaderStyle, AcDbRasterImageDef } from '../src/object'

const createDb = () => {
  const db = new AcDbDatabase()
  db.createDefaultData()
  return db
}

const addLayer = (db: AcDbDatabase, name: string, colorIndex: number) => {
  const color = new AcCmColor()
  color.colorIndex = colorIndex
  db.tables.layerTable.add(
    new AcDbLayerTableRecord({ name, color, linetype: 'Continuous' })
  )
}

const addBlock = (db: AcDbDatabase, name: string, entities: AcDbEntity[]) => {
  const block = new AcDbBlockTableRecord()
  block.name = name
  if (name.startsWith('*')) block.flags = AcDbBlockTableRecordFlag.Anonymous
  db.tables.blockTable.add(block)
  block.appendEntity(entities)
  return block
}

const modelSpaceEntities = (db: AcDbDatabase) =>
  Array.from(db.tables.blockTable.modelSpace.newIterator())

describe('AcDbDatabase cloning', () => {
  let source: AcDbDatabase

  beforeEach(() => {
    source = createDb()
    acdbHostApplicationServices().workingDatabase = source
  })

  it('wblock copies entities and every record they depend on', () => {
    source.tables.linetypeTable.add(
      new AcDbLinetypeTableRecord({ name: 'DASHED' })
    )
    const color = new AcCmColor()
    color.colorIndex = 1
    source.tables.layerTable.add(
      new AcDbLayerTableRecord({ name: 'WALLS', color, linetype: 'DASHED' })
    )
    source.tables.textStyleTable.add(
      new AcDbTextStyleTableRecord({ name: 'NOTES' })
    )

    const line = new AcDbLine(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(10, 0, 0)
    )
    line.layer = 'WALLS'
    const text = new AcDbText()
    text.textString = 'hello'
    text.styleName = 'NOTES'
    const unrelated = new AcDbCircle(new AcGePoint3d(), 5)
    source.tables.blockTable.modelSpace.appendEntity([line, text, unrelated])

    const clip = source.wblock([line.objectId, text.objectId])

    const entities = modelSpaceEntities(clip)
    expect(entities).toHaveLength(2)
    expect(entities[0]).toBeInstanceOf(AcDbLine)
    expect(entities[0].layer).toBe('WALLS')
    expect((entities[1] as AcDbText).styleName).toBe('NOTES')
    expect(clip.tables.layerTable.getAt('WALLS')?.color.colorIndex).toBe(1)
    expect(clip.tables.linetypeTable.has('DASHED')).toBe(true)
    expect(clip.tables.textStyleTable.has('NOTES')).toBe(true)

    // Clones are independent objects with handles of the new database.
    expect(entities[0]).not.toBe(line)
    expect(entities[0].isTemp).toBe(false)
    expect(entities[0].ownerId).toBe(clip.tables.blockTable.modelSpace.objectId)
    expect(clip.getObjectById(entities[0].objectId)).toBe(entities[0])
    expect(line.layer).toBe('WALLS')
  })

  it('insert keeps existing destination records (DRC Ignore) and transforms clones', () => {
    addLayer(source, 'SHARED', 1)
    const line = new AcDbLine(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(1, 0, 0)
    )
    line.layer = 'SHARED'
    source.tables.blockTable.modelSpace.appendEntity(line)
    const clip = source.wblock([line.objectId])

    const target = createDb()
    addLayer(target, 'SHARED', 3)
    const ids = target.insert(new AcGeMatrix3d().makeTranslation(5, 5, 0), clip)

    expect(ids).toHaveLength(1)
    const pasted = target.getObjectById(ids[0]) as AcDbLine
    expect(pasted.startPoint.x).toBeCloseTo(5)
    expect(pasted.startPoint.y).toBeCloseTo(5)
    expect(pasted.layer).toBe('SHARED')
    expect(target.tables.layerTable.getAt('SHARED')?.color.colorIndex).toBe(3)
  })

  it('MangleName renames records that clash with the destination', () => {
    addLayer(source, 'SHARED', 1)
    const line = new AcDbLine(new AcGePoint3d(), new AcGePoint3d(1, 0, 0))
    line.layer = 'SHARED'
    source.tables.blockTable.modelSpace.appendEntity(line)

    const target = createDb()
    addLayer(target, 'SHARED', 3)
    const idMap = new AcDbIdMapping(target)
    const [id] = source.wblockCloneObjects(
      [line.objectId],
      target.tables.blockTable.modelSpace.objectId,
      idMap,
      AcDbDuplicateRecordCloning.MangleName
    )

    const pasted = target.getObjectById(id) as AcDbLine
    expect(pasted.layer).toBe('$0$SHARED')
    expect(target.tables.layerTable.getAt('$0$SHARED')?.color.colorIndex).toBe(
      1
    )
    expect(idMap.deepCloneContext).toBe(AcDbDeepCloneType.kDcWblkObjects)
    expect(idMap.lookup(line.objectId)).toMatchObject({
      value: id,
      isCloned: true,
      isPrimary: true
    })
  })

  it('copies nested block definitions and INSERT attributes', () => {
    addBlock(source, 'INNER', [
      new AcDbLine(new AcGePoint3d(), new AcGePoint3d(1, 1, 0))
    ])
    addBlock(source, 'OUTER', [new AcDbBlockReference('INNER')])
    const ref = new AcDbBlockReference('OUTER')
    source.tables.blockTable.modelSpace.appendEntity(ref)
    const attrib = new AcDbAttribute()
    attrib.tag = 'TAG'
    attrib.textString = 'value'
    ref.appendAttributes(attrib)

    const target = createDb()
    const ids = target.insert(new AcGeMatrix3d(), source.wblock([ref.objectId]))

    const pasted = target.getObjectById(ids[0]) as AcDbBlockReference
    expect(pasted.blockName).toBe('OUTER')
    const outer = target.tables.blockTable.getAt('OUTER')!
    const [innerRef] = Array.from(outer.newIterator()) as AcDbBlockReference[]
    expect(innerRef.blockName).toBe('INNER')
    expect(innerRef.ownerId).toBe(outer.objectId)
    expect(target.tables.blockTable.getAt('INNER')?.newIterator().count).toBe(1)

    const attribs = Array.from(pasted.attributeIterator())
    expect(attribs).toHaveLength(1)
    expect(attribs[0].textString).toBe('value')
    expect(attribs[0].isTemp).toBe(false)
    expect(attribs[0].ownerId).toBe(pasted.objectId)
  })

  it('gives every copy of a dimension its own anonymous block', () => {
    addBlock(source, '*D1', [
      new AcDbLine(new AcGePoint3d(), new AcGePoint3d(10, 0, 0))
    ])
    const dim = new AcDbAlignedDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(10, 0, 0),
      new AcGePoint3d(5, 5, 0)
    )
    dim.dimBlockId = '*D1'
    source.tables.blockTable.modelSpace.appendEntity(dim)

    const [copyId] = source.deepCloneObjects(
      [dim.objectId],
      source.tables.blockTable.modelSpace.objectId,
      new AcDbIdMapping()
    )

    const copy = source.getObjectById(copyId) as AcDbAlignedDimension
    expect(copy.dimBlockId).toBe('*D2')
    expect(dim.dimBlockId).toBe('*D1')
    expect(source.tables.blockTable.getAt('*D2')?.newIterator().count).toBe(1)
  })

  it('deepCloneObjects in the same database shares named records', () => {
    addLayer(source, 'A', 2)
    const line = new AcDbLine(new AcGePoint3d(), new AcGePoint3d(1, 0, 0))
    line.layer = 'A'
    source.tables.blockTable.modelSpace.appendEntity(line)
    const layerCount = source.tables.layerTable.numEntries

    const [id] = source.deepCloneObjects(
      [line.objectId],
      source.tables.blockTable.modelSpace.objectId,
      new AcDbIdMapping()
    )

    const copy = source.getObjectById(id) as AcDbLine
    expect(copy).not.toBe(line)
    expect(copy.layer).toBe('A')
    expect(source.tables.layerTable.numEntries).toBe(layerCount)
    copy.startPoint = new AcGePoint3d(9, 9, 0)
    expect(line.startPoint.x).toBe(0)
  })

  it('remaps image definition ids', () => {
    const def = new AcDbRasterImageDef()
    def.sourceFileName = 'photo.png'
    source.objects.imageDefinition.setAt('PHOTO', def)
    const image = new AcDbRasterImage()
    image.imageDefId = def.objectId
    source.tables.blockTable.modelSpace.appendEntity(image)

    const target = createDb()
    // Occupy handles so the clone cannot keep the source id by accident.
    target.tables.blockTable.modelSpace.appendEntity(
      Array.from({ length: 20 }, () => new AcDbLine())
    )
    const ids = target.insert(new AcGeMatrix3d(), source.wblock())

    const pasted = target.getObjectById(ids[0]) as AcDbRasterImage
    const targetDef = target.objects.imageDefinition.getAt('PHOTO')
    expect(targetDef).toBeDefined()
    expect(pasted.imageDefId).toBe(targetDef!.objectId)
    expect(targetDef!.sourceFileName).toBe('photo.png')
  })

  it('records one undo step for an insert', () => {
    const line = new AcDbLine(new AcGePoint3d(), new AcGePoint3d(1, 0, 0))
    line.layer = 'NEW_LAYER'
    source.tables.blockTable.modelSpace.appendEntity(line)
    const clip = source.wblock([line.objectId])

    const target = createDb()
    const before = modelSpaceEntities(target).length
    target.transactionManager.runUndoable('paste', () => {
      target.insert(new AcGeMatrix3d(), clip)
    })
    expect(modelSpaceEntities(target)).toHaveLength(before + 1)
    expect(target.tables.layerTable.has('NEW_LAYER')).toBe(true)

    target.transactionManager.undo()
    expect(modelSpaceEntities(target)).toHaveLength(before)
    expect(target.tables.layerTable.has('NEW_LAYER')).toBe(false)
  })

  it('insert with a block name creates a block definition', () => {
    source.tables.blockTable.modelSpace.appendEntity(
      new AcDbLine(new AcGePoint3d(), new AcGePoint3d(1, 0, 0))
    )
    const target = createDb()
    const blockId = target.insert('A$C1', source)
    const block = target.getObjectById(blockId) as AcDbBlockTableRecord
    expect(block.name).toBe('A$C1')
    expect(block.newIterator().count).toBe(1)
    expect(() => target.insert('A$C1', source)).toThrow()
  })

  it('does not copy anonymous blocks of a shared block definition', () => {
    addBlock(source, '*D1', [
      new AcDbLine(new AcGePoint3d(), new AcGePoint3d(10, 0, 0))
    ])
    const dim = new AcDbAlignedDimension(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(10, 0, 0),
      new AcGePoint3d(5, 5, 0)
    )
    dim.dimBlockId = '*D1'
    addBlock(source, 'B', [dim])
    const ref = new AcDbBlockReference('B')
    source.tables.blockTable.modelSpace.appendEntity(ref)
    const blockCount = source.tables.blockTable.numEntries

    source.deepCloneObjects(
      [ref.objectId],
      source.tables.blockTable.modelSpace.objectId,
      new AcDbIdMapping()
    )

    expect(source.tables.blockTable.numEntries).toBe(blockCount)
  })

  it('does not import dependencies of an ignored block definition', () => {
    addLayer(source, 'INNER_ONLY', 1)
    const inner = new AcDbLine(new AcGePoint3d(), new AcGePoint3d(1, 0, 0))
    inner.layer = 'INNER_ONLY'
    addBlock(source, 'B', [inner])
    const ref = new AcDbBlockReference('B')
    source.tables.blockTable.modelSpace.appendEntity(ref)
    const clip = source.wblock([ref.objectId])

    const target = createDb()
    addBlock(target, 'B', [
      new AcDbLine(new AcGePoint3d(), new AcGePoint3d(2, 0, 0))
    ])
    target.insert(new AcGeMatrix3d(), clip)

    expect(target.tables.layerTable.has('INNER_ONLY')).toBe(false)
    expect(target.tables.blockTable.getAt('B')?.newIterator().count).toBe(1)
  })

  it('insert as a block renames a source block with the same name', () => {
    addBlock(source, 'X', [
      new AcDbLine(new AcGePoint3d(), new AcGePoint3d(1, 0, 0))
    ])
    source.tables.blockTable.modelSpace.appendEntity(
      new AcDbBlockReference('X')
    )

    const target = createDb()
    const blockId = target.insert('X', source)

    const block = target.getObjectById(blockId) as AcDbBlockTableRecord
    const [inner] = Array.from(block.newIterator()) as AcDbBlockReference[]
    expect(inner.blockName).toBe('$0$X')
    expect(target.tables.blockTable.getAt('$0$X')?.newIterator().count).toBe(1)
  })

  it('rejects a same-database clone of a block reference into its own block', () => {
    const block = addBlock(source, 'B', [])
    const ref = new AcDbBlockReference('B')
    source.tables.blockTable.modelSpace.appendEntity(ref)

    expect(() =>
      source.deepCloneObjects(
        [ref.objectId],
        block.objectId,
        new AcDbIdMapping()
      )
    ).toThrow()
    expect(block.newIterator().count).toBe(0)
  })

  it('remaps the references of a cloned MLEADER style', () => {
    const textStyle = new AcDbTextStyleTableRecord({ name: 'NOTES' })
    source.tables.textStyleTable.add(textStyle)
    const style = new AcDbMLeaderStyle()
    style.textStyleId = textStyle.objectId
    source.objects.mleaderStyle.setAt('CUSTOM', style)
    const mleader = new AcDbMLeader()
    mleader.mleaderStyleId = style.objectId
    source.tables.blockTable.modelSpace.appendEntity(mleader)

    const target = createDb()
    target.tables.blockTable.modelSpace.appendEntity(
      Array.from({ length: 20 }, () => new AcDbLine())
    )
    target.insert(new AcGeMatrix3d(), source.wblock([mleader.objectId]))

    const targetStyle = target.objects.mleaderStyle.getAt('CUSTOM')
    const targetTextStyle = target.tables.textStyleTable.getAt('NOTES')
    expect(targetStyle).toBeDefined()
    expect(targetTextStyle).toBeDefined()
    expect(targetStyle!.textStyleId).toBe(targetTextStyle!.objectId)
  })
})
