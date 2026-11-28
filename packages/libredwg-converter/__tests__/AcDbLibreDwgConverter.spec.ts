import {
  AcCmColorMethod,
  AcDbBlockTableRecord,
  AcDbDatabase,
  AcDbSysVarManager,
  AcDbSystemVariables,
  ACTIVE_VPORT_NAME
} from '@mlightcad/data-model'

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

  processObjectsPublic(model: any, db: AcDbDatabase) {
    return this.processObjects(model, db)
  }

  processViewportsPublic(model: any, db: AcDbDatabase) {
    return this.processViewports(model, db)
  }

  processBlockTablesPublic(model: any, db: AcDbDatabase) {
    return this.processBlockTables(model, db)
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

  it('registers symbol BTRs before appending paper-space INSERTs', () => {
    const db = new AcDbDatabase()
    db.createDefaultData()
    const converter = new TestLibreDwgConverter({ useWorker: false })

    let insertSawSymbolBlock = false
    db.events.entityAppended.addEventListener(args => {
      const entities = Array.isArray(args.entity) ? args.entity : [args.entity]
      for (const entity of entities) {
        if (
          entity.type === 'INSERT' ||
          (entity as { blockName?: string }).blockName === 'TitleBlock'
        ) {
          insertSawSymbolBlock = !!db.tables.blockTable.getAt('TitleBlock')
        }
      }
    })

    // *Paper_Space listed before the referenced symbol — the bug that emptied
    // title-block INSERTs when entities were filled in the same BTR loop.
    converter.processBlockTablesPublic(
      {
        tables: {
          BLOCK_RECORD: {
            entries: [
              {
                name: '*Model_Space',
                handle: '1F',
                ownerHandle: '1',
                flags: 0,
                basePoint: { x: 0, y: 0, z: 0 },
                entities: []
              },
              {
                name: '*Paper_Space',
                handle: '1B',
                ownerHandle: '1',
                flags: 0,
                basePoint: { x: 0, y: 0, z: 0 },
                entities: [
                  {
                    type: 'INSERT',
                    handle: '2607',
                    ownerBlockRecordSoftId: '1B',
                    name: 'TitleBlock',
                    insertionPoint: { x: 0, y: 0, z: 0 },
                    xScale: 1,
                    yScale: 1,
                    zScale: 1,
                    rotation: 0,
                    extrusionDirection: { x: 0, y: 0, z: 1 },
                    layer: '0',
                    attribs: []
                  }
                ]
              },
              {
                name: 'TitleBlock',
                handle: 'B8',
                ownerHandle: '1',
                flags: 0,
                basePoint: { x: 0, y: 0, z: 0 },
                entities: [
                  {
                    type: 'LINE',
                    handle: 'B9',
                    ownerBlockRecordSoftId: 'B8',
                    startPoint: { x: 0, y: 0, z: 0 },
                    endPoint: { x: 10, y: 0, z: 0 },
                    extrusionDirection: { x: 0, y: 0, z: 1 },
                    layer: '0'
                  }
                ]
              }
            ]
          }
        }
      },
      db
    )

    expect(db.tables.blockTable.getAt('TitleBlock')).toBeDefined()
    const paper = db.tables.blockTable.getAt('*Paper_Space')
    expect(paper).toBeDefined()
    const inserts = [...paper!.newIterator()].filter(
      e => (e as { blockName?: string }).blockName === 'TitleBlock'
    )
    expect(inserts.length).toBe(1)
    expect(insertSawSymbolBlock).toBe(true)
    expect([...db.tables.blockTable.getAt('TitleBlock')!.newIterator()].length).toBe(
      1
    )
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

  it('maps UCS header vars and derives WORLDUCS', () => {
    const converter = new TestLibreDwgConverter({ useWorker: false })

    const world = new AcDbDatabase()
    converter.processHeaderPublic({ header: {} }, world)
    expect(world.ucsbase).toBe('')
    expect(world.ucsname).toBe('')
    expect(world.ucsorg.equals({ x: 0, y: 0, z: 0 })).toBe(true)
    expect(world.ucsxdir.equals({ x: 1, y: 0, z: 0 })).toBe(true)
    expect(world.ucsydir.equals({ x: 0, y: 1, z: 0 })).toBe(true)
    expect(world.worlducs).toBe(1)

    const custom = new AcDbDatabase()
    converter.processHeaderPublic(
      {
        header: {
          UCSBASE: 'BaseUCS',
          UCSNAME: 'MyUCS',
          UCSORG: { x: 10, y: 20, z: 30 },
          UCSXDIR: { x: 0, y: 1, z: 0 },
          UCSYDIR: { x: -1, y: 0, z: 0 }
        }
      },
      custom
    )
    expect(custom.ucsbase).toBe('BaseUCS')
    expect(custom.ucsname).toBe('MyUCS')
    expect(custom.ucsorg.equals({ x: 10, y: 20, z: 30 })).toBe(true)
    expect(custom.ucsxdir.equals({ x: 0, y: 1, z: 0 })).toBe(true)
    expect(custom.ucsydir.equals({ x: -1, y: 0, z: 0 })).toBe(true)
    expect(custom.worlducs).toBe(0)
  })

  it('maps UCSFOLLOW and UCSICON onto *Active VPORT ObjectARX properties', () => {
    const converter = new TestLibreDwgConverter({ useWorker: false })
    const db = new AcDbDatabase()

    converter.processViewportsPublic(
      {
        tables: {
          VPORT: {
            entries: [
              {
                name: ACTIVE_VPORT_NAME,
                handle: '1',
                standardFlag: 0x8,
                ucsIconSetting: 1,
                center: { x: 0, y: 0 },
                lowerLeftCorner: { x: 0, y: 0 },
                upperRightCorner: { x: 1, y: 1 }
              }
            ]
          }
        }
      },
      db
    )

    const active = db.tables.viewportTable.getActiveVport()
    expect(active?.ucsFollowMode).toBe(true)
    expect(active?.iconEnabled).toBe(true)
    expect(active?.iconAtOrigin).toBe(false)
    expect(active?.getUcsIconSysVar()).toBe(1)
    const manager = AcDbSysVarManager.instance()
    expect(manager.getVar(AcDbSystemVariables.UCSFOLLOW, db)).toBe(1)
    expect(manager.getVar(AcDbSystemVariables.UCSICON, db)).toBe(1)
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

  it('treats all layers as plottable for pre-R2000 DWGs (no DXF 290)', () => {
    // LibreDWG leaves LAYER.plotflag at 0 for R14; that must not hide the
    // drawing when the host opens with drawNoPlotLayers: false.
    const db = new AcDbDatabase()
    const converter = new TestLibreDwgConverter({ useWorker: false })

    converter.processLayersPublic(
      {
        header: { ACADVER: 'AC1014' },
        tables: {
          LAYER: {
            entries: [
              {
                name: '0',
                handle: '1',
                ownerHandle: '0',
                standardFlag: 0,
                colorIndex: 7,
                color: 0xffffff,
                lineType: 'Continuous',
                lineweight: -1,
                frozen: false,
                off: false,
                frozenInNew: false,
                locked: false,
                plotFlag: 0
              },
              {
                name: 'AXES',
                handle: '2',
                ownerHandle: '0',
                standardFlag: 0,
                colorIndex: 1,
                color: 0xffffff,
                lineType: 'Continuous',
                lineweight: -1,
                frozen: false,
                off: false,
                frozenInNew: false,
                locked: false,
                plotFlag: 0
              }
            ]
          }
        }
      },
      db
    )

    expect(db.tables.layerTable.getAt('0')!.isPlottable).toBe(true)
    expect(db.tables.layerTable.getAt('AXES')!.isPlottable).toBe(true)
  })

  it('does not treat pre-R13 ACADVER strings as R2000+', () => {
    const db = new AcDbDatabase()
    const converter = new TestLibreDwgConverter({ useWorker: false })

    converter.processLayersPublic(
      {
        header: { ACADVER: 'AC2.10' },
        tables: {
          LAYER: {
            entries: [
              {
                name: '0',
                handle: '1',
                ownerHandle: '0',
                standardFlag: 0,
                colorIndex: 7,
                color: 0xffffff,
                lineType: 'Continuous',
                lineweight: -1,
                frozen: false,
                off: false,
                frozenInNew: false,
                locked: false,
                plotFlag: 0
              }
            ]
          }
        }
      },
      db
    )

    expect(db.tables.layerTable.getAt('0')!.isPlottable).toBe(true)
  })

  it('treats all-zero plotFlags as missing when ACADVER is absent', () => {
    const db = new AcDbDatabase()
    const converter = new TestLibreDwgConverter({ useWorker: false })

    converter.processLayersPublic(
      {
        header: {},
        tables: {
          LAYER: {
            entries: [
              {
                name: '0',
                handle: '1',
                ownerHandle: '0',
                standardFlag: 0,
                colorIndex: 7,
                color: 0xffffff,
                lineType: 'Continuous',
                lineweight: -1,
                frozen: false,
                off: false,
                frozenInNew: false,
                locked: false,
                plotFlag: 0
              }
            ]
          }
        }
      },
      db
    )

    expect(db.tables.layerTable.getAt('0')!.isPlottable).toBe(true)
  })

  it('honors plotFlag for R2000+ DWGs', () => {
    const db = new AcDbDatabase()
    const converter = new TestLibreDwgConverter({ useWorker: false })

    converter.processLayersPublic(
      {
        header: { ACADVER: 'AC1015' },
        tables: {
          LAYER: {
            entries: [
              {
                name: '0',
                handle: '1',
                ownerHandle: '0',
                standardFlag: 0,
                colorIndex: 7,
                color: 0xffffff,
                lineType: 'Continuous',
                lineweight: -1,
                frozen: false,
                off: false,
                frozenInNew: false,
                locked: false,
                plotFlag: 1
              },
              {
                name: 'DEFPOINTS',
                handle: '2',
                ownerHandle: '0',
                standardFlag: 0,
                colorIndex: 7,
                color: 0xffffff,
                lineType: 'Continuous',
                lineweight: -1,
                frozen: false,
                off: false,
                frozenInNew: false,
                locked: false,
                plotFlag: 0
              }
            ]
          }
        }
      },
      db
    )

    expect(db.tables.layerTable.getAt('0')!.isPlottable).toBe(true)
    expect(db.tables.layerTable.getAt('DEFPOINTS')!.isPlottable).toBe(false)
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

  it('links paper layouts via paperSpaceTableId when BLOCK_RECORD.layout is empty', () => {
    const db = new AcDbDatabase()
    db.createDefaultData()
    const paper = db.tables.blockTable.getAt(
      AcDbBlockTableRecord.PAPER_SPACE_NAME_PREFIX
    )
    expect(paper).toBeTruthy()
    paper!.objectId = '15'
    paper!.layoutId = ''

    const converter = new TestLibreDwgConverter({ useWorker: false })
    converter.processObjectsPublic(
      {
        objects: {
          DICTIONARY: [],
          GROUP: [],
          XRECORD: [],
          LAYOUT: [
            {
              handle: '6D',
              ownerHandle: '6B',
              layoutName: 'Model',
              tabOrder: 0,
              minLimit: { x: 0, y: 0 },
              maxLimit: { x: 12, y: 9 },
              minExtent: { x: 0, y: 0, z: 0 },
              maxExtent: { x: 0, y: 0, z: 0 },
              paperSpaceTableId: '18',
              viewportId: ''
            },
            {
              handle: '6E',
              ownerHandle: '6B',
              layoutName: 'Layout1',
              tabOrder: 1,
              minLimit: { x: 0, y: 0 },
              maxLimit: { x: 420, y: 297 },
              minExtent: { x: 0, y: 0, z: 0 },
              maxExtent: { x: 1, y: 1, z: 0 },
              paperSpaceTableId: '15',
              viewportId: ''
            }
          ],
          IMAGEDEF: [],
          LAYER_FILTER: [],
          LAYER_INDEX: [],
          MLEADERSTYLE: [],
          SPATIAL_FILTER: []
        },
        tables: {
          BLOCK_RECORD: { entries: [] }
        }
      },
      db
    )

    const layout1 = db.objects.layout.getAt('Layout1')
    expect(layout1?.blockTableRecordId).toBe('15')
    expect(paper!.layoutId).toBe(layout1!.objectId)
  })

  it('ignores paperSpaceTableId that points at a non-paper-space BTR', () => {
    const db = new AcDbDatabase()
    db.createDefaultData()
    const modelSpace = db.tables.blockTable.modelSpace
    const paper = db.tables.blockTable.getAt(
      AcDbBlockTableRecord.PAPER_SPACE_NAME_PREFIX
    )
    expect(paper).toBeTruthy()
    paper!.layoutId = ''

    const converter = new TestLibreDwgConverter({ useWorker: false })
    converter.processObjectsPublic(
      {
        objects: {
          DICTIONARY: [],
          GROUP: [],
          XRECORD: [],
          LAYOUT: [
            {
              handle: '6E',
              ownerHandle: '6B',
              layoutName: 'Layout1',
              tabOrder: 1,
              minLimit: { x: 0, y: 0 },
              maxLimit: { x: 420, y: 297 },
              minExtent: { x: 0, y: 0, z: 0 },
              maxExtent: { x: 1, y: 1, z: 0 },
              paperSpaceTableId: modelSpace.objectId,
              viewportId: ''
            }
          ],
          IMAGEDEF: [],
          LAYER_FILTER: [],
          LAYER_INDEX: [],
          MLEADERSTYLE: [],
          SPATIAL_FILTER: []
        },
        tables: {
          BLOCK_RECORD: { entries: [] }
        }
      },
      db
    )

    const layout1 = db.objects.layout.getAt('Layout1')
    expect(layout1?.blockTableRecordId).toBe(paper!.objectId)
    expect(paper!.layoutId).toBe(layout1!.objectId)
  })

  it('converts GROUP objects and renames from ACAD_GROUP', () => {
    const db = new AcDbDatabase()
    const converter = new TestLibreDwgConverter({ useWorker: false })
    converter.processObjectsPublic(
      {
        objects: {
          DICTIONARY: [
            {
              handle: 'C',
              ownerHandle: '0',
              entries: { ACAD_GROUP: 'D' }
            },
            {
              handle: 'D',
              ownerHandle: 'C',
              entries: { MyGroup: 'G1' }
            }
          ],
          GROUP: [
            {
              handle: 'G1',
              ownerHandle: 'D',
              description: 'Door tags',
              unnamed: false,
              selectable: true,
              objectHandles: ['E1', 'E2']
            }
          ],
          XRECORD: [],
          LAYOUT: [],
          IMAGEDEF: [],
          LAYER_FILTER: [],
          LAYER_INDEX: [],
          MLEADERSTYLE: [],
          SPATIAL_FILTER: []
        },
        tables: {
          BLOCK_RECORD: { entries: [] }
        }
      },
      db
    )

    const group = db.objects.group.getAt('MyGroup')
    expect(group).toBeTruthy()
    expect(group!.name).toBe('MyGroup')
    expect(group!.description).toBe('Door tags')
    expect(group!.entityIds).toEqual(['E1', 'E2'])
    expect(group!.selectable).toBe(true)
  })
})
