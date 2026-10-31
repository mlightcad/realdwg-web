import { AcCmColorMethod, AcDbDatabase } from '@mlightcad/data-model'

import { AcDbLibreDwgConverter } from '../src/AcDbLibreDwgConverter'

class TestLibreDwgConverter extends AcDbLibreDwgConverter {
  processHeaderPublic(model: any, db: AcDbDatabase) {
    return this.processHeader(model, db)
  }

  processLayersPublic(model: any, db: AcDbDatabase) {
    return this.processLayers(model, db)
  }

  processDimStylesPublic(model: any, db: AcDbDatabase) {
    return this.processDimStyles(model, db)
  }
}

describe('AcDbLibreDwgConverter', () => {
  it('sets thumbnailImage from model thumbnailImage bytes', () => {
    const db = new AcDbDatabase()
    const converter = new TestLibreDwgConverter({ useWorker: false })
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47])

    converter.processHeaderPublic(
      {
        header: {},
        thumbnailImage: bytes
      },
      db
    )

    expect(db.thumbnailImage).toEqual(bytes)
  })

  it('maps TILEMODE from the DWG header', () => {
    const converter = new TestLibreDwgConverter({ useWorker: false })

    const paper = new AcDbDatabase()
    converter.processHeaderPublic({ header: { TILEMODE: 0 } }, paper)
    expect(paper.tilemode).toBe(0)

    const model = new AcDbDatabase()
    converter.processHeaderPublic({ header: { TILEMODE: 1 } }, model)
    expect(model.tilemode).toBe(1)

    const missing = new AcDbDatabase()
    converter.processHeaderPublic({ header: {} }, missing)
    expect(missing.tilemode).toBe(1)
  })

  it('resolves DIMTXSTY handles and records annotative scale', () => {
    const db = new AcDbDatabase()
    const converter = new TestLibreDwgConverter({ useWorker: false })
    converter.processDimStylesPublic(
      {
        tables: {
          STYLE: {
            entries: [{ name: '仿宋', handle: '28D' }]
          },
          DIMSTYLE: {
            entries: [
              {
                name: '1-1',
                handle: 'C38',
                ownerHandle: '0',
                DIMTXT: 3,
                DIMSCALE: 1,
                DIMTXSTY: 0x28d
              }
            ]
          }
        },
        dimStyleAnnotationScales: { '1-1': 16 }
      },
      db
    )
    expect(db.tables.dimStyleTable.getAt('1-1')?.dimtxsty).toBe('仿宋')
    expect(db.getDimStyleAnnotationScale('1-1')).toBe(16)
  })

  it('resolves DIMLDRBLK handles and DIMBLK names to arrow blocks', () => {
    const db = new AcDbDatabase()
    const converter = new TestLibreDwgConverter({ useWorker: false })
    converter.processDimStylesPublic(
      {
        tables: {
          BLOCK_RECORD: {
            entries: [
              { name: '_DOT', handle: '2A' },
              { name: 'ACE', handle: '11' },
              { name: '_OPEN90', handle: 'ACE' },
              { name: '_OPEN', handle: '2B' }
            ]
          },
          DIMSTYLE: {
            entries: [
              {
                name: 'Arrows',
                handle: 'C38',
                ownerHandle: '0',
                DIMLDRBLK: 0x2a,
                DIMBLK: '_CLOSEDFILLED',
                DIMBLK1: 'ACE',
                DIMBLK2: '43'
              },
              {
                name: 'DefaultArrow',
                handle: 'C39',
                ownerHandle: '0',
                DIMLDRBLK: 0,
                DIMBLK: '.',
                DIMBLK1: '',
                DIMBLK2: 'NOT_A_HANDLE'
              }
            ]
          }
        }
      },
      db
    )

    const arrows = db.tables.dimStyleTable.getAt('Arrows')
    expect(arrows?.dimldrblk).toBe('_DOT')
    expect(arrows?.dimblk).toBe('_CLOSEDFILLED')
    // "ACE" is the block name, even though another record's handle is ACE.
    expect(arrows?.dimblk1).toBe('ACE')
    expect(arrows?.dimblk2).toBe('_OPEN')

    const defaults = db.tables.dimStyleTable.getAt('DefaultArrow')
    expect(defaults?.dimldrblk).toBe('')
    expect(defaults?.dimblk).toBe('')
    expect(defaults?.dimblk1).toBe('')
    expect(defaults?.dimblk2).toBe('NOT_A_HANDLE')
  })

  it('uses the closed-filled arrow when the block table is missing', () => {
    const db = new AcDbDatabase()
    const converter = new TestLibreDwgConverter({ useWorker: false })
    converter.processDimStylesPublic(
      {
        tables: {
          DIMSTYLE: {
            entries: [
              {
                name: 'NoBlocks',
                handle: '2',
                ownerHandle: '0',
                DIMLDRBLK: 0x2a,
                DIMBLK: 0x2b
              }
            ]
          }
        }
      },
      db
    )

    const style = db.tables.dimStyleTable.getAt('NoBlocks')
    expect(style?.dimldrblk).toBe('')
    expect(style?.dimblk).toBe('')
  })

  it('maps $DIMSTYLE from the DWG header onto db.dimstyle', () => {
    const converter = new TestLibreDwgConverter({ useWorker: false })

    const withStyle = new AcDbDatabase()
    converter.processHeaderPublic({ header: { DIMSTYLE: '1-1' } }, withStyle)
    expect(withStyle.dimstyle).toBe('1-1')

    const blank = new AcDbDatabase()
    converter.processHeaderPublic({ header: { DIMSTYLE: '  ' } }, blank)
    expect(blank.dimstyle).toBe('Standard')

    const missing = new AcDbDatabase()
    converter.processHeaderPublic({ header: {} }, missing)
    expect(missing.dimstyle).toBe('Standard')
  })

  it('keeps CMC RGB for layers when libredwg leaves colorIndex at 256', () => {
    // libredwg-web convertLayer leaves colorIndex=256 for method 0xC2 and puts
    // the CMC RGB in `color`. Mapping 256 to ByLayer made legend fills white.
    const db = new AcDbDatabase()
    const converter = new TestLibreDwgConverter({ useWorker: false })

    converter.processLayersPublic(
      {
        tables: {
          LAYER: {
            entries: [
              {
                name: '0道路填充',
                handle: '1',
                ownerHandle: '0',
                standardFlag: 0,
                colorIndex: 256,
                color: 0xff7fbf,
                lineType: 'Continuous',
                lineweight: -1,
                frozen: false,
                off: false,
                frozenInNew: false,
                locked: false,
                plotFlag: 1
              },
              {
                name: '0草地填充',
                handle: '2',
                ownerHandle: '0',
                standardFlag: 0,
                colorIndex: 70,
                color: 0xffffff,
                lineType: 'Continuous',
                lineweight: -1,
                frozen: false,
                off: false,
                frozenInNew: false,
                locked: false,
                plotFlag: 1
              }
            ]
          }
        }
      },
      db
    )

    const road = db.tables.layerTable.getAt('0道路填充')
    expect(road).toBeTruthy()
    expect(road!.color.colorMethod).toBe(AcCmColorMethod.ByColor)
    expect(road!.color.RGB).toBe(0xff7fbf)
    expect(road!.color.isByLayer).toBe(false)

    const grass = db.tables.layerTable.getAt('0草地填充')
    expect(grass).toBeTruthy()
    expect(grass!.color.colorIndex).toBe(70)
  })

  it('keeps ByBlock when colorIndex is 0 even if color defaults to white', () => {
    // libredwg convertLayer defaults color to 0xffffff; the 0xc3/ByBlock path
    // only sets colorIndex=0 and leaves that default rgb in place.
    const db = new AcDbDatabase()
    const converter = new TestLibreDwgConverter({ useWorker: false })

    converter.processLayersPublic(
      {
        tables: {
          LAYER: {
            entries: [
              {
                name: 'ByBlockLayer',
                handle: '1',
                ownerHandle: '0',
                standardFlag: 0,
                colorIndex: 0,
                color: 0xffffff,
                lineType: 'Continuous',
                lineweight: -1,
                frozen: false,
                off: false,
                frozenInNew: false,
                locked: false,
                plotFlag: 1
              }
            ]
          }
        }
      },
      db
    )

    const layer = db.tables.layerTable.getAt('ByBlockLayer')
    expect(layer).toBeTruthy()
    expect(layer!.color.isByBlock).toBe(true)
    expect(layer!.color.colorIndex).toBe(0)
  })
})
