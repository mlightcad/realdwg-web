import { AcDbObjectConverter } from '../src/converter/AcDbObjectConverter'
import { acdbHostApplicationServices } from '../src/base/AcDbHostApplicationServices'
import { AcDbDatabase } from '../src/database/AcDbDatabase'

describe('AcDbObjectConverter', () => {
  it('converts image definition and model layout', () => {
    acdbHostApplicationServices().workingDatabase = new AcDbDatabase()
    const converter = new AcDbObjectConverter()

    const image = converter.convertImageDef({
      fileName: 'a.png',
      handle: '10',
      ownerObjectId: '2'
    } as any)
    expect(image.sourceFileName).toBe('a.png')
    expect(image.objectId).toBe('10')
    expect(image.ownerId).toBe('2')

    const model = {
      tables: {
        BLOCK_RECORD: {
          entries: [{ name: '*Model_Space', handle: '1A' }]
        }
      }
    } as any

    const layout = converter.convertLayout(
      {
        layoutName: 'Model',
        tabOrder: 0,
        pageSetupName: 'setup',
        configName: 'cfg',
        paperSize: 'A4',
        plotViewName: 'view',
        currentStyleSheet: 'style.ctb',
        marginLeft: 1,
        marginRight: 2,
        marginTop: 3,
        marginBottom: 4,
        paperWidth: 210,
        paperHeight: 297,
        plotOriginX: 0,
        plotOriginY: 0,
        windowAreaXMin: 0,
        windowAreaYMin: 0,
        windowAreaXMax: 10,
        windowAreaYMax: 10,
        printScaleNumerator: 1,
        printScaleDenominator: 1,
        plotPaperUnit: 0,
        plotRotation: 0,
        plotType: 0,
        standardScaleType: 0,
        shadePlotMode: 2,
        shadePlotResolution: 5,
        shadePlotCustomDPI: 300,
        shadePlotId: 'sid',
        layoutFlag: 1024,
        viewportId: 'vp-id',
        handle: '20',
        ownerObjectId: '3'
      } as any,
      model
    )

    expect(layout.layoutName).toBe('Model')
    expect(layout.blockTableRecordId).toBe('1A')
    expect(layout.modelType).toBe(true)
    expect(layout.viewportArray).toContain('vp-id')
    expect(layout.shadePlotId).toBe('sid')
    expect(layout.ownerId).toBe('3')
  })

  it('converts paper layout with block fallback', () => {
    acdbHostApplicationServices().workingDatabase = new AcDbDatabase()
    const converter = new AcDbObjectConverter()
    const model = {
      tables: {
        BLOCK_RECORD: {
          entries: [
            { name: '*Paper_Space0', handle: '2A', layoutObjects: 'L1' }
          ]
        }
      }
    } as any

    const layout = converter.convertLayout(
      {
        layoutName: 'Layout1',
        tabOrder: 1,
        pageSetupName: '',
        configName: '',
        paperSize: '',
        plotViewName: '',
        currentStyleSheet: '',
        marginLeft: 0,
        marginRight: 0,
        marginTop: 0,
        marginBottom: 0,
        paperWidth: 0,
        paperHeight: 0,
        plotOriginX: 0,
        plotOriginY: 0,
        windowAreaXMin: 0,
        windowAreaYMin: 0,
        windowAreaXMax: 0,
        windowAreaYMax: 0,
        printScaleNumerator: 1,
        printScaleDenominator: 1,
        plotPaperUnit: 0,
        plotRotation: 0,
        plotType: 0,
        standardScaleType: 0,
        shadePlotMode: 0,
        shadePlotResolution: 0,
        handle: 'L1',
        ownerObjectId: '3',
        paperSpaceTableId: 'fallback-btr'
      } as any,
      model
    )

    expect(layout.blockTableRecordId).toBe('2A')

    const layoutFallback = converter.convertLayout(
      {
        ...(layout as any),
        handle: 'L2',
        layoutName: 'Layout2',
        paperSpaceTableId: 'fallback-btr'
      } as any,
      model
    )
    expect(layoutFallback.blockTableRecordId).toBe('fallback-btr')
  })

  it('preserves default ownership when DXF object metadata omits owner id', () => {
    acdbHostApplicationServices().workingDatabase = new AcDbDatabase()
    const converter = new AcDbObjectConverter()

    const image = converter.convertImageDef({
      fileName: 'b.png',
      handle: '30'
    } as any)

    expect(image.objectId).toBe('30')
    expect(image.getAttrWithoutException('ownerId')).toBeUndefined()
  })
})
