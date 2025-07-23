import {
  AcGeBox3d,
  AcGeMatrix3d,
  AcGeQuaternion,
  AcGeVector3d
} from '@mlightcad/geometry-engine'
import {
  AcGiBaseTextStyle,
  AcGiEntity,
  AcGiMTextAttachmentPoint,
  AcGiMTextData,
  AcGiRenderer,
  AcGiTextStyle
} from '@mlightcad/graphic-interface'

import { AcDbTextStyleTableRecord } from '../database'
import { AcDbBlockReference } from './AcDbBlockReference'

export interface AcDbTableCell {
  text: string
  attachmentPoint: AcGiMTextAttachmentPoint
  textStyle?: string
  rotation?: number
  cellType: number
  flagValue?: number
  mergedValue?: number
  autoFit?: number
  borderWidth?: number
  borderHeight?: number // applicable for merged cells
  overrideFlag?: number
  virtualEdgeFlag?: number
  fieldObjetId?: string // only for text type cell
  blockTableRecordId?: string
  blockScale?: number
  blockAttrNum?: number
  attrDefineId?: string[]
  attrText?: string
  textHeight: number
  extendedCellFlags?: number // from AutoCAD 2007
}

const tempVector = /*@__PURE__*/ new AcGeVector3d()

/**
 * The class represents the table entity in AutoCAD. A table is generally thought of as an n x m rectangular
 * array of cells whose contents consist of annotation objects, primarily text. Tables often contain a title
 * row, a header row, and multiple data rows.
 *
 * After creating a new table object using the constructor, applications usually need to set the table style,
 * number of rows and columns, column width, row height, insert position, width direction, and normal vector.
 * Applications can also enter text or block contents into each cell using methods of this class.
 */
export class AcDbTable extends AcDbBlockReference {
  private _attachmentPoint: AcGiMTextAttachmentPoint
  private _numRows: number
  private _numColumns: number
  private _rowHeight: number[]
  private _columnWidth: number[]
  private _cells: AcDbTableCell[]

  constructor(name: string, numRows: number, numColumns: number) {
    super(name)
    this._attachmentPoint = AcGiMTextAttachmentPoint.TopLeft
    this._numColumns = numColumns
    this._numRows = numRows
    this._columnWidth = new Array<number>(numColumns)
    this._rowHeight = new Array<number>(numRows)
    this._cells = new Array<AcDbTableCell>(numRows * numColumns)
  }

  /**
   * Cell alignment value of this table.
   */
  get attachmentPoint() {
    return this._attachmentPoint
  }
  set attachmentPoint(value: AcGiMTextAttachmentPoint) {
    this._attachmentPoint = value
  }

  /**
   * The number of rows in the table.
   */
  get numRows() {
    return this._numRows
  }
  set numRows(value: number) {
    this._numRows = value
  }

  /**
   * The number of columns in the table.
   */
  get numColumns() {
    return this._numColumns
  }
  set numColumns(value: number) {
    this._numColumns = value
  }

  /**
   * Get the number of contents in the specified cell.
   * @param row Input row index. It should be more than or equal to 0 and less than the number of rows.
   * @param col Input column index. It should be more than or equal to 0 and less than the number of columns.
   * @returns Return the number of contents in the specified cell.
   */
  // @ts-expect-error not use '_' prefix so that typedoc can the correct parameter to generate doc
  numContents(row: number, col: number) {
    // TODO: Implement it
    return 1
  }

  /**
   * Get the row height of the specified row in the table.
   * @param index Input zero-based row index
   * @returns Return the row height of the specified row in the table.
   */
  rowHeight(index: number) {
    return this._rowHeight[index]
  }
  /**
   * Set the row height for the specified row index in the table.
   * @param index Input zero-based row index
   * @param height Input height to be used for the specified row
   */
  setRowHeight(index: number, height: number) {
    this._rowHeight[index] = height
  }
  /**
   * Set a uniform row height for all the rows in the table.
   * @param height Input height to be used for all the rows in the table
   */
  setUniformRowHeight(height: number) {
    this._rowHeight.fill(height)
  }

  /**
   * Get the column width at the specified column index in the table.
   */
  columnWidth(index: number) {
    return this._columnWidth[index]
  }
  /**
   * Set a uniform column width for all the columns in the table.
   * @param width Input uniform width to be used for all the columns in the table
   */
  setUniformColumnWidth(width: number) {
    this._columnWidth.fill(width)
  }
  /**
   * Set the column width at the specified column index in the table.
   * @param index Input zero-based column index
   * @param width Input width to be used for the specified column
   */
  setColumnWidth(index: number, width: number) {
    this._columnWidth[index] = width
  }

  /**
   * Get the cell by index.
   * @param index Input cell index
   * @returns Return the specified cell by index
   */
  cell(index: number) {
    if (index < 0 || index >= this._cells.length) return undefined
    return this._cells[index]
  }

  /**
   * Set the cell by index.
   * @param index Input cell index
   */
  setCell(index: number, cell: AcDbTableCell) {
    this._cells[index] = cell
  }

  /**
   * Get text string in the specified cell.
   * @param row Input integer specifying the zero-based row index for the cell
   * @param col Input integer specifying the zero-based column index for the cell
   * @param content Input content index. It should be more than or equal to 0 and less than the number of contents.
   */
  // @ts-expect-error not use '_' prefix so that typedoc can the correct parameter to generate doc
  textString(row: number, col: number, content?: number) {
    return this._cells[row * col].text
  }

  /**
   * Set the text for the first content at the specified content index.
   * @param row Input integer specifying the zero-based row index for the cell
   * @param col Input integer specifying the zero-based column index for the cell
   * @param text Input text string
   */
  setTextString(row: number, col: number, text: string) {
    this._cells[row * col].text = text
  }

  /**
   * Return true if the content of the specified cell is empty
   * @param row Input integer specifying the zero-based row index for the cell
   * @param col Input integer specifying the zero-based column index for the cell
   * @returns Return true if the content of the specified cell is empty. Otherwise, return false.
   */
  isEmpty(row: number, col: number) {
    return !this._cells[row * col].text
  }

  /**
   * @inheritdoc
   */
  get geometricExtents(): AcGeBox3d {
    // TODO: Implement it
    return new AcGeBox3d()
  }

  /**
   * @inheritdoc
   */
  draw(renderer: AcGiRenderer): AcGiEntity {
    let allRowHeights = 0,
      allColumnWidths = 0
    const indices = new Uint16Array(this.numColumns * this.numRows * 8)
    const points = new Float32Array(
      (this.numColumns + 1) * (this.numRows + 1) * 3
    )
    let index = 0
    for (let i = 0; i <= this.numRows; i++) {
      allRowHeights -= i > 0 ? this.rowHeight(i - 1) : 0
      allColumnWidths = 0
      for (let j = 0; j <= this.numColumns; j++) {
        allColumnWidths += j > 0 ? this.columnWidth(j - 1) : 0
        points[index++] = allColumnWidths
        points[index++] = allRowHeights
        points[index++] = 0
      }
    }

    const results: AcGiEntity[] = []
    const visited: boolean[] = new Array(this.numRows * this.numColumns).fill(
      false
    )
    allColumnWidths = 0
    index = 0
    let cellIndex = 0
    for (let i = 0; i < this.numColumns; i++) {
      allColumnWidths += i > 0 ? this.columnWidth(i - 1) : 0
      allRowHeights = 0
      for (let j = 0; j < this.numRows; j++) {
        allRowHeights += j > 0 ? this.rowHeight(j - 1) : 0
        const cell = this.cell(j * this.numColumns + i)
        cellIndex = j * this.numColumns + i
        if (cell && !visited[cellIndex]) {
          const columnSpan = cell.borderWidth ?? 1
          const rowSpan = cell.borderHeight ?? 1
          this.fillVisited(
            visited,
            cellIndex,
            this.numColumns,
            columnSpan,
            rowSpan
          )

          // Draw top border line of the current cell by considering merged cell
          indices[index++] = i + j * (this.numColumns + 1)
          indices[index++] = i + j * (this.numColumns + 1) + columnSpan

          // Calcuate width of the cell by considering merged cell
          const width = points[indices[index - 1] * 3] - allColumnWidths

          // Draw right border line of the current cell by considering merged cell
          const tmp = i + (j + rowSpan) * (this.numColumns + 1) + columnSpan
          if (i + columnSpan == this.numColumns) {
            indices[index++] = i + j * (this.numColumns + 1) + columnSpan
            indices[index++] = tmp
          }

          // Calcuate height of the cell by considering merged cell
          const height = -points[tmp * 3 + 1] - allRowHeights

          // Draw bottom border line of the current cell by considering merged cell
          if (j + rowSpan == this.numRows) {
            indices[index++] =
              i + (j + rowSpan) * (this.numColumns + 1) + rowSpan
            indices[index++] = i + (j + rowSpan) * (this.numColumns + 1)
          }

          // Draw left border line of the current cell by considering merged cell
          indices[index++] = i + (j + rowSpan) * (this.numColumns + 1)
          indices[index++] = i + j * (this.numColumns + 1)

          // Draw text
          if (cell.text) {
            const attachmentPoint =
              cell.attachmentPoint ||
              this.attachmentPoint ||
              AcGiMTextAttachmentPoint.MiddleCenter
            const offset = this.getTableTextOffset(
              attachmentPoint,
              width,
              height
            )
            const mtextData: AcGiMTextData = {
              text: cell.text,
              height: cell.textHeight,
              width: width,
              position: tempVector
                .set(allColumnWidths, -allRowHeights, 0)
                .clone()
                .add(offset),
              rotation: this.rotation,
              attachmentPoint: attachmentPoint
            }
            const textStyle: AcGiTextStyle = {
              ...this.getTextStyle(cell),
              color: this.color.color!
            }
            results.push(renderer.mtext(mtextData, textStyle))
          }
        }
      }
    }
    results.push(renderer.lineSegments(points, 3, indices, this.lineStyle))

    const group = renderer.group(results)
    const quaternion = new AcGeQuaternion()
    quaternion.setFromAxisAngle(AcGeVector3d.Z_AXIS, this.rotation)
    _tmpMatrix.compose(this.position, quaternion, this.scaleFactors)
    group.applyMatrix(_tmpMatrix)
    return group
  }

  private fillVisited(
    visited: boolean[],
    currentIndex: number,
    columnCount: number,
    columnSpan: number,
    rowSpan: number
  ) {
    if (rowSpan == 1 && columnSpan == 1) {
      visited[currentIndex] = true
    } else {
      for (let i = 0; i < columnSpan; ++i) {
        for (let j = 0; j < rowSpan; ++j) {
          visited[currentIndex + i + j * columnCount] = true
        }
      }
    }
  }

  private getTextStyle(cell: AcDbTableCell): AcGiBaseTextStyle {
    const textStyleTable = this.database.tables.textStyleTable
    let style: AcDbTextStyleTableRecord | undefined
    if (cell.textStyle) {
      style = textStyleTable.getAt(cell.textStyle)
    }
    if (!style) {
      style = (textStyleTable.getAt('STANDARD') ||
        textStyleTable.getAt('Standard'))!
    }
    return style.textStyle
  }

  private getTableTextOffset(textAlign: number, width: number, height: number) {
    const offset = new AcGeVector3d()
    switch (textAlign) {
      case 1:
        break
      case 2:
        // Top Center
        offset.setX(width / 2)
        break
      case 3:
        // Top Right
        offset.setX(width)
        break
      case 4:
        // Middle Left
        offset.setY(-height / 2)
        break
      case 5:
        // Middle Center
        offset.set(width / 2, -height / 2, 0)
        break
      case 6:
        // Middle Right
        offset.set(width, -height / 2, 0)
        break
      case 7:
        // Bottom Left
        offset.setY(-height)
        break
      case 8:
        // Bottom Center
        offset.set(width / 2, -height, 0)
        break
      case 9:
        // Bottom Right
        offset.set(width, -height, 0)
        break
    }
    return offset
  }
}

const _tmpMatrix = /*@__PURE__*/ new AcGeMatrix3d()
