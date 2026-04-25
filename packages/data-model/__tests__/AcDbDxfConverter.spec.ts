import { AcDbDxfParser } from '../src/converter/AcDbDxfParser'
import { AcDbDxfConverter } from '../src/converter/AcDbDxfConverter'
import { AcDbDxfFiler } from '../src/base/AcDbDxfFiler'
import { acdbHostApplicationServices } from '../src/base/AcDbHostApplicationServices'
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
})
