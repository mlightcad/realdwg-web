import { AcCmColor } from '@mlightcad/common'
import DxfParser, {
  InsertEntity,
  MTextEntity,
  ParsedDxf,
  TextEntity
} from '@mlightcad/dxf-json'
import { DxfBlock } from '@mlightcad/dxf-json/dist/parser/blocks/types'
import { CommonDxfEntity } from '@mlightcad/dxf-json/dist/parser/entities/shared'
import { ImageDefDXFObject } from '@mlightcad/dxf-json/dist/parser/objects/imageDef'
import { LayoutDXFObject } from '@mlightcad/dxf-json/dist/parser/objects/layout'
import { CommonDxfTableEntry } from '@mlightcad/dxf-json/dist/parser/tables'
import {
  AcGiDefaultLightingType,
  AcGiOrthographicType,
  AcGiRenderMode
} from '@mlightcad/graphic-interface'

import {
  AcDbBlockTable,
  AcDbBlockTableRecord,
  AcDbDatabase,
  AcDbDimStyleTableRecord,
  AcDbDimStyleTableRecordAttrs,
  AcDbDimTextHorizontal,
  AcDbDimTextVertical,
  AcDbDimVerticalJustification,
  AcDbDimZeroSuppression,
  AcDbDimZeroSuppressionAngular,
  AcDbLayerTableRecord,
  AcDbLinetypeTableRecord,
  AcDbSymbolTableRecord,
  AcDbTextStyleTableRecord,
  AcDbViewportTableRecord
} from '../database'
import {
  AcDbConversionProgressCallback,
  AcDbDatabaseConverter
} from '../database/AcDbDatabaseConverter'
import { AcDbBatchProcessing } from './AcDbBatchProcessing'
import { AcDbEntityConverter } from './AcDbEntitiyConverter'
import { AcDbObjectConverter } from './AcDbObjectConverter'

/**
 * Default database converter for DXF files.
 */
export class AcDbDxfConverter extends AcDbDatabaseConverter<ParsedDxf> {
  protected parse(data: string): ParsedDxf {
    const parser = new DxfParser()
    return parser.parseSync(data)
  }

  /**
   * Get all of fonts used by entities in model space and paper space
   * @param dxf Input parsed dxf model
   * @returns Return all of fonts used by entities in model space and paper space
   */
  protected getFonts(dxf: ParsedDxf) {
    // Build text style map. The key is text style name, and the value is font name list.
    const styleMap = new Map<string, string[]>()
    const getFontName = (fontFileName: string) => {
      if (fontFileName) {
        const lastDotIndex = fontFileName.lastIndexOf('.')
        if (lastDotIndex >= 0) {
          return fontFileName.substring(0, lastDotIndex).toLowerCase()
        } else {
          return fontFileName.toLowerCase()
        }
      }
    }
    dxf.tables.STYLE?.entries.forEach(style => {
      const fontNames: string[] = []
      let fontName = getFontName(style.font)
      if (fontName) fontNames.push(fontName)
      fontName = getFontName(style.bigFont)
      if (fontName) fontNames.push(fontName)
      styleMap.set(style.name, fontNames)
    })

    const fonts: Set<string> = new Set<string>()
    this.getFontsInBlock(dxf.entities, dxf.blocks, styleMap, fonts)
    return Array.from(fonts)
  }

  /**
   * Iterate entities in model space to get fonts used by text, mtext and insert entities
   */
  private getFontsInBlock(
    entities: CommonDxfEntity[],
    blockMap: Record<string, DxfBlock>,
    styleMap: Map<string, string[]>,
    fonts: Set<string>
  ) {
    const regex = /\\f(.*?)\|/g
    entities.forEach(entity => {
      if (entity.type == 'MTEXT') {
        const mtext = entity as MTextEntity
        const text = mtext.text.join('')
        ;[...text.matchAll(regex)].forEach(match => {
          fonts.add(match[1].toLowerCase())
        })
        const fontNames = styleMap.get(mtext.styleName)
        fontNames?.forEach(name => fonts.add(name))
      } else if (entity.type == 'TEXT') {
        const text = entity as TextEntity
        const fontNames = styleMap.get(text.styleName)
        fontNames?.forEach(name => fonts.add(name))
      } else if (entity.type == 'INSERT') {
        const insert = entity as InsertEntity
        const block = blockMap[insert.name]
        if (block && block.entities)
          this.getFontsInBlock(block.entities, blockMap, styleMap, fonts)
      }
    })
  }

  /**
   * Breaks up the work into smaller chunks that are executed asynchronously. This is often referred to
   * as "batch processing" or "cooperative multitasking," where the time-consuming task is broken into
   * smaller pieces and executed in small intervals to allow the UI to remain responsive.
   */
  protected async processEntities(
    dxf: ParsedDxf,
    db: AcDbDatabase,
    minimumChunkSize: number,
    startPercentage: { value: number },
    progress?: AcDbConversionProgressCallback
  ) {
    const converter = new AcDbEntityConverter()

    // Create an instance of AcDbBatchProcessing
    const entities = dxf.entities
    const entityCount = entities.length
    const batchProcessor = new AcDbBatchProcessing(
      entityCount,
      100 - startPercentage.value,
      minimumChunkSize
    )

    // Process the entities in chunks
    const defaultBlockTableRecord = db.tables.blockTable.modelSpace
    const blockTable = db.tables.blockTable
    await batchProcessor.processChunk(async (start, end) => {
      // Logic for processing each chunk of entities
      for (let i = start; i < end; i++) {
        const entity = entities[i]
        const dbEntity = converter.convert(entity)
        if (dbEntity) {
          let blockTableRecord = defaultBlockTableRecord
          if (entity.ownerBlockRecordSoftId != null) {
            blockTableRecord =
              blockTable.getIdAt(entity.ownerBlockRecordSoftId) ||
              blockTableRecord
          }
          blockTableRecord.appendEntity(dbEntity)
        }
      }

      // Update progress
      if (progress) {
        let percentage =
          startPercentage.value +
          (end / entityCount) * (100 - startPercentage.value)
        if (percentage > 100) percentage = 100
        await progress(percentage, 'ENTITY', 'IN-PROGRESS')
      }
    })
  }

  private async processEntitiesInBlock(
    entities: CommonDxfEntity[],
    defaultBlockTableRecord: AcDbBlockTableRecord,
    blockTable: AcDbBlockTable
  ) {
    const converter = new AcDbEntityConverter()
    const entityCount = entities.length
    for (let i = 0; i < entityCount; i++) {
      const entity = entities[i]
      const dbEntity = converter.convert(entity)
      if (dbEntity) {
        let blockTableRecord = defaultBlockTableRecord
        if (entity.ownerBlockRecordSoftId != null) {
          blockTableRecord =
            blockTable.getIdAt(entity.ownerBlockRecordSoftId) ||
            blockTableRecord
        }
        blockTableRecord.appendEntity(dbEntity)
      }
    }
  }

  protected processBlocks(model: ParsedDxf, db: AcDbDatabase) {
    const blocks = model.blocks
    for (const [name, block] of Object.entries(blocks)) {
      let dbBlock = db.tables.blockTable.getAt(block.name)
      if (!dbBlock) {
        dbBlock = new AcDbBlockTableRecord()
        dbBlock.objectId = block.handle
        // dbBlock.ownerId = block.ownerHandle
        dbBlock.name = name
        dbBlock.origin.copy(block.position)
        db.tables.blockTable.add(dbBlock)
      }
      if (block.entities) {
        this.processEntitiesInBlock(
          block.entities,
          dbBlock,
          db.tables.blockTable
        )
      }
    }
  }

  protected processHeader(model: ParsedDxf, db: AcDbDatabase) {
    const header = model.header
    // TODO: Check not supported versions

    // Color index 256 is 'ByLayer'
    db.cecolor.colorIndex = header['$CECOLOR'] || 256
    db.angBase = header['$ANGBASE'] || 0
    db.angDir = header['$ANGDIR'] || 0
    db.aunits = header['$AUNITS']
    db.insunits = header['$INSUNITS']
    db.pdmode = header['$PDMODE'] || 0
    db.pdsize = header['$PDSIZE'] || 0.0
  }

  protected processBlockTables(dxf: ParsedDxf, db: AcDbDatabase) {
    const btrs = dxf.tables.BLOCK_RECORD?.entries
    if (btrs && btrs.length > 0) {
      db.tables.blockTable.removeAll()
      btrs.forEach(btr => {
        const dbBlock = new AcDbBlockTableRecord()
        dbBlock.objectId = btr.handle
        dbBlock.name = btr.name
        db.tables.blockTable.add(dbBlock)
      })
    }
  }

  protected processObjects(model: ParsedDxf, db: AcDbDatabase) {
    const objects = model.objects.byName
    const objectConverter = new AcDbObjectConverter()
    if ('LAYOUT' in objects) {
      const layoutDict = db.dictionaries.layouts
      objects['LAYOUT'].forEach(layout => {
        const dbLayout = objectConverter.convertLayout(
          layout as LayoutDXFObject
        )
        layoutDict.setAt(dbLayout.layoutName, dbLayout)
      })
    }
    if ('IMAGEDEF' in objects) {
      const imageDefDict = db.dictionaries.imageDefs
      objects['IMAGEDEF'].forEach(imageDef => {
        const dbImageDef = objectConverter.convertImageDef(
          imageDef as ImageDefDXFObject
        )
        imageDefDict.setAt(dbImageDef.objectId, dbImageDef)
      })
    }
  }

  protected processViewports(model: ParsedDxf, db: AcDbDatabase) {
    const viewports = model.tables?.VPORT?.entries
    if (viewports && viewports.length > 0) {
      viewports.forEach(item => {
        const record = new AcDbViewportTableRecord()
        this.processCommonTableEntryAttrs(item, record)
        if (item.circleSides) {
          record.circleSides = item.circleSides
        }
        record.standardFlag = item.standardFlag
        record.center.copy(item.center)
        record.lowerLeftCorner.copy(item.lowerLeftCorner)
        record.upperRightCorner.copy(item.upperRightCorner)
        if (item.snapBasePoint) {
          record.snapBase.copy(item.snapBasePoint)
        }
        if (item.snapRotationAngle) {
          record.snapAngle = item.snapRotationAngle
        }
        if (item.snapSpacing) {
          record.snapIncrements.copy(item.snapSpacing)
        }
        if (item.majorGridLines) {
          record.gridMajor = item.majorGridLines
        }
        if (item.gridSpacing) {
          record.gridIncrements.copy(item.gridSpacing)
        }
        if (item.backgroundObjectId) {
          record.backgroundObjectId = item.backgroundObjectId
        }

        record.gsView.center.copy(item.center)
        record.gsView.viewDirectionFromTarget.copy(item.viewDirectionFromTarget)
        record.gsView.viewTarget.copy(item.viewTarget)
        if (item.lensLength) {
          record.gsView.lensLength = item.lensLength
        }
        if (item.frontClippingPlane) {
          record.gsView.frontClippingPlane = item.frontClippingPlane
        }
        if (item.backClippingPlane) {
          record.gsView.backClippingPlane = item.backClippingPlane
        }
        if (item.viewHeight) {
          record.gsView.viewHeight = item.viewHeight
        }
        if (item.viewTwistAngle) {
          record.gsView.viewTwistAngle = item.viewTwistAngle
        }
        if (item.frozenLayers) {
          record.gsView.frozenLayers = item.frozenLayers
        }
        if (item.styleSheet) {
          record.gsView.styleSheet = item.styleSheet
        }
        if (item.renderMode) {
          record.gsView.renderMode =
            item.renderMode as unknown as AcGiRenderMode
        }
        if (item.viewMode) {
          record.gsView.viewMode = item.viewMode
        }
        if (item.ucsIconSetting) {
          record.gsView.ucsIconSetting = item.ucsIconSetting
        }
        if (item.ucsOrigin) {
          record.gsView.ucsOrigin.copy(item.ucsOrigin)
        }
        if (item.ucsXAxis) {
          record.gsView.ucsXAxis.copy(item.ucsXAxis)
        }
        if (item.ucsYAxis) {
          record.gsView.ucsYAxis.copy(item.ucsYAxis)
        }
        if (item.orthographicType) {
          record.gsView.orthographicType =
            item.orthographicType as unknown as AcGiOrthographicType
        }
        if (item.shadePlotSetting) {
          record.gsView.shadePlotSetting = item.shadePlotSetting
        }
        if (item.shadePlotObjectId) {
          record.gsView.shadePlotObjectId = item.shadePlotObjectId
        }
        if (item.visualStyleObjectId) {
          record.gsView.visualStyleObjectId = item.visualStyleObjectId
        }
        if (item.isDefaultLightingOn) {
          record.gsView.isDefaultLightingOn = item.isDefaultLightingOn
        }
        if (item.defaultLightingType) {
          record.gsView.defaultLightingType =
            item.defaultLightingType as unknown as AcGiDefaultLightingType
        }
        if (item.brightness) {
          record.gsView.brightness = item.brightness
        }
        if (item.contrast) {
          record.gsView.contrast = item.contrast
        }
        if (item.ambientColor) {
          record.gsView.ambientColor = item.ambientColor
        }
        db.tables.viewportTable.add(record)
      })
    }
  }

  protected processLayers(model: ParsedDxf, db: AcDbDatabase) {
    const layers = model.tables?.LAYER?.entries
    if (layers && layers.length > 0) {
      layers.forEach(item => {
        const color = new AcCmColor()
        color.colorIndex = item.colorIndex
        const record = new AcDbLayerTableRecord({
          name: item.name,
          standardFlags: item.standardFlag,
          linetype: item.lineType,
          lineWeight: item.lineweight,
          isOff: item.colorIndex < 0,
          color: color,
          isPlottable: item.isPlotting
        })
        this.processCommonTableEntryAttrs(item, record)
        db.tables.layerTable.add(record)
      })
    }
  }

  protected processLineTypes(model: ParsedDxf, db: AcDbDatabase) {
    const lineTypes = model.tables?.LTYPE?.entries
    if (lineTypes && lineTypes.length > 0) {
      lineTypes.forEach(item => {
        const record = new AcDbLinetypeTableRecord(item)
        this.processCommonTableEntryAttrs(item, record)
        record.name = item.name
        db.tables.linetypeTable.add(record)
      })
    }
  }

  protected processTextStyles(model: ParsedDxf, db: AcDbDatabase) {
    const textStyles = model.tables.STYLE?.entries
    if (textStyles && textStyles.length > 0) {
      textStyles.forEach(item => {
        const record = new AcDbTextStyleTableRecord(item)
        this.processCommonTableEntryAttrs(item, record)
        db.tables.textStyleTable.add(record)
      })
    }
  }

  protected processDimStyles(model: ParsedDxf, db: AcDbDatabase) {
    const dimStyles = model.tables.DIMSTYLE?.entries
    if (dimStyles && dimStyles.length > 0) {
      dimStyles.forEach(item => {
        const attrs: AcDbDimStyleTableRecordAttrs = {
          name: item.name,
          ownerId: item.ownerObjectId,
          dimpost: item.DIMPOST || '',
          dimapost: item.DIMAPOST || '',
          dimscale: item.DIMSCALE,
          dimasz: item.DIMASZ,
          dimexo: item.DIMEXO,
          dimdli: item.DIMDLI,
          dimexe: item.DIMEXE,
          dimrnd: item.DIMRND,
          dimdle: item.DIMDLE,
          dimtp: item.DIMTP,
          dimtm: item.DIMTM,
          dimtxt: item.DIMTXT,
          dimcen: item.DIMCEN,
          dimtsz: item.DIMTSZ,
          dimaltf: item.DIMALTF,
          dimlfac: item.DIMLFAC,
          dimtvp: item.DIMTVP,
          dimtfac: item.DIMTFAC,
          dimgap: item.DIMGAP,
          dimaltrnd: item.DIMALTRND,
          dimtol: item.DIMTOL == null || item.DIMTOL == 0 ? 0 : 1,
          dimlim: item.DIMLIM == null || item.DIMLIM == 0 ? 0 : 1,
          dimtih: item.DIMTIH == null || item.DIMTIH == 0 ? 0 : 1,
          dimtoh: item.DIMTOH == null || item.DIMTOH == 0 ? 0 : 1,
          dimse1: item.DIMSE1 == null || item.DIMSE1 == 0 ? 0 : 1,
          dimse2: item.DIMSE2 == null || item.DIMSE2 == 0 ? 0 : 1,
          dimtad: item.DIMTAD as unknown as AcDbDimTextVertical.Center,
          dimzin: item.DIMZIN as unknown as AcDbDimZeroSuppression.Feet,
          dimazin:
            item.DIMAZIN as unknown as AcDbDimZeroSuppressionAngular.None,
          dimalt: item.DIMALT,
          dimaltd: item.DIMALTD,
          dimtofl: item.DIMTOFL,
          dimsah: item.DIMSAH,
          dimtix: item.DIMTIX,
          dimsoxd: item.DIMSOXD,
          dimclrd: item.DIMCLRD,
          dimclre: item.DIMCLRE,
          dimclrt: item.DIMCLRT,
          dimadec: item.DIMADEC || 0,
          dimunit: item.DIMUNIT || 2,
          dimdec: item.DIMDEC,
          dimtdec: item.DIMTDEC,
          dimaltu: item.DIMALTU,
          dimalttd: item.DIMALTTD,
          dimaunit: item.DIMAUNIT,
          dimfrac: item.DIMFRAC,
          dimlunit: item.DIMLUNIT,
          dimdsep: item.DIMDSEP,
          dimtmove: item.DIMTMOVE || 0,
          dimjust: item.DIMJUST as unknown as AcDbDimTextHorizontal.Center,
          dimsd1: item.DIMSD1,
          dimsd2: item.DIMSD2,
          dimtolj:
            item.DIMTOLJ as unknown as AcDbDimVerticalJustification.Bottom,
          dimtzin: item.DIMTZIN as unknown as AcDbDimZeroSuppression.Feet,
          dimaltz: item.DIMALTZ as unknown as AcDbDimZeroSuppression.Feet,
          dimalttz: item.DIMALTTZ as unknown as AcDbDimZeroSuppression.Feet,
          dimfit: item.DIMFIT || 0,
          dimupt: item.DIMUPT,
          dimatfit: item.DIMATFIT,
          dimtxsty: item.DIMTXSTY || 'Standard',
          dimldrblk: item.DIMLDRBLK || '',
          dimblk: item.DIMBLK || '',
          dimblk1: item.DIMBLK1 || '',
          dimblk2: item.DIMBLK2 || '',
          dimlwd: item.DIMLWD,
          dimlwe: item.DIMLWE
        }
        const record = new AcDbDimStyleTableRecord(attrs)
        this.processCommonTableEntryAttrs(item, record)
        db.tables.dimStyleTable.add(record)
      })
    }
  }

  private processCommonTableEntryAttrs(
    entry: CommonDxfTableEntry,
    dbEntry: AcDbSymbolTableRecord
  ) {
    dbEntry.name = entry.name
    dbEntry.objectId = entry.handle
    dbEntry.ownerId = entry.ownerObjectId
  }
}
