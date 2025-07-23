import { AcCmEventManager } from '@mlightcad/common'

import { AcDbDxfConverter } from '../converter'
import { AcDbDatabaseConverter } from './AcDbDatabaseConverter'

/**
 * Drawing file type
 */
export enum AcDbFileType {
  /**
   * DXF file
   */
  DXF = 'dxf',
  /**
   * DWG file
   */
  DWG = 'dwg'
}

export interface AcDbDatabaseConverterManagerEventArgs {
  fileType: AcDbFileType
  converter: AcDbDatabaseConverter
}

/**
 * Used to register database converter by file type. For example, you can register 'dxf' converter
 * and 'dwg' converter to handle different file types by different converter.
 */
export class AcDbDatabaseConverterManager {
  private static _instance?: AcDbDatabaseConverterManager
  private _converters: Map<AcDbFileType, AcDbDatabaseConverter>

  public readonly events = {
    registered: new AcCmEventManager<AcDbDatabaseConverterManagerEventArgs>(),
    unregistered: new AcCmEventManager<AcDbDatabaseConverterManagerEventArgs>()
  }

  static createInstance() {
    if (AcDbDatabaseConverterManager._instance == null) {
      AcDbDatabaseConverterManager._instance =
        new AcDbDatabaseConverterManager()
    }
    return this._instance
  }

  /**
   * The singlton instance of this class.
   */
  static get instance() {
    if (!AcDbDatabaseConverterManager._instance) {
      AcDbDatabaseConverterManager._instance =
        new AcDbDatabaseConverterManager()
    }
    return AcDbDatabaseConverterManager._instance
  }

  private constructor() {
    this._converters = new Map()
    this.register(AcDbFileType.DXF, new AcDbDxfConverter())
  }

  /**
   * All of registered file types
   */
  get fileTypes() {
    return this._converters.keys()
  }

  /**
   * Register one database convert for the specified file type
   * @param fileType Input one file type value.
   * @param converter Input the database converter associated with the specified file type.
   */
  public register(fileType: AcDbFileType, converter: AcDbDatabaseConverter) {
    this._converters.set(fileType, converter)
    this.events.registered.dispatch({
      fileType,
      converter
    })
  }

  /**
   * Get the database converter associated with the specified file type.
   * @param fileType Input one file type value.
   * @returns Return the database converter associated with the specified file type.
   */
  public get(fileType: AcDbFileType) {
    return this._converters.get(fileType)
  }

  /**
   * Unregister the database converter for the specified file type.
   * @param fileType Input one file type value.
   */
  public unregister(fileType: AcDbFileType) {
    const converter = this._converters.get(fileType)
    if (converter) {
      this._converters.delete(fileType)
      this.events.unregistered.dispatch({
        fileType,
        converter
      })
    }
  }
}
