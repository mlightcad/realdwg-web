import { AcDbDxfParser } from '../src/converter/AcDbDxfParser'
import { AcDbDxfConverter } from '../src/converter/AcDbDxfConverter'

class TestDxfConverter extends AcDbDxfConverter {
  parsePublic(data: ArrayBuffer, timeout?: number) {
    return this.parse(data, timeout)
  }

  getFontsPublic(dxf: any) {
    return this.getFonts(dxf)
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
})
