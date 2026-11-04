import { AcGeMatrix3d } from '@mlightcad/geometry-engine'

import { acdbHostApplicationServices } from '../src/base'
import { AcDbResultBuffer } from '../src/base/AcDbResultBuffer'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbFileType } from '../src/database/AcDbDatabaseConverterManager'
import { AcDbBlockReference } from '../src/entity/AcDbBlockReference'
import { AcDbLine } from '../src/entity/AcDbLine'
import { AcDbUnknownEntity } from '../src/entity/AcDbUnknownEntity'
import { AcLyLayerFilter } from '../src/ly/AcLyLayerFilter'
import { AcDbDictionary } from '../src/object/AcDbDictionary'
import { AcDbUnknownObject } from '../src/object/AcDbUnknownObject'
import { AcDbXrecord } from '../src/object/AcDbXrecord'

const dxf = (lines: string[]) => lines.join('\n') + '\n'

async function readDxf(text: string | Uint8Array) {
  const db = new AcDbDatabase()
  acdbHostApplicationServices().workingDatabase = db
  const buf = typeof text === 'string' ? Buffer.from(text, 'utf8') : Buffer.from(text)
  await db.read(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    { readOnly: false },
    AcDbFileType.DXF
  )
  return db
}

function modelSpace(db: AcDbDatabase) {
  return [...db.tables.blockTable.modelSpace.newIterator()]
}

/** Returns the tags of the first record `(0, type)` with handle `handle`. */
function recordTags(out: string, type: string, handle: string): string[] {
  const lines = out.split('\n')
  for (let i = 0; i + 3 < lines.length; i += 2) {
    if (lines[i] === '0' && lines[i + 1] === type) {
      const end = lines.findIndex((l, j) => j > i && j % 2 === i % 2 && l === '0')
      const tags = lines.slice(i + 2, end)
      if (tags[0] === '5' && tags[1] === handle) return tags
    }
  }
  return []
}

/** Every handle written with group 5 / 105 (must be unique). */
function writtenHandles(out: string): string[] {
  const lines = out.split('\n')
  const handles: string[] = []
  let inHeader = false
  for (let i = 0; i + 1 < lines.length; i += 2) {
    if (lines[i] === '2' && lines[i + 1] === 'HEADER') inHeader = true
    if (lines[i] === '0' && lines[i + 1] === 'ENDSEC') inHeader = false
    if (inHeader) continue
    if (lines[i] === '5' || lines[i] === '105') handles.push(lines[i + 1])
  }
  return handles
}

const MODERN_DXF = dxf([
  '0', 'SECTION', '2', 'HEADER',
  '9', '$ACADVER', '1', 'AC1032',
  '9', '$HANDSEED', '5', '200',
  '9', '$INSBASE', '10', '1', '20', '2', '30', '0',
  '9', '$TEXTSIZE', '40', '7.5',
  '9', '$CECOLOR', '62', '1', '420', '16711935',
  '9', '$HPCOLOR', '62', '3',
  '0', 'ENDSEC',
  '0', 'SECTION', '2', 'CLASSES',
  '0', 'CLASS', '1', 'MATERIAL', '2', 'AcDbMaterial', '3', 'ObjectDBX Classes',
  '90', '1153', '91', '1', '280', '0', '281', '0',
  '0', 'CLASS', '1', 'HELIX', '2', 'AcDbHelix', '3', 'ObjectDBX Classes',
  '90', '4095', '91', '1', '280', '0', '281', '1',
  '0', 'ENDSEC',
  '0', 'SECTION', '2', 'ENTITIES',
  '0', 'LINE', '5', '50', '102', '{ACAD_XDICTIONARY', '360', '60', '102', '}',
  '330', '1F', '100', 'AcDbEntity', '8', '0', '347', '71',
  '100', 'AcDbLine',
  '10', '0', '20', '0', '30', '0', '11', '1', '21', '1', '31', '0',
  '0', 'HELIX', '5', '51', '330', '1F', '100', 'AcDbEntity', '8', 'L1',
  '100', 'AcDbSpline', '70', '0', '71', '3', '1', '',
  '100', 'AcDbHelix', '90', '29', '40', '1.5', '310', 'DEADBEEF',
  '1001', 'APP1', '1000', 'x',
  '0', 'ENDSEC',
  '0', 'SECTION', '2', 'OBJECTS',
  '0', 'DICTIONARY', '5', 'C', '330', '0', '100', 'AcDbDictionary', '281', '1',
  '3', 'ACAD_GROUP', '350', 'D',
  '3', 'ACAD_MATERIAL', '350', '70',
  '3', 'ACAD_PLOTSTYLENAME', '350', '80',
  '0', 'DICTIONARY', '5', 'D', '330', 'C', '100', 'AcDbDictionary', '281', '1',
  '0', 'DICTIONARY', '5', '70', '330', 'C', '100', 'AcDbDictionary', '281', '1',
  '3', 'Global', '350', '71',
  '0', 'MATERIAL', '5', '71', '330', '70', '100', 'AcDbMaterial', '1', 'Global', '72', '1',
  '0', 'ACDBDICTIONARYWDFLT', '5', '80', '330', 'C', '100', 'AcDbDictionary',
  '281', '1', '3', 'Normal', '350', '81',
  '100', 'AcDbDictionaryWithDefault', '340', '81',
  '0', 'ACDBPLACEHOLDER', '5', '81', '330', '80',
  '0', 'DICTIONARY', '5', '60', '330', '50', '100', 'AcDbDictionary', '281', '1',
  '3', 'MYDATA', '360', '61',
  '0', 'XRECORD', '5', '61', '330', '60', '100', 'AcDbXrecord', '280', '1',
  '1', 'payload',
  '0', 'ENDSEC', '0', 'EOF'
])

describe('DXF round trip of data without a native model', () => {
  it('keeps unknown entities verbatim and writes them back', async () => {
    const db = await readDxf(MODERN_DXF)
    const helix = modelSpace(db).find(e => e instanceof AcDbUnknownEntity) as
      | AcDbUnknownEntity
      | undefined
    expect(helix).toBeDefined()
    expect(helix!.dxfTypeName).toBe('HELIX')
    expect(helix!.objectId).toBe('51')
    expect(helix!.layer).toBe('L1')
    expect(helix!.getXData('APP1')).toBeDefined()

    const out = db.dxfOut() as string
    const tags = recordTags(out, 'HELIX', '51')
    expect(tags.join('|')).toContain(
      '100|AcDbSpline|70|0|71|3|1||100|AcDbHelix|90|29|40|1.5'
    )
    expect(tags.join('|')).toContain('1001|APP1|1000|x')

    const again = await readDxf(out)
    const helix2 = modelSpace(again).find(e => e instanceof AcDbUnknownEntity)
    expect(helix2?.dxfTypeName).toBe('HELIX')
  })

  it('keeps unknown objects, WDFLT dictionaries and their handles', async () => {
    const db = await readDxf(MODERN_DXF)
    const material = db.getObjectById('71')
    expect(material).toBeInstanceOf(AcDbUnknownObject)
    expect((material as AcDbUnknownObject).dxfTypeName).toBe('MATERIAL')
    const plotStyles = db.objects.dictionary.getAt('ACAD_PLOTSTYLENAME')
    expect(plotStyles).toBeInstanceOf(AcDbDictionary)
    expect((plotStyles as AcDbDictionary).objectId).toBe('80')
    expect((plotStyles as AcDbDictionary).defaultId).toBe('81')

    const out = db.dxfOut() as string
    expect(recordTags(out, 'MATERIAL', '71').join('|')).toContain(
      '330|70|100|AcDbMaterial|1|Global|72|1'
    )
    const wdflt = recordTags(out, 'ACDBDICTIONARYWDFLT', '80').join('|')
    expect(wdflt).toContain('3|Normal|350|81')
    expect(wdflt).toContain('100|AcDbDictionaryWithDefault|340|81')
    expect(recordTags(out, 'ACDBPLACEHOLDER', '81')).not.toHaveLength(0)
    // The NOD keeps pointing at the original handles.
    const nod = recordTags(out, 'DICTIONARY', 'C').join('|')
    expect(nod).toContain('ACAD_MATERIAL|350|70')
    expect(nod).toContain('ACAD_PLOTSTYLENAME|350|80')
    // Entity material handle survives because the MATERIAL is written.
    expect(recordTags(out, 'LINE', '50').join('|')).toContain('347|71')
  })

  it('writes extension dictionaries wrapped and resolvable', async () => {
    const db = await readDxf(MODERN_DXF)
    const line = modelSpace(db).find(e => e instanceof AcDbLine)!
    expect(line.extensionDictionary).toBe('60')

    const out = db.dxfOut() as string
    const lineTags = recordTags(out, 'LINE', '50').join('|')
    expect(lineTags.startsWith('5|50|102|{ACAD_XDICTIONARY|360|60|102|}|330|')).toBe(
      true
    )
    expect(recordTags(out, 'DICTIONARY', '60').join('|')).toContain(
      '3|MYDATA|350|61'
    )
    expect(recordTags(out, 'XRECORD', '61').join('|')).toContain(
      '330|60|100|AcDbXrecord'
    )
    // The xrecord is owned by the extension dictionary, not dumped into the
    // application's MLIGHT_XRECORD dictionary.
    expect(out).not.toContain('MLIGHT_XRECORD')

    const handles = writtenHandles(out)
    expect(new Set(handles).size).toBe(handles.length)

    const again = await readDxf(out)
    const line2 = modelSpace(again).find(e => e instanceof AcDbLine)!
    const ext = again.getObjectById(line2.extensionDictionary!)
    expect(ext).toBeInstanceOf(AcDbDictionary)
    expect((ext as AcDbDictionary).getAt('MYDATA')).toBeInstanceOf(AcDbXrecord)
  })

  it('omits an extension dictionary pointer that would dangle', async () => {
    const db = new AcDbDatabase()
    db.createDefaultData()
    const line = new AcDbLine({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })
    db.tables.blockTable.modelSpace.appendEntity(line)
    line.extensionDictionary = 'ABCDEF'
    const out = db.dxfOut() as string
    expect(out).not.toContain('{ACAD_XDICTIONARY')
    expect(out).not.toContain('ABCDEF')
  })

  it('round-trips HEADER variables without a native model', async () => {
    const db = await readDxf(MODERN_DXF)
    expect(db.cecolor.RGB).toBe(0xff00ff)
    expect(db.hpcolor.colorIndex).toBe(3)

    const out = db.dxfOut() as string
    expect(out).toContain('9\n$INSBASE\n10\n1\n20\n2\n30\n0\n')
    expect(out).toContain('9\n$TEXTSIZE\n40\n7.5\n')
    expect(out.match(/\$HANDSEED/g)).toHaveLength(1)

    // Older targets do not receive variables preserved from a newer file.
    const r12 = db.dxfOut(undefined, 16, 'AC1009') as string
    expect(r12).not.toContain('$TEXTSIZE')
    expect(r12).not.toContain('HELIX')
  })
})

describe('DXF export consistency', () => {
  it('patches the layer of an unknown entity and refuses transforms', async () => {
    const db = await readDxf(MODERN_DXF)
    const helix = modelSpace(db).find(
      e => e instanceof AcDbUnknownEntity
    ) as AcDbUnknownEntity
    helix.layer = 'L2'
    helix.transformBy(AcGeMatrix3d.makeTranslation(10, 0, 0))
    expect(helix.subGetGripPoints()).toHaveLength(0)

    const tags = recordTags(db.dxfOut() as string, 'HELIX', '51').join('|')
    expect(tags).toContain('100|AcDbEntity|8|L2|100|AcDbSpline')
    expect(tags).not.toContain('8|L1')
  })

  it('keeps hex binary tags when exporting binary DXF', async () => {
    const db = await readDxf(MODERN_DXF)
    const binary = db.dxfOut(undefined, 16, 'AC1032', {
      format: 'binary'
    }) as Uint8Array
    const again = await readDxf(binary)
    const out = again.dxfOut() as string
    expect(recordTags(out, 'HELIX', '51').join('|')).toContain('310|DEADBEEF')
  })

  it('does not export an unknown object removed from its dictionary', async () => {
    const db = await readDxf(MODERN_DXF)
    const materials = db.getObjectById('70') as AcDbDictionary
    db.transactionManager.runUndoable('remove', () => {
      materials.remove('Global')
    })
    const out = db.dxfOut() as string
    expect(recordTags(out, 'MATERIAL', '71')).toHaveLength(0)
    expect(recordTags(out, 'LINE', '50').join('|')).not.toContain('347|71')
  })

  it('registers APPIDs for every XData application written', async () => {
    const db = new AcDbDatabase()
    db.createDefaultData()
    const line = new AcDbLine({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })
    db.tables.blockTable.modelSpace.appendEntity(line)
    line.setXData(
      new AcDbResultBuffer([
        { code: 1001, value: 'MY_APP' },
        { code: 1000, value: 'v' }
      ])
    )
    const out = db.dxfOut() as string
    expect(out).toMatch(/0\nAPPID\n[\s\S]*?\n2\nMY_APP\n/)
  })

  it('writes the extension dictionaries of nested layer filters', async () => {
    const db = new AcDbDatabase()
    db.createDefaultData()
    const parent = new AcLyLayerFilter()
    parent.name = 'Parent'
    parent.filterExpression = 'NAME=="A*"'
    const child = new AcLyLayerFilter()
    child.name = 'Child'
    child.filterExpression = 'NAME=="AB*"'
    parent.addNested(child)
    db.layerFilters.root.addNested(parent)

    const out = db.dxfOut() as string
    // Layer table + the parent filter XRecord.
    expect(out.match(/\{ACAD_XDICTIONARY/g)).toHaveLength(2)

    const again = await readDxf(out)
    const [parent2] = again.layerFilters.root.getNestedFilters()
    expect(parent2.name).toBe('Parent')
    expect(parent2.getNestedFilters().map(f => f.name)).toEqual(['Child'])
  })
})

describe('DXF R12 structure without handles', () => {
  const R12_DXF = dxf([
    '0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009',
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'BLOCKS',
    '0', 'BLOCK', '8', '0', '2', 'B1', '70', '2',
    '10', '0', '20', '0', '30', '0', '3', 'B1',
    '0', 'ATTDEF', '8', '0', '10', '0', '20', '0', '30', '0', '40', '1',
    '1', 'x', '3', 'P', '2', 'TAG', '70', '0',
    '0', 'ENDBLK', '8', '0',
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    '0', 'INSERT', '8', '0', '66', '1', '2', 'B1',
    '10', '0', '20', '0', '30', '0',
    '0', 'ATTRIB', '8', '0', '10', '0', '20', '0', '30', '0', '40', '1',
    '1', 'hello', '2', 'TAG', '70', '0',
    '0', 'SEQEND', '8', '0',
    '0', 'INSERT', '8', '0', '2', 'B1', '10', '5', '20', '0', '30', '0',
    '0', 'ENDSEC', '0', 'EOF'
  ])

  it('attaches ATTRIBs to the INSERT they follow', async () => {
    const db = await readDxf(R12_DXF)
    const inserts = modelSpace(db).filter(
      e => e instanceof AcDbBlockReference
    ) as AcDbBlockReference[]
    expect(inserts).toHaveLength(2)
    expect([...inserts[0].attributeIterator()].map(a => a.textString)).toEqual([
      'hello'
    ])
    expect([...inserts[1].attributeIterator()]).toHaveLength(0)
  })

  it('writes the attributes-follow flag', async () => {
    const db = await readDxf(R12_DXF)
    const out = db.dxfOut(undefined, 16, 'AC1009') as string
    const first = out.indexOf('0\nINSERT\n')
    const attrib = out.indexOf('0\nATTRIB\n')
    expect(out.slice(first, attrib)).toContain('\n66\n1\n')
    const second = out.indexOf('0\nINSERT\n', attrib)
    expect(out.slice(second, out.indexOf('ENDSEC', second))).not.toContain(
      '\n66\n'
    )

    const again = await readDxf(out)
    const insert = modelSpace(again).find(
      e => e instanceof AcDbBlockReference
    ) as AcDbBlockReference
    expect([...insert.attributeIterator()].map(a => a.textString)).toEqual([
      'hello'
    ])
  })
})

describe('DXF table and block details', () => {
  it('resolves DIMSTYLE handle references to record names', async () => {
    const db = await readDxf(
      dxf([
        '0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1032',
        '0', 'ENDSEC',
        '0', 'SECTION', '2', 'TABLES',
        '0', 'TABLE', '2', 'STYLE', '5', '3', '330', '0',
        '100', 'AcDbSymbolTable', '70', '1',
        '0', 'STYLE', '5', '11', '330', '3', '100', 'AcDbSymbolTableRecord',
        '100', 'AcDbTextStyleTableRecord', '2', 'DimText', '70', '0',
        '40', '0', '41', '1', '50', '0', '71', '0', '42', '2.5', '3', 'arial.ttf',
        '0', 'ENDTAB',
        '0', 'TABLE', '2', 'DIMSTYLE', '5', 'A', '330', '0',
        '100', 'AcDbSymbolTable', '70', '1', '100', 'AcDbDimStyleTable',
        '0', 'DIMSTYLE', '105', '27', '330', 'A', '100', 'AcDbSymbolTableRecord',
        '100', 'AcDbDimStyleTableRecord', '2', 'MyDim', '70', '0',
        '340', '11', '342', '22',
        '0', 'ENDTAB',
        '0', 'TABLE', '2', 'BLOCK_RECORD', '5', '1', '330', '0',
        '100', 'AcDbSymbolTable', '70', '2',
        '0', 'BLOCK_RECORD', '5', '1F', '330', '1', '100', 'AcDbSymbolTableRecord',
        '100', 'AcDbBlockTableRecord', '2', '*Model_Space',
        '0', 'BLOCK_RECORD', '5', '22', '330', '1', '100', 'AcDbSymbolTableRecord',
        '100', 'AcDbBlockTableRecord', '2', '_ARCHTICK',
        '0', 'ENDTAB',
        '0', 'ENDSEC', '0', 'EOF'
      ])
    )
    const dimStyle = db.tables.dimStyleTable.getAt('MyDim')!
    expect(dimStyle.dimtxsty).toBe('DimText')
    expect(dimStyle.dimblk).toBe('_ARCHTICK')

    const out = db.dxfOut() as string
    const tags = recordTags(out, 'DIMSTYLE', '27')
    expect(tags).toHaveLength(0) // DIMSTYLE uses 105, not 5
    const idx = out.indexOf('\n2\nMyDim\n')
    const record = out.slice(idx, out.indexOf('\n0\nENDTAB', idx))
    expect(record).toContain('\n340\n11\n')
    expect(record).toContain('\n342\n22\n')
  })

  it('round-trips the BLOCK description and BLOCK_RECORD XData', async () => {
    const db = await readDxf(
      dxf([
        '0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1032',
        '0', 'ENDSEC',
        '0', 'SECTION', '2', 'TABLES',
        '0', 'TABLE', '2', 'APPID', '5', '9', '330', '0',
        '100', 'AcDbSymbolTable', '70', '1',
        '0', 'APPID', '5', '12', '330', '9', '100', 'AcDbSymbolTableRecord',
        '100', 'AcDbRegAppTableRecord', '2', 'AcDbBlockRepETag', '70', '0',
        '0', 'ENDTAB',
        '0', 'TABLE', '2', 'BLOCK_RECORD', '5', '1', '330', '0',
        '100', 'AcDbSymbolTable', '70', '2',
        '0', 'BLOCK_RECORD', '5', '1F', '330', '1', '100', 'AcDbSymbolTableRecord',
        '100', 'AcDbBlockTableRecord', '2', '*Model_Space',
        '0', 'BLOCK_RECORD', '5', '30', '330', '1', '100', 'AcDbSymbolTableRecord',
        '100', 'AcDbBlockTableRecord', '2', 'DOOR',
        '1001', 'AcDbBlockRepETag', '1070', '1', '1071', '42',
        '0', 'ENDTAB',
        '0', 'ENDSEC',
        '0', 'SECTION', '2', 'BLOCKS',
        '0', 'BLOCK', '5', '31', '330', '30', '100', 'AcDbEntity', '8', '0',
        '100', 'AcDbBlockBegin', '2', 'DOOR', '70', '0',
        '10', '0', '20', '0', '30', '0', '3', 'DOOR', '1', '', '4', 'Single door',
        '0', 'ENDBLK', '5', '32', '330', '30', '100', 'AcDbEntity', '8', '0',
        '100', 'AcDbBlockEnd',
        '0', 'ENDSEC', '0', 'EOF'
      ])
    )
    const door = db.tables.blockTable.getAt('DOOR')!
    expect(door.comments).toBe('Single door')

    const out = db.dxfOut() as string
    expect(out).toContain('\n4\nSingle door\n')
    const record = recordTags(out, 'BLOCK_RECORD', '30').join('|')
    expect(record).toContain('1001|AcDbBlockRepETag|1070|1|1071|42')
  })
})
