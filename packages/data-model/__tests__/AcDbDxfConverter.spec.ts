import { AcDbDxfParser } from '../src/converter/AcDbDxfParser'
import { AcDbDxfConverter } from '../src/converter/AcDbDxfConverter'
import { AcDbDxfFiler } from '../src/base/AcDbDxfFiler'
import { acdbHostApplicationServices } from '../src/base/AcDbHostApplicationServices'
import { AcDbBlockReference } from '../src/entity/AcDbBlockReference'
import { AcDbBlockTableRecord } from '../src/database/AcDbBlockTableRecord'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbLayerTableRecord } from '../src/database/AcDbLayerTableRecord'

class TestDxfConverter extends AcDbDxfConverter {
  parsePublic(data: ArrayBuffer, timeout?: number) {
    return this.parse(data, timeout)
  }

  getFontsPublic(dxf: any) {
    return this.getFonts(dxf)
  }

  processCommonTableAttrsPublic(table: any, dbTable: any) {
    return (this as any).processCommonTableAttrs(table, dbTable)
  }

  processCommonTableEntryAttrsPublic(entry: any, dbEntry: any) {
    return (this as any).processCommonTableEntryAttrs(entry, dbEntry)
  }

  processEntitiesInBlockPublic(
    entities: any[],
    blockTableRecord: AcDbBlockTableRecord,
    checkOwner?: boolean
  ) {
    return (this as any).processEntitiesInBlock(
      entities,
      blockTableRecord,
      checkOwner
    )
  }
}

describe('AcDbDxfConverter', () => {
  it('sets default parser worker url in constructor', () => {
    const config: Record<string, unknown> = {}
    new AcDbDxfConverter(config as any)
    expect(config.parserWorkerUrl).toBe('/assets/dxf-parser-worker.js')
  })

  it('parses through AcDbDxfParser when worker disabled', async () => {
    const parseSpy = jest
      .spyOn(AcDbDxfParser.prototype, 'parse')
      .mockReturnValue({ entities: [] } as any)

    const converter = new TestDxfConverter({ useWorker: false })
    const result = await converter.parsePublic(new ArrayBuffer(0))

    expect(result.model).toEqual({ entities: [] })
    expect(result.data.unknownEntityCount).toBe(0)
    expect(parseSpy).toHaveBeenCalled()

    parseSpy.mockRestore()
  })

  it('collects fonts from style table, mtext and nested inserts', () => {
    const converter = new TestDxfConverter({ useWorker: false })
    const fonts = converter.getFontsPublic({
      tables: {
        STYLE: {
          entries: [
            {
              name: 'A',
              font: 'Arial.ttf',
              bigFont: 'Bigfont.shx',
              extendedFont: 'Ext.ttf'
            }
          ]
        }
      },
      entities: [
        { type: 'TEXT', styleName: 'A' },
        { type: 'MTEXT', styleName: 'A', text: '{\\fCustom|b0|i0;Hello}' },
        { type: 'INSERT', name: 'B1' }
      ],
      blocks: {
        B1: {
          entities: [{ type: 'TEXT', styleName: 'A' }]
        }
      }
    })

    expect(fonts).toEqual(
      expect.arrayContaining(['arial', 'bigfont', 'ext', 'custom'])
    )
  })

  it('preserves default table ownership when DXF table metadata omits owner ids', () => {
    const db = new AcDbDatabase()
    acdbHostApplicationServices().workingDatabase = db
    const converter = new TestDxfConverter({ useWorker: false })

    const layerTable = db.tables.layerTable
    converter.processCommonTableAttrsPublic(
      {
        handle: 'AA'
      },
      layerTable
    )

    const record = new AcDbLayerTableRecord({ name: 'T1' })
    converter.processCommonTableEntryAttrsPublic(
      {
        name: 'T1',
        handle: 'BB'
      },
      record
    )
    layerTable.add(record)

    const filer = new AcDbDxfFiler()
    expect(layerTable.ownerId).toBe(db.objectId)
    expect(record.ownerId).toBe(layerTable.objectId)
    expect(() => layerTable.dxfOut(filer)).not.toThrow()
    expect(() => record.dxfOut(filer)).not.toThrow()
  })

  it('attaches ATTRIB entities to INSERTs converted in the same block record', async () => {
    const database = new AcDbDatabase()
    acdbHostApplicationServices().workingDatabase = database

    const blockTableRecord = new AcDbBlockTableRecord()
    blockTableRecord.objectId = 'BTR1'
    blockTableRecord.name = '*Paper_Space'
    database.tables.blockTable.add(blockTableRecord)

    const converter = new TestDxfConverter({ useWorker: false })

    await converter.processEntitiesInBlockPublic(
      [
        {
          type: 'INSERT',
          handle: 'I1',
          ownerBlockRecordSoftId: 'BTR1',
          layer: 'Viewport',
          name: 'TITLE_BLOCK',
          insertionPoint: { x: 10, y: 20, z: 0 }
        },
        {
          type: 'ATTRIB',
          handle: 'A1',
          ownerBlockRecordSoftId: 'I1',
          layer: 'CARTOUCHE',
          text: 'OPTICAL MODULE SUPPORT',
          textHeight: 2.5,
          startPoint: { x: 12, y: 22, z: 0 },
          rotation: 0,
          tag: 'TITLE',
          textStyle: 'STANDARD',
          horizontalJustification: 0,
          verticalJustification: 0,
          scale: 1
        }
      ],
      blockTableRecord
    )

    const insert = blockTableRecord.getIdAt('I1') as AcDbBlockReference
    const attributes = [...insert.attributeIterator()]

    expect(attributes).toHaveLength(1)
    expect(attributes[0].ownerId).toBe('I1')
    expect(attributes[0].textString).toBe('OPTICAL MODULE SUPPORT')
  })
})
