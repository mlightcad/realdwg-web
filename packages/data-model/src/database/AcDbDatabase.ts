/* eslint-disable simple-import-sort/imports */
import { AcCmColor, AcCmEventManager } from '@mlightcad/common'

import { AcDbObject, AcDbObjectId } from '../base'
import { AcDbRegenerator } from '../converter'
import {
  AcDbConverterType,
  AcDbDatabaseConverterManager,
  AcDbFileType
} from './AcDbDatabaseConverterManager'
import { AcDbEntity } from '../entity'
import { AcDbAngleUnits, AcDbDataGenerator, AcDbUnitsValue } from '../misc'
import {
  AcDbDictionary,
  AcDbLayoutDictionary,
  AcDbRasterImageDef,
  AcDbXrecord
} from '../object'
import { AcDbBlockTable } from './AcDbBlockTable'
import { AcDbBlockTableRecord } from './AcDbBlockTableRecord'
import { AcDbConversionStage, AcDbStageStatus } from './AcDbDatabaseConverter'
import { AcDbDimStyleTable } from './AcDbDimStyleTable'
import { AcDbLayerTable } from './AcDbLayerTable'
import {
  AcDbLayerTableRecord,
  AcDbLayerTableRecordAttrs
} from './AcDbLayerTableRecord'
import { AcDbLinetypeTable } from './AcDbLinetypeTable'
import { AcDbTextStyleTable } from './AcDbTextStyleTable'
import { AcDbViewportTable } from './AcDbViewportTable'
import {
  AcGeBox3d,
  AcGePoint3d,
  AcGePoint3dLike
} from '@mlightcad/geometry-engine'
import { AcDbDwgVersion } from './AcDbDwgVersion'

/**
 * Event arguments for object events in the dictionary.
 */
export interface AcDbDictObjectEventArgs {
  /** The database that triggered the event */
  database: AcDbDatabase
  /** The object (or objects) involved in the event */
  object: AcDbObject | AcDbObject[]
  /** The key name of the object */
  key: string
}

/**
 * Event arguments for entity-related events.
 */
export interface AcDbEntityEventArgs {
  /** The database that triggered the event */
  database: AcDbDatabase
  /** The entity (or entities) involved in the event */
  entity: AcDbEntity | AcDbEntity[]
}

/**
 * Event arguments for layer-related events.
 */
export interface AcDbLayerEventArgs {
  /** The database that triggered the event */
  database: AcDbDatabase
  /** The layer involved in the event */
  layer: AcDbLayerTableRecord
}

/**
 * Event arguments for layer modification events.
 */
export interface AcDbLayerModifiedEventArgs extends AcDbLayerEventArgs {
  /** The changes made to the layer */
  changes: Partial<AcDbLayerTableRecordAttrs>
}

/**
 * The stage of opening one drawing file
 */
export type AcDbOpenFileStage = 'FETCH_FILE' | 'CONVERSION'

/**
 * Event arguments for progress events during database operations.
 */
export interface AcDbProgressdEventArgs {
  /** The database that triggered the event */
  database: AcDbDatabase
  /** The progress percentage (0-100) */
  percentage: number
  /** The current stage of opening one drawing file */
  stage: AcDbOpenFileStage
  /** The current sub stage */
  subStage?: AcDbConversionStage
  /** The status of the current sub stage */
  subStageStatus: AcDbStageStatus
  /**
   * Store data associated with the current sub stage. Its meaning of different sub stages
   * are as follows.
   * - 'PARSE' stage: statistics of parsing task
   * - 'FONT' stage: fonts needed by this drawing
   *
   * Note: For now, 'PARSE' and 'FONT' sub stages use this field only.
   */
  data?: unknown
}

/**
 * Event arguments for header system variable changes.
 */
export interface AcDbHeaderSysVarEventArgs {
  /** The database that triggered the event */
  database: AcDbDatabase
  /** The name of the system variable that changed */
  name: string
}

/**
 * Font information structure.
 *
 * Contains information about a font including its name, file path,
 * type, and URL for loading.
 */
export interface AcDbFontInfo {
  /** Array of font names/aliases */
  name: string[]
  /** Font file name */
  file: string
  /** Font type (mesh or shx) */
  type: 'mesh' | 'shx'
  /** URL for loading the font */
  url: string
}

/**
 * Interface for loading fonts when opening a document.
 *
 * Applications should implement this interface to provide font loading
 * functionality when opening drawing databases that contain text entities.
 */
export interface AcDbFontLoader {
  /**
   * Loads the specified fonts.
   *
   * @param fontNames - Array of font names to load
   * @returns Promise that resolves when fonts are loaded
   *
   * @example
   * ```typescript
   * const fontLoader: AcDbFontLoader = {
   *   async load(fontNames: string[]) {
   *     // Load fonts implementation
   *   },
   *   async getAvaiableFonts() {
   *     return [];
   *   }
   * };
   * ```
   */
  load(fontNames: string[]): Promise<void>

  /**
   * Gets all available fonts.
   *
   * @returns Promise that resolves to an array of available font information
   *
   * @example
   * ```typescript
   * const fonts = await fontLoader.getAvaiableFonts();
   * console.log('Available fonts:', fonts);
   * ```
   */
  getAvaiableFonts(): Promise<AcDbFontInfo[]>
}

/**
 * Options for reading a drawing database.
 *
 * These options control how a drawing database is opened and processed.
 */
export interface AcDbOpenDatabaseOptions {
  /**
   * Opens the drawing database in read-only mode.
   *
   * When true, the database will be opened in read-only mode, preventing
   * any modifications to the database content.
   */
  readOnly?: boolean

  /**
   * Loader used to load fonts used in the drawing database.
   *
   * This loader will be used to load any fonts referenced by text entities
   * in the drawing database.
   */
  fontLoader?: AcDbFontLoader

  /**
   * The minimum number of items in one chunk.
   *
   * If this value is greater than the total number of entities in the
   * drawing database, the total number is used. This controls how the
   * database processing is broken into chunks for better performance.
   */
  minimumChunkSize?: number
}

/**
 * Interface defining the tables available in a drawing database.
 *
 * This interface provides access to all the symbol tables in the database,
 * including block table, dimension style table, linetype table, text style table,
 * layer table, and viewport table.
 */
export interface AcDbTables {
  /** Block table containing block definitions */
  readonly blockTable: AcDbBlockTable
  /** Dimension style table containing dimension style definitions */
  readonly dimStyleTable: AcDbDimStyleTable
  /** Linetype table containing linetype definitions */
  readonly linetypeTable: AcDbLinetypeTable
  /** Text style table containing text style definitions */
  readonly textStyleTable: AcDbTextStyleTable
  /** Layer table containing layer definitions */
  readonly layerTable: AcDbLayerTable
  /** Viewport table containing viewport definitions */
  readonly viewportTable: AcDbViewportTable
}

/**
 * Options used to specify default data to create
 */
export interface AcDbCreateDefaultDataOptions {
  layer?: boolean
  lineType?: boolean
  textStyle?: boolean
  dimStyle?: boolean
  layout?: boolean
}

/**
 * The AcDbDatabase class represents an AutoCAD drawing file.
 *
 * Each AcDbDatabase object contains the various header variables, symbol tables,
 * table records, entities, and objects that make up the drawing. The AcDbDatabase
 * class has member functions to allow access to all the symbol tables, to read
 * and write to DWG files, to get or set database defaults, to execute various
 * database-level operations, and to get or set all header variables.
 *
 * @example
 * ```typescript
 * const database = new AcDbDatabase();
 * await database.read(dxfData, { readOnly: true });
 * const entities = database.tables.blockTable.modelSpace.entities;
 * ```
 */
export class AcDbDatabase extends AcDbObject {
  /** Version of the database */
  private _version: AcDbDwgVersion
  /** Angle base for the database */
  private _angBase: number
  /** Angle direction for the database */
  private _angDir: number
  /** Angle units for the database */
  private _aunits: AcDbAngleUnits
  /** Current entity color */
  private _cecolor: AcCmColor
  /** Current entity linetype scale */
  private _celtscale: number
  /** Current layer for the database */
  private _clayer: string
  /** The extents of current Model Space */
  private _extents: AcGeBox3d
  /** Insertion units for the database */
  private _insunits: AcDbUnitsValue
  /** Global linetype scale */
  private _ltscale: number
  /** Point display mode */
  private _pdmode: number
  /** Point display size */
  private _pdsize: number
  /** Tables in the database */
  private _tables: AcDbTables
  /** Nongraphical objects in the database */
  private _objects: {
    readonly dictionary: AcDbDictionary<AcDbObject>
    readonly imageDefinition: AcDbDictionary<AcDbRasterImageDef>
    readonly layout: AcDbLayoutDictionary
    readonly xrecord: AcDbDictionary<AcDbXrecord>
  }
  /** Current space (model space or paper space) */
  private _currentSpace?: AcDbBlockTableRecord

  /**
   * Events that can be triggered by the database.
   *
   * These events allow applications to respond to various database operations
   * such as entity modifications, layer changes, and progress updates.
   */
  public readonly events = {
    /** Fired when an object is set to the dictionary */
    dictObjetSet: new AcCmEventManager<AcDbDictObjectEventArgs>(),
    /** Fired when an object in the dictionary is removed */
    dictObjectErased: new AcCmEventManager<AcDbDictObjectEventArgs>(),
    /** Fired when an entity is appended to the database */
    entityAppended: new AcCmEventManager<AcDbEntityEventArgs>(),
    /** Fired when an entity is modified in the database */
    entityModified: new AcCmEventManager<AcDbEntityEventArgs>(),
    /** Fired when an entity is erased from the database */
    entityErased: new AcCmEventManager<AcDbEntityEventArgs>(),
    /** Fired when a layer is appended to the database */
    layerAppended: new AcCmEventManager<AcDbLayerEventArgs>(),
    /** Fired when a layer is modified in the database */
    layerModified: new AcCmEventManager<AcDbLayerModifiedEventArgs>(),
    /** Fired when a layer is erased from the database */
    layerErased: new AcCmEventManager<AcDbLayerEventArgs>(),
    /** Fired during database opening operations to report progress */
    openProgress: new AcCmEventManager<AcDbProgressdEventArgs>(),
    /** Fired when a header system variable is changed */
    headerSysVarChanged: new AcCmEventManager<AcDbHeaderSysVarEventArgs>()
  }

  /**
   * Creates a new AcDbDatabase instance.
   */
  constructor() {
    super()
    this._version = new AcDbDwgVersion('AC1014')
    this._angBase = 0
    this._angDir = 0
    this._aunits = AcDbAngleUnits.DecimalDegrees
    this._celtscale = 1
    this._cecolor = new AcCmColor()
    this._clayer = '0'
    this._extents = new AcGeBox3d()
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
    this._objects = {
      dictionary: new AcDbDictionary(this),
      imageDefinition: new AcDbDictionary(this),
      layout: new AcDbLayoutDictionary(this),
      xrecord: new AcDbDictionary(this)
    }
  }

  /**
   * Gets all tables in this drawing database.
   *
   * @returns Object containing all the symbol tables in the database
   *
   * @example
   * ```typescript
   * const tables = database.tables;
   * const layers = tables.layerTable;
   * const blocks = tables.blockTable;
   * ```
   */
  get tables() {
    return this._tables
  }

  /**
   * Gets all nongraphical objects in this drawing database.
   *
   * @returns Object containing all nongraphical objects in the database
   *
   * @example
   * ```typescript
   * const objects = database.objects;
   * const layout = objects.layout;
   * ```
   */
  get objects() {
    return this._objects
  }

  /**
   * Gets the object ID of the AcDbBlockTableRecord of the current space.
   *
   * The current space can be either model space or paper space.
   *
   * @returns The object ID of the current space
   *
   * @example
   * ```typescript
   * const currentSpaceId = database.currentSpaceId;
   * ```
   */
  get currentSpaceId() {
    if (!this._currentSpace) {
      this._currentSpace = this._tables.blockTable.modelSpace
    }
    return this._currentSpace.objectId
  }

  /**
   * Sets the current space by object ID.
   *
   * @param value - The object ID of the block table record to set as current space
   * @throws {Error} When the specified block table record ID doesn't exist
   *
   * @example
   * ```typescript
   * database.currentSpaceId = 'some-block-record-id';
   * ```
   */
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
   * Gets the angle units for the database.
   *
   * This is the current AUNITS value for the database.
   *
   * @returns The angle units value
   *
   * @example
   * ```typescript
   * const angleUnits = database.aunits;
   * ```
   */
  get aunits(): number {
    return this._aunits
  }

  /**
   * Sets the angle units for the database.
   *
   * @param value - The new angle units value
   *
   * @example
   * ```typescript
   * database.aunits = AcDbAngleUnits.DecimalDegrees;
   * ```
   */
  set aunits(value: number) {
    this._aunits = value || 0
    this.triggerHeaderSysVarChangedEvent('aunits')
  }

  /**
   * Gets the version of the database.
   *
   * @returns The version of the database
   *
   */
  get version(): AcDbDwgVersion {
    return this._version
  }

  /**
   * Sets the version of the database.
   *
   * @param value - The version value of the database
   */
  set version(value: string | number) {
    this._version = new AcDbDwgVersion(value)
    this.triggerHeaderSysVarChangedEvent('version')
  }

  /**
   * Gets the drawing-units value for automatic scaling of blocks, images, or xrefs.
   *
   * This is the current INSUNITS value for the database.
   *
   * @returns The insertion units value
   *
   * @example
   * ```typescript
   * const insertionUnits = database.insunits;
   * ```
   */
  get insunits(): number {
    return this._insunits
  }

  /**
   * Sets the drawing-units value for automatic scaling.
   *
   * @param value - The new insertion units value
   *
   * @example
   * ```typescript
   * database.insunits = AcDbUnitsValue.Millimeters;
   * ```
   */
  set insunits(value: number) {
    // TODO: Default value is 1 (imperial) or 4 (metric)
    this._insunits = value || 4
    this.triggerHeaderSysVarChangedEvent('insunits')
  }

  /**
   * Gets the line type scale factor.
   *
   * @returns The line type scale factor
   *
   * @example
   * ```typescript
   * const lineTypeScale = database.ltscale;
   * ```
   */
  get ltscale(): number {
    return this._ltscale
  }

  /**
   * Sets the line type scale factor.
   *
   * @param value - The new line type scale factor
   *
   * @example
   * ```typescript
   * database.ltscale = 2.0;
   * ```
   */
  set ltscale(value: number) {
    this._ltscale = value || 1
    this.triggerHeaderSysVarChangedEvent('ltscale')
  }

  /**
   * Gets the color of new objects as they are created.
   *
   * @returns The current entity color
   *
   * @example
   * ```typescript
   * const currentColor = database.cecolor;
   * ```
   */
  get cecolor(): AcCmColor {
    return this._cecolor
  }

  /**
   * Sets the color of new objects as they are created.
   *
   * @param value - The new current entity color
   *
   * @example
   * ```typescript
   * database.cecolor = new AcCmColor(0xFF0000);
   * ```
   */
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
   * The layer of new objects as they are created.
   */
  get clayer(): string {
    return this._clayer
  }
  set clayer(value: string) {
    this._clayer = value || '0'
    this.triggerHeaderSysVarChangedEvent('clayer')
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
   * The current Model Space EXTMAX value
   */
  get extmax(): AcGePoint3d {
    return this._extents.max
  }
  set extmax(value: AcGePoint3dLike) {
    if (value) {
      this._extents.expandByPoint(value)
      this.triggerHeaderSysVarChangedEvent('extmax')
    }
  }

  /**
   * The current Model Space EXTMIN value
   */
  get extmin(): AcGePoint3d {
    return this._extents.min
  }
  set extmin(value: AcGePoint3dLike) {
    if (value) {
      this._extents.expandByPoint(value)
      this.triggerHeaderSysVarChangedEvent('extmin')
    }
  }

  /**
   * The extents of current Model Space
   */
  get extents() {
    return this._extents
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
   * - 0: Creates a point at 5 percent of the drawing area height
   * - > 0: Specifies an absolute size
   * - < 0: Specifies a percentage of the viewport size
   */
  get pdsize(): number {
    return this._pdsize
  }
  set pdsize(value: number) {
    this._pdsize = value || 0
    this.triggerHeaderSysVarChangedEvent('pdsize')
  }

  /**
   * Reads drawing data from a string or ArrayBuffer.
   *
   * This method parses the provided data and populates the database with
   * the resulting entities, tables, and objects. The method supports
   * both DXF and DWG file formats.
   *
   * @param data - The drawing data as a string or ArrayBuffer
   *   - For DXF files: Pass a string containing the DXF content
   *   - For DWG files: Pass an ArrayBuffer instance containing the binary DWG data
   * @param options - Options for reading the database
   * @param fileType - The type of file being read (defaults to DXF)
   *
   * @example
   * ```typescript
   * // Reading a DXF file (string)
   * const database = new AcDbDatabase();
   * await database.read(dxfString, { readOnly: true }, AcDbFileType.DXF);
   *
   * // Reading a DWG file (ArrayBuffer)
   * const database = new AcDbDatabase();
   * await database.read(dwgArrayBuffer, { readOnly: true }, AcDbFileType.DWG);
   * ```
   */
  async read(
    data: ArrayBuffer,
    options: AcDbOpenDatabaseOptions,
    fileType: AcDbConverterType = AcDbFileType.DXF
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
        stageStatus: AcDbStageStatus,
        data?: unknown
      ) => {
        this.events.openProgress.dispatch({
          database: this,
          percentage: percentage,
          stage: 'CONVERSION',
          subStage: stage,
          subStageStatus: stageStatus,
          data: data
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
   * Read AutoCAD DXF or DWG drawing specified by the URL into the database object.
   * The method automatically detects the file type based on the URL extension:
   * - .dxf files are read as text using readAsText()
   * - .dwg files are read as binary data using readAsArrayBuffer()
   * @param url Input the URL linked to one AutoCAD DXF or DWG file
   * @param options Input options to read drawing data
   */
  async openUri(url: string, options: AcDbOpenDatabaseOptions): Promise<void> {
    this.events.openProgress.dispatch({
      database: this,
      percentage: 0,
      stage: 'FETCH_FILE',
      subStageStatus: 'START'
    })

    const response = await fetch(url)
    if (!response.ok) {
      this.events.openProgress.dispatch({
        database: this,
        percentage: 100,
        stage: 'FETCH_FILE',
        subStageStatus: 'ERROR'
      })
      throw new Error(
        `Failed to fetch file '${url}' with HTTP status code '${response.status}'!`
      )
    }

    const contentLength = response.headers.get('content-length')
    const totalBytes = contentLength ? parseInt(contentLength, 10) : null
    let loadedBytes = 0

    // Create a reader to track progress
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Failed to get response reader')
    }

    const chunks = []

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      chunks.push(value)
      loadedBytes += value.length

      // Calculate and report progress if we know the total size
      if (totalBytes !== null) {
        const percentage = Math.round((loadedBytes / totalBytes) * 100)
        this.events.openProgress.dispatch({
          database: this,
          percentage: percentage,
          stage: 'FETCH_FILE',
          subStageStatus: 'IN-PROGRESS'
        })
      }
    }

    // Combine all chunks into a single buffer
    const content = new Uint8Array(loadedBytes)
    let position = 0
    for (const chunk of chunks) {
      content.set(chunk, position)
      position += chunk.length
    }

    const fileName = this.getFileNameFromUri(url)
    const fileExtension = fileName.toLowerCase().split('.').pop()
    if (fileExtension === 'dwg') {
      // DWG files are binary, convert to ArrayBuffer
      await this.read(content.buffer, options, AcDbFileType.DWG)
    } else if (fileExtension === 'dxf') {
      await this.read(content.buffer, options, AcDbFileType.DXF)
    } else {
      await this.read(content.buffer, options, fileExtension)
    }

    this.events.openProgress.dispatch({
      database: this,
      percentage: 100,
      stage: 'FETCH_FILE',
      subStageStatus: 'END'
    })
  }

  /**
   * Triggers xxxAppended events with data in the database to redraw the associated viewer.
   */
  async regen() {
    const converter = new AcDbRegenerator(this)
    await converter.read(
      null as unknown as ArrayBuffer,
      this,
      500,
      async (
        percentage: number,
        stage: AcDbConversionStage,
        stageStatus: AcDbStageStatus,
        data?: unknown
      ) => {
        this.events.openProgress.dispatch({
          database: this,
          percentage: percentage,
          stage: 'CONVERSION',
          subStage: stage,
          subStageStatus: stageStatus,
          data: data
        })
      }
    )
  }

  /**
   * Create default layer, line type, dimension type, text style and layout.
   * @param - Options to specify data to create
   */
  createDefaultData(
    options: AcDbCreateDefaultDataOptions = {
      layer: true,
      lineType: true,
      textStyle: true,
      dimStyle: true,
      layout: true
    }
  ) {
    const generator = new AcDbDataGenerator(this)

    // Create default layer
    if (options.layer) {
      generator.createDefaultLayer()
    }

    // Create default line type
    if (options.lineType) {
      generator.createDefaultLineType()
    }

    // Create default text style
    if (options.textStyle) {
      generator.createDefaultTextStyle()
    }

    // Create default dimension style
    if (options.dimStyle) {
      generator.createDefaultDimStyle()
    }

    // Create default layout for model space
    if (options.layout) {
      generator.createDefaultLayout()
    }
  }

  /**
   * Clears all data from the database.
   *
   * This method removes all entities, tables, and objects from the database,
   * effectively resetting it to an empty state.
   *
   * @example
   * ```typescript
   * database.clear();
   * ```
   */
  private clear() {
    // Clear all tables and dictionaries
    this._tables.blockTable.removeAll()
    this._tables.dimStyleTable.removeAll()
    this._tables.linetypeTable.removeAll()
    this._tables.textStyleTable.removeAll()
    this._tables.layerTable.removeAll()
    this._tables.viewportTable.removeAll()
    this._objects.layout.removeAll()
    this._currentSpace = undefined
    this._extents.makeEmpty()
  }

  /**
   * Triggers a header system variable changed event.
   *
   * This method is called internally when header system variables
   * are modified to notify listeners of the change.
   *
   * @param sysVarName - The name of the system variable that changed
   *
   * @example
   * ```typescript
   * database.triggerHeaderSysVarChangedEvent('aunits');
   * ```
   */
  private triggerHeaderSysVarChangedEvent(sysVarName: string) {
    this.events.headerSysVarChanged.dispatch({
      database: this,
      name: sysVarName
    })
  }

  /**
   * Extracts the file name from a URI.
   *
   * @param uri - The URI to extract the file name from
   * @returns The extracted file name, or empty string if extraction fails
   * @private
   */
  private getFileNameFromUri(uri: string): string {
    try {
      // Create a new URL object
      const url = new URL(uri)
      // Get the pathname from the URL
      const pathParts = url.pathname.split('/')
      // Return the last part of the pathname as the file name
      return pathParts[pathParts.length - 1] || ''
    } catch (error) {
      console.error('Invalid URI:', error)
      return ''
    }
  }
}
/* eslint-enable simple-import-sort/imports */
