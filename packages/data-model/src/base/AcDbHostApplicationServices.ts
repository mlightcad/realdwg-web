import { AcDbDatabase } from '../database/AcDbDatabase'
import { AcDbLayoutManager } from '../object/layout/AcDbLayoutManager'

/**
 * Return the singleton instance of the host application services
 * @returns
 */
export function acdbHostApplicationServices() {
  return AcDbHostApplicationServices.instance
}

/**
 * The AcDbHostApplicationServices class provides various services to host applications at runtime.
 */
export class AcDbHostApplicationServices {
  private _workingDatabase: AcDbDatabase | null = null
  private _layoutManager: AcDbLayoutManager
  public static instance: AcDbHostApplicationServices =
    new AcDbHostApplicationServices()

  private constructor() {
    // Do nothing
    this._layoutManager = new AcDbLayoutManager()
  }
  /**
   * Get the current working database.
   */
  get workingDatabase(): AcDbDatabase {
    if (this._workingDatabase == null) {
      throw new Error(
        'The current working database must be set before using it!'
      )
    } else {
      return this._workingDatabase
    }
  }

  /**
   * Set the working database.
   * @param database Database to make the new working database
   */
  set workingDatabase(database: AcDbDatabase) {
    this._workingDatabase = database
  }

  /**
   * The one and only instance of the layout manager object.
   */
  get layoutManager() {
    return this._layoutManager
  }
}
