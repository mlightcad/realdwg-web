import { AcGiBaseLineStyle } from '@mlightcad/graphic-interface'

import { AcDbSymbolTableRecord } from './AcDbSymbolTableRecord'

/**
 * The class representing records in the line type table. Each of these records contains the information
 * about a line type in the drawing database.
 *
 * Within the line type table record, the dashes (line segments that make up characteristics of the
 * linetype) are stored in a list with an index that is zero based. If the linetype is complex, then
 * embedded shapes or text strings are stored in the list at the same index as the dash that preceded
 * them in the linetype definition. So there will always be a dashLength for any valid index in the
 * list, even if there is a shape or text string sharing the same index. When the linetype is elaborated,
 * a shape's insertion point will coincide with the end of the dash that it shares an index with.
 */
export class AcDbLinetypeTableRecord extends AcDbSymbolTableRecord {
  private _linetype: AcGiBaseLineStyle

  /**
   * Default constructor.
   */
  constructor(linetype: AcGiBaseLineStyle) {
    super()
    this.name = linetype.name
    this._linetype = linetype
  }

  /**
   * The number of dashes in the line type table record. This value is used for DXF group code 73.
   */
  get numDashes() {
    return this._linetype.pattern ? this._linetype.pattern.length : 0
  }

  /**
   * The length (in AutoCAD drawing units--the pattern will appear this length when the line type scale is
   * 1.0) of the pattern in the line type table record. The pattern length is the total length of all
   * dashes (including pen up spaces). Embedded shapes or text strings do not add to the pattern length
   * because they are overlaid and do not interrupt the actual dash pattern.
   */
  get patternLength() {
    return this._linetype.totalPatternLength
  }

  /**
   * Line type description
   */
  get comments() {
    return this._linetype.description
  }

  /**
   * Line type information used by renderer.
   */
  get linetype() {
    return this._linetype
  }

  /**
   * Get the length (in AutoCAD drawing units--the dash will appear this length when the linetype scale
   * is 1.0) of the index'th dash in the line type table record.
   * @param index Input zero-based index. It must be greater than or equal to zero, but less than the
   * value of property 'numDashes'.
   */
  dashLengthAt(index: number) {
    if (index < 0 || index >= this.numDashes) {
      throw new Error(
        'Index must be greater than or equal to zero, but less than the value of property "numDashes".'
      )
    }
    return this._linetype.pattern![index].elementLength
  }
}
