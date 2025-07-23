/* eslint-disable simple-import-sort/imports */
import { AcCmColor, AcCmEventManager } from '@mlightcad/common'

import { AcDbObject, AcDbObjectId } from '../base'
import {
  AcDbDatabaseConverterManager,
  AcDbFileType
} from './AcDbDatabaseConverterManager'
import { AcDbEntity } from '../entity'
import { AcDbAngleUnits, AcDbUnitsValue } from '../misc'
import {
  AcDbDictionary,
  AcDbLayout,
  AcDbLayoutDictionary,
  AcDbRasterImageDef
} from '../object'
import { AcDbBlockTable } from './AcDbBlockTable'
import { AcDbBlockTableRecord } from './AcDbBlockTableRecord'
import {
  AcDbConversionStage,
  AcDbConversionStageStatus
} from './AcDbDatabaseConverter'
import { AcDbDimStyleTable } from './AcDbDimStyleTable'
import { AcDbLayerTable } from './AcDbLayerTable'
import {
  AcDbLayerTableRecord,
  AcDbLayerTableRecordAttrs
} from './AcDbLayerTableRecord'
import { AcDbLinetypeTable } from './AcDbLinetypeTable'
import { AcDbTextStyleTable } from './AcDbTextStyleTable'
import { AcDbViewportTable } from './AcDbViewportTable'

export interface AcDbEntityEventArgs {
  database: AcDbDatabase
  entity: AcDbEntity
}

export interface AcDbLayerEventArgs {
  database: AcDbDatabase
  layer: AcDbLayerTableRecord
}

export interface AcDbLayerModifiedEventArgs extends AcDbLayerEventArgs {
  changes: Partial<AcDbLayerTableRecordAttrs>
}

export interface AcDbProgressdEventArgs {
  database: AcDbDatabase
  percentage: number
  stage: AcDbConversionStage
  stageStatus: AcDbConversionStageStatus
}

export interface AcDbHeaderSysVarEventArgs {
  database: AcDbDatabase
  name: string
}

/**
 * Font information
 */
export interface AcDbFontInfo {
  name: string[]
  file: string
  type: 'woff' | 'shx'
  url: string
}

/**
 * The application should implmement this interface to load fonts when opening one document.
 */
export interface AcDbFontLoader {
  /**
   * Load the specified fonts
   * @param fontNames Input font name list
   */
  load(fontNames: string[]): Promise<void>

  /**
   * Get all of avaiable fonts
   */
  getAvaiableFonts(): Promise<AcDbFontInfo[]>
}

/**
 * Options to read drawing database
 */
export interface AcDbOpenDatabaseOptions {
  /**
   * Open the drawing database in read-only mode.
   */
  readOnly?: boolean
  /**
   * Loader used to load fonts used in the drawing database.
   */
  fontLoader?: AcDbFontLoader
  /**
   * The minimum number of items in one chunk. If it is greater than the total
   * number of entities in the drawing database, the total number is used.
   */
  minimumChunkSize?: number
}

export interface AcDbTables {
  readonly blockTable: AcDbBlockTable
  readonly dimStyleTable: AcDbDimStyleTable
  readonly linetypeTable: AcDbLinetypeTable
  readonly textStyleTable: AcDbTextStyleTable
  readonly layerTable: AcDbLayerTable
  readonly viewportTable: AcDbViewportTable
}

export interface AcDbDictionaries {
  readonly layoutDictionary: AcDbDictionary<AcDbLayout>
}

/**
 * The AcDbDatabase class represents the AutoCAD drawing file. Each AcDbDatabase object contains
 * the various header variables, symbol tables, table records, entities, and objects that make up
 * the drawing. The AcDbDatabase class has member functions to allow access to all the symbol tables,
 * to read and write to DWG files, to get or set database defaults, to execute various database-level
 * operations, and to get or set all header variables.
 */
export class AcDbDatabase extends AcDbObject {
  private _angBase: number
  private _angDir: number
  private _aunits: AcDbAngleUnits
  private _cecolor: AcCmColor
  private _celtscale: number
  private _insunits: AcDbUnitsValue
  private _ltscale: number
  private _pdmode: number
  private _pdsize: number
  private _tables: AcDbTables
  private _dictionaries: {
    readonly layouts: AcDbLayoutDictionary
    readonly imageDefs: AcDbDictionary<AcDbRasterImageDef>
  }
  private _currentSpace?: AcDbBlockTableRecord
  public readonly events = {
    entityAppended: new AcCmEventManager<AcDbEntityEventArgs>(),
    entityModified: new AcCmEventManager<AcDbEntityEventArgs>(),
    layerAppended: new AcCmEventManager<AcDbLayerEventArgs>(),
    layerModified: new AcCmEventManager<AcDbLayerModifiedEventArgs>(),
    layerErased: new AcCmEventManager<AcDbLayerEventArgs>(),
    openProgress: new AcCmEventManager<AcDbProgressdEventArgs>(),
    headerSysVarChanged: new AcCmEventManager<AcDbHeaderSysVarEventArgs>()
  }

  /**
   * Default constructor.
   * If buildDefaultDrawing == true, then the new AcDbDatabase object contains the minimum necessary
   * for a complete database. If buildDefaultDrawing == false, then the new AcDbDatabase object is
   * completely empty.
   */
  constructor() {
    super()
    this._angBase = 0
    this._angDir = 0
    this._aunits = AcDbAngleUnits.DecimalDegrees
    this._celtscale = 1
    this._cecolor = new AcCmColor()
    // TODO: Default value is 1 (imperial) or 4 (metric)
    this._insunits = AcDbUnitsValue.Millimeters
    this._ltscale = 1
    this._pdmode = 0
    this._pdsize = 0
    this._tables = {
      blockTable: new AcDbBlockTable(this),
      dimStyleTable: new AcDbDimStyleTable(this),
      linetypeTable: new AcDbLinetypeTable(this),
      textStyleTable: new AcDbTextStyleTable(this),
      layerTable: new AcDbLayerTable(this),
      viewportTable: new AcDbViewportTable(this)
    }
    this._dictionaries = {
      layouts: new AcDbLayoutDictionary(this),
      imageDefs: new AcDbDictionary(this)
    }
  }

  /**
   * All of tables in this drawing database
   */
  get tables() {
    return this._tables
  }

  /**
   * All of named object dictionaries in this drawing database
   */
  get dictionaries() {
    return this._dictionaries
  }

  /**
   * The object ID of the AcDbBlockTableRecord of the current space (e.g., model space or paper space.)
   */
  get currentSpaceId() {
    if (!this._currentSpace) {
      this._currentSpace = this._tables.blockTable.modelSpace
    }
    return this._currentSpace.objectId
  }
  set currentSpaceId(value: AcDbObjectId) {
    const currentSpace = this.tables.blockTable.getIdAt(value)
    if (currentSpace == null) {
      throw new Error(
        `[AcDbDatabase] The specified block table record id '${value}' doesn't exist in the drawing database!`
      )
    } else {
      this._currentSpace = currentSpace
    }
  }

  /**
   * Angle units. It is the current AUNITS value for the database.
   */
  get aunits(): number {
    return this._aunits
  }
  set aunits(value: number) {
    this._aunits = value || 0
    this.triggerHeaderSysVarChangedEvent('aunits')
  }

  /**
   * The drawing-units value for automatic scaling of blocks, images, or xrefs when inserted or attached
   * to a drawing. It is the current INSUNITS value for the database.
   */
  get insunits(): number {
    return this._insunits
  }
  set insunits(value: number) {
    // TODO: Default value is 1 (imperial) or 4 (metric)
    this._insunits = value || 4
    this.triggerHeaderSysVarChangedEvent('insunits')
  }

  /**
   * The line type scale factor.
   */
  get ltscale(): number {
    return this._ltscale
  }
  set ltscale(value: number) {
    this._ltscale = value || 1
    this.triggerHeaderSysVarChangedEvent('ltscale')
  }

  /**
   * The color of new objects as you create them.
   */
  get cecolor(): AcCmColor {
    return this._cecolor
  }
  set cecolor(value: AcCmColor) {
    this._cecolor = value || 0
    this.triggerHeaderSysVarChangedEvent('cecolor')
  }

  /**
   * The line type scaling for new objects relative to the ltscale setting. A line created with
   * celtscale = 2 in a drawing with ltscale set to 0.5 would appear the same as a line created
   * with celtscale = 1 in a drawing with ltscale = 1.
   */
  get celtscale(): number {
    return this._celtscale
  }
  set celtscale(value: number) {
    this._celtscale = value || 1
    this.triggerHeaderSysVarChangedEvent('celtscale')
  }

  /**
   * The zero (0) base angle with respect to the current UCS in radians.
   */
  get angBase(): number {
    return this._angBase
  }
  set angBase(value: number) {
    this._angBase = value || 0
    this.triggerHeaderSysVarChangedEvent('angbase')
  }

  /**
   * The direction of positive angles.
   * - 0: Counterclockwise
   * - 1: Clockwise
   */
  get angDir(): number {
    return this._angDir
  }
  set angDir(value: number) {
    this._angDir = value || 0
    this.triggerHeaderSysVarChangedEvent('angdir')
  }

  /**
   * Point display mode. Please get more details on value of this property from [this page](https://help.autodesk.com/view/ACDLT/2022/ENU/?guid=GUID-82F9BB52-D026-4D6A-ABA6-BF29641F459B).
   */
  get pdmode(): number {
    return this._pdmode
  }
  set pdmode(value: number) {
    this._pdmode = value || 0
    this.triggerHeaderSysVarChangedEvent('pdmode')
  }

  /**
   * Point display size.
   * - 0: Create a point at 5 percent of the drawing area height
   * - > 0: Specifie an absolute size
   * - < 0: Specifie a percentage of the viewport size
   */
  get pdsize(): number {
    return this._pdsize
  }
  set pdsize(value: number) {
    this._pdsize = value || 0
    this.triggerHeaderSysVarChangedEvent('pdsize')
  }

  /**
   * Read AutoCAD drawing specified by data into the database object.
   * @param data Input contents of one AutoCAD file
   * @param options Input options to read drawing data
   * @param fileType Input file type of the drawing
   */
  async read(
    data: string | ArrayBuffer,
    options: AcDbOpenDatabaseOptions,
    fileType: AcDbFileType = AcDbFileType.DXF
  ) {
    const converter = AcDbDatabaseConverterManager.instance.get(fileType)
    if (converter == null)
      throw new Error(
        `Database converter for file type '${fileType}' isn't registered and can can't read this file!`
      )

    this.clear()

    await converter.read(
      data,
      this,
      (options && options.minimumChunkSize) || 10,
      async (
        percentage: number,
        stage: AcDbConversionStage,
        stageStatus: AcDbConversionStageStatus,
        data?: unknown
      ) => {
        this.events.openProgress.dispatch({
          database: this,
          percentage: percentage,
          stage: stage,
          stageStatus: stageStatus
        })
        if (
          options &&
          options.fontLoader &&
          stage == 'FONT' &&
          stageStatus == 'END'
        ) {
          const fonts = data
            ? (data as string[])
            : this.tables.textStyleTable.fonts
          await options.fontLoader.load(fonts)
        }
      }
    )
  }

  /**
   * Read AutoCAD DXF drawing specified by the URL into the database object.
   * @param url Input the URL linked to one AutoCAD DXF file
   * @param options Input options to read drawing data
   */
  async openUri(url: string, options: AcDbOpenDatabaseOptions): Promise<void> {
    const response = await fetch(url)
    const blob = await response.blob()

    const reader = new FileReader()
    reader.onload = event => {
      const content = event.target?.result
      if (content) this.read(content as string, options)
    }

    reader.readAsText(blob)
  }

  /**
   * Clear drawing database. It is needed when opening one drawing.
   */
  private clear() {
    this.tables.blockTable.removeAll()
    this.tables.dimStyleTable.removeAll()
    this.tables.layerTable.removeAll()
    this.tables.linetypeTable.removeAll()
    this.tables.textStyleTable.removeAll()
    this.tables.viewportTable.removeAll()
    this.dictionaries.layouts.removeAll()
    this._currentSpace = undefined
  }

  private triggerHeaderSysVarChangedEvent(sysVarName: string) {
    this.events.headerSysVarChanged.dispatch({
      database: this,
      name: sysVarName
    })
  }
}
/* eslint-enable simple-import-sort/imports */
