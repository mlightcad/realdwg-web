import { AcDbObject } from '../base'

/**
 * The AcDbRasterImageDef object (or "image definition object") works with the AcDbRasterImage entity
 * (or "image entity") to implement raster images inside AutoCAD. The relationship between these two
 * classes is much like the relationship between an AutoCAD block definition object and a block insert
 * entity.
 *
 * The image definition object plays a behind-the-scenes role like the block definition, maintaining
 * links to the source image file and managing low-level image processing operations required to display
 * and plot images. Image definition objects are stored in a special AcDbDictionary named
 * ISM_RASTER_IMAGE_DICT.
 */
export class AcDbRasterImageDef extends AcDbObject {
  private _sourceFileName: string

  /**
   * Consturct one instance of this class.
   */
  constructor() {
    super()
    this._sourceFileName = ''
  }

  /**
   * The path name of the externally referenced image file name.
   */
  get sourceFileName() {
    return this._sourceFileName
  }
  set sourceFileName(value: string) {
    this._sourceFileName = value
  }
}
